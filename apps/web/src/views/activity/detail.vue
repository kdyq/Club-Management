<script setup lang="ts">
/**
 * 活动详情。把整条链路收在一页上：
 * 立项审批 → 报名审核 → 签到（二维码/口令/代签）→ 发积分 → 写总结 → 归档。
 * 每个动作都按权限码显隐，且都以后端校验为准。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  ActivityStatus,
  CheckinStatus,
  CheckinType,
  CHECKIN_TYPE_LABEL,
  RegistrationStatus,
  type ActivityVo,
  type CheckinVo,
  type RegistrationVo,
} from '@club/shared';
import { activityApi } from '@/api/activity';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const user = useUserStore();

const activityId = computed(() => String(route.params.id));
const activity = ref<ActivityVo | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const activeTab = ref('registrations');

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    activity.value = await activityApi.detail(activityId.value);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

// ---------- 报名 ----------
const registering = ref(false);
async function onRegister(): Promise<void> {
  registering.value = true;
  try {
    const result = await activityApi.register(activityId.value);
    ElMessage.success(result.message);
    await load();
    await loadRegistrations();
  } catch {
    // 拦截器已提示
  } finally {
    registering.value = false;
  }
}

// ---------- 报名管理 ----------
const registrations = ref<RegistrationVo[]>([]);
const regTotal = ref(0);
const regLoading = ref(false);

async function loadRegistrations(): Promise<void> {
  if (!user.hasPerm('activity-registration:read')) return;
  regLoading.value = true;
  try {
    const result = await activityApi.registrations({ activityId: activityId.value, page: 1, pageSize: 100 });
    registrations.value = result.list;
    regTotal.value = result.total;
  } catch {
    registrations.value = [];
  } finally {
    regLoading.value = false;
  }
}

async function onAudit(row: RegistrationVo, approved: boolean): Promise<void> {
  let remark: string | undefined;
  if (!approved) {
    try {
      const input = await ElMessageBox.prompt('请填写拒绝原因（会展示给报名者）', '拒绝报名', {
        confirmButtonText: '确定拒绝',
        cancelButtonText: '取消',
        inputPlaceholder: '如：名额已满 / 不符合活动要求',
      });
      remark = input.value;
    } catch {
      return;
    }
  }
  try {
    await activityApi.auditRegistration(row.id, approved, remark);
    ElMessage.success(approved ? `已通过 ${row.memberName}` : `已拒绝 ${row.memberName}`);
    await load();
    await loadRegistrations();
  } catch {
    // 拦截器已提示
  }
}

async function onAuditAll(): Promise<void> {
  try {
    const result = await activityApi.auditAll(activityId.value);
    ElMessage.success(`已通过 ${result.approved} 条报名`);
    await load();
    await loadRegistrations();
  } catch {
    // 拦截器已提示
  }
}

// ---------- 签到 ----------
const checkins = ref<CheckinVo[]>([]);
const checkinToken = ref<{ token: string; expiresIn: number; code: string } | null>(null);
const countdown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

async function loadCheckins(): Promise<void> {
  if (!user.hasPerm('checkin:read')) return;
  try {
    const result = await activityApi.checkins({ activityId: activityId.value, page: 1, pageSize: 100 });
    checkins.value = result.list;
  } catch {
    checkins.value = [];
  }
}

async function refreshToken(): Promise<void> {
  try {
    const result = await activityApi.checkinToken(activityId.value);
    checkinToken.value = { token: result.token, expiresIn: result.expiresIn, code: result.code };
    countdown.value = result.expiresIn;
  } catch {
    checkinToken.value = null;
  }
}

function startTimer(): void {
  stopTimer();
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) void refreshToken();
  }, 1000);
}

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

async function onMakeup(): Promise<void> {
  const notChecked = registrations.value.filter(
    (r) => r.status === RegistrationStatus.APPROVED && !r.checkedIn,
  );
  if (notChecked.length === 0) {
    ElMessage.info('没有需要代签的成员');
    return;
  }
  try {
    const picked = await ElMessageBox.prompt(
      `请输入要代签的成员姓名（未签到：${notChecked.map((r) => r.memberName).join('、')}）`,
      '管理员代签',
      { confirmButtonText: '下一步', cancelButtonText: '取消' },
    );
    const target = notChecked.find((r) => r.memberName === picked.value.trim());
    if (target === undefined || target.memberId === null) {
      ElMessage.warning('没有找到这个成员，请核对姓名');
      return;
    }
    const reason = await ElMessageBox.prompt('请填写代签原因（会记在签到记录上）', '代签原因', {
      confirmButtonText: '确认代签',
      cancelButtonText: '取消',
      inputPlaceholder: '如：手机没电，现场人工登记',
    });
    await activityApi.makeup(activityId.value, target.memberId, reason.value);
    ElMessage.success(`已为 ${target.memberName} 代签`);
    await load();
    await loadCheckins();
    await loadRegistrations();
  } catch {
    // 用户取消或接口报错
  }
}

async function onMarkAbsent(): Promise<void> {
  try {
    const result = await activityApi.markAbsent(activityId.value);
    ElMessage.success(`已把 ${result.marked} 人标记为缺勤`);
    await loadCheckins();
  } catch {
    // 拦截器已提示
  }
}

// ---------- 生命周期 ----------
async function onSubmitApproval(): Promise<void> {
  try {
    await activityApi.submit(activityId.value);
    ElMessage.success('已提交立项审批');
    await load();
  } catch {
    // 拦截器已提示
  }
}

async function onCancelActivity(): Promise<void> {
  try {
    const input = await ElMessageBox.prompt('请填写取消原因', '取消活动', {
      confirmButtonText: '确认取消',
      cancelButtonText: '返回',
      inputPlaceholder: '如：天气原因改期',
    });
    await activityApi.cancel(activityId.value, input.value);
    ElMessage.success('活动已取消');
    await load();
  } catch {
    // 用户取消或接口报错
  }
}

async function onArchive(): Promise<void> {
  try {
    const input = await ElMessageBox.prompt('请填写活动总结（归档后活动只读）', '归档活动', {
      confirmButtonText: '归档',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValue: activity.value?.summaryReport ?? '',
      inputPlaceholder: '到场人数、实际执行情况、遗留问题……',
    });
    await activityApi.archive(activityId.value, input.value);
    ElMessage.success('活动已归档');
    await load();
  } catch {
    // 用户取消或接口报错（未写总结会被拦）
  }
}

async function onIssuePoints(): Promise<void> {
  try {
    const result = await activityApi.issuePoints(activityId.value);
    if (result.issued === 0 && result.skipped > 0) {
      ElMessage.info(`${result.skipped} 人已经发过积分了，本次没有新增`);
    } else {
      ElMessage.success(`已给 ${result.issued} 人发放积分${result.skipped > 0 ? `，${result.skipped} 人此前已发过` : ''}`);
    }
  } catch {
    // 拦截器已提示
  }
}

// ---------- 请假 ----------
async function onApplyLeave(): Promise<void> {
  try {
    const input = await ElMessageBox.prompt('请填写请假原因', '请假申请', {
      confirmButtonText: '提交',
      cancelButtonText: '取消',
      inputPlaceholder: '如：临时有课',
    });
    await activityApi.applyLeave(activityId.value, input.value);
    ElMessage.success('请假已提交，等待审批');
  } catch {
    // 用户取消或接口报错
  }
}

const statusTagType = computed<'primary' | 'success' | 'info' | 'warning' | 'danger'>(() => {
  const s = activity.value?.status;
  if (s === ActivityStatus.REGISTERING) return 'primary';
  if (s === ActivityStatus.ONGOING) return 'success';
  if (s === ActivityStatus.PENDING_APPROVAL) return 'warning';
  if (s === ActivityStatus.CANCELLED) return 'danger';
  return 'info';
});

const canManage = computed(() => user.hasPerm('activity:update'));

onMounted(async () => {
  await load();
  await Promise.all([loadRegistrations(), loadCheckins()]);
  if (user.hasPerm('checkin:create')) {
    await refreshToken();
    startTimer();
  }
});

onUnmounted(stopTimer);
</script>

<template>
  <div class="page">
    <div v-if="loading" class="panel"><el-skeleton :rows="6" animated /></div>

    <section v-else-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">活动加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="load">重试</el-button>
    </section>

    <template v-else-if="activity !== null">
      <header class="page__head">
        <div>
          <div class="crumbs">
            <el-button link @click="router.push('/activities')">
              <el-icon><ArrowLeft /></el-icon>
              返回列表
            </el-button>
          </div>
          <div class="title-row">
            <h1 class="page__title">{{ activity.title }}</h1>
            <el-tag :type="statusTagType" effect="plain">{{ activity.statusLabel }}</el-tag>
            <el-tag v-if="activity.categoryName" type="info" effect="plain">{{ activity.categoryName }}</el-tag>
          </div>
          <p class="page__desc">{{ activity.summary ?? '暂无简介' }}</p>
        </div>

        <div class="page__actions">
          <el-button v-if="canManage && activity.status === ActivityStatus.DRAFT" type="primary" @click="onSubmitApproval">
            提交立项审批
          </el-button>
          <el-button
            v-if="activity.status === ActivityStatus.REGISTERING || activity.status === ActivityStatus.ONGOING"
            type="primary"
            :loading="registering"
            @click="onRegister"
          >
            我要报名
          </el-button>
          <el-button v-if="activity.status === ActivityStatus.REGISTERING" @click="onApplyLeave">
            请假
          </el-button>
          <el-dropdown v-if="canManage" trigger="click">
            <el-button>
              更多
              <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="onAuditAll">一键通过待审报名</el-dropdown-item>
                <el-dropdown-item @click="onIssuePoints">发放积分</el-dropdown-item>
                <el-dropdown-item @click="onMarkAbsent">标记未签到为缺勤</el-dropdown-item>
                <el-dropdown-item divided @click="onArchive">归档活动</el-dropdown-item>
                <el-dropdown-item @click="onCancelActivity">取消活动</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <section class="panel">
        <div class="metrics">
          <div class="metric">
            <div class="metric__value num">{{ activity.approvedCount }}<span v-if="activity.capacity > 0" class="metric__of">/{{ activity.capacity }}</span></div>
            <div class="metric__label">已通过报名</div>
          </div>
          <div class="metric">
            <div class="metric__value num">{{ activity.pendingCount }}</div>
            <div class="metric__label">待审核</div>
          </div>
          <div class="metric">
            <div class="metric__value num">{{ activity.checkedInCount }}</div>
            <div class="metric__label">已签到</div>
          </div>
          <div class="metric">
            <div class="metric__value num">{{ activity.points }}</div>
            <div class="metric__label">参与积分</div>
          </div>
          <div class="metric">
            <div class="metric__value num">{{ activity.volunteerHours }}</div>
            <div class="metric__label">志愿时长</div>
          </div>
          <div class="metric">
            <div class="metric__value num">¥{{ activity.budgetAmount }}</div>
            <div class="metric__label">预算</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">活动信息</h2>
        <dl class="fields">
          <div><dt>时间</dt><dd class="num">{{ new Date(activity.startTime).toLocaleString('zh-CN') }} ~ {{ new Date(activity.endTime).toLocaleString('zh-CN') }}</dd></div>
          <div><dt>地点</dt><dd>{{ activity.location ?? '待定' }}</dd></div>
          <div><dt>组织者</dt><dd>{{ activity.organizerName ?? '—' }}</dd></div>
          <div><dt>签到方式</dt><dd>{{ CHECKIN_TYPE_LABEL[activity.checkinType as CheckinType] ?? '—' }}</dd></div>
          <div><dt>报名是否需审核</dt><dd>{{ activity.needAudit ? '需要' : '不需要' }}</dd></div>
          <div><dt>联系方式</dt><dd>{{ activity.contactInfo ?? '—' }}</dd></div>
        </dl>
        <p v-if="activity.summaryReport" class="report">
          <b>活动总结：</b>{{ activity.summaryReport }}
        </p>
      </section>

      <section v-if="user.hasPerm('checkin:create') && checkinToken !== null" class="panel">
        <h2 class="panel__title">签到口令</h2>
        <p class="token-hint">
          口令由服务端按时间片计算，客户端只负责展示。当前口令 <span class="num">{{ countdown }}</span> 秒后失效并自动刷新。
        </p>
        <div class="token-row">
          <div class="token">
            <div class="token__label">二维码内容（token）</div>
            <div class="token__value">{{ checkinToken.token }}</div>
          </div>
          <div class="token">
            <div class="token__label">数字口令（无法扫码时口头播报）</div>
            <div class="token__value token__value--code num">{{ checkinToken.code }}</div>
          </div>
        </div>
      </section>

      <section class="panel panel--table">
        <el-tabs v-model="activeTab">
          <el-tab-pane v-if="user.hasPerm('activity-registration:read')" label="报名记录" name="registrations">
            <div class="tab-head">
              <span class="muted">共 {{ regTotal }} 条</span>
              <el-button v-perm="'activity-registration:update'" size="small" type="primary" @click="onAuditAll">
                一键通过待审
              </el-button>
            </div>
            <el-table v-loading="regLoading" :data="registrations" size="small">
              <el-table-column prop="memberName" label="姓名" width="110" />
              <el-table-column label="部门" width="110">
                <template #default="{ row }">{{ row.deptName ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="报名时间" width="170">
                <template #default="{ row }"><span class="num">{{ new Date(row.applyAt).toLocaleString('zh-CN') }}</span></template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.status === 2 ? 'success' : row.status === 1 ? 'warning' : 'info'" effect="plain" size="small">
                    {{ row.statusLabel }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="签到" width="90">
                <template #default="{ row }">
                  <el-tag v-if="row.checkedIn" type="success" effect="plain" size="small">已签到</el-tag>
                  <span v-else class="muted">未签到</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <template v-if="row.status === 1 && user.hasPerm('activity-registration:update')">
                    <el-button link type="primary" @click="onAudit(row, true)">通过</el-button>
                    <el-button link type="danger" @click="onAudit(row, false)">拒绝</el-button>
                  </template>
                  <span v-else-if="row.auditRemark" class="muted">{{ row.auditRemark }}</span>
                </template>
              </el-table-column>
            </el-table>
            <div class="tab-actions">
              <el-button v-perm="'checkin:update'" size="small" @click="onMakeup">管理员代签</el-button>
            </div>
          </el-tab-pane>

          <el-tab-pane v-if="user.hasPerm('checkin:read')" label="签到记录" name="checkins">
            <el-table :data="checkins" size="small">
              <el-table-column prop="memberName" label="姓名" width="110" />
              <el-table-column label="部门" width="110">
                <template #default="{ row }">{{ row.deptName ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="签到时间" width="170">
                <template #default="{ row }">
                  <span class="num">{{ row.checkinTime ? new Date(row.checkinTime).toLocaleString('zh-CN') : '—' }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="checkinTypeLabel" label="方式" width="110" />
              <el-table-column label="状态" width="100">
                <template #default="{ row }">
                  <el-tag
                    :type="row.status === CheckinStatus.NORMAL ? 'success' : row.status === CheckinStatus.LATE ? 'warning' : row.status === CheckinStatus.ABSENT ? 'danger' : 'info'"
                    effect="plain"
                    size="small"
                  >
                    {{ row.statusLabel }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="代签" min-width="140">
                <template #default="{ row }">
                  <span v-if="row.isMakeup" class="muted">是 · {{ row.makeupReason }}</span>
                  <span v-else class="muted">—</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.crumbs {
  margin-bottom: var(--sp-2);
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.page__title {
  font-size: 20px;
}

.page__desc {
  margin-top: var(--sp-2);
  color: var(--c-text-2);
  font-size: 13.5px;
}

.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
}

.page__actions {
  display: flex;
  gap: var(--sp-2);
  flex: none;
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
}

.panel--table {
  padding: var(--sp-3) var(--sp-3) var(--sp-4);
}

.panel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-2);
  margin-bottom: var(--sp-4);
}

.panel--error {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  border-color: var(--c-danger-tint);
  background: var(--c-danger-tint);
}

.panel--error__icon {
  font-size: 22px;
  color: var(--c-danger);
}

.panel--error__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-danger);
}

.panel--error__desc {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--c-text-2);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.metric {
  padding: 0 var(--sp-4);
  border-left: 1px solid var(--c-border);
}

.metric:first-child {
  padding-left: 0;
  border-left: none;
}

.metric__value {
  font-size: 20px;
  font-weight: 700;
}

.metric__of {
  font-size: 13px;
  font-weight: 500;
  color: var(--c-text-3);
}

.metric__label {
  font-size: 12px;
  color: var(--c-text-2);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--sp-4) var(--sp-6);
  margin: 0;
}

.fields dt {
  font-size: 12px;
  color: var(--c-text-3);
}

.fields dd {
  margin: 2px 0 0;
  font-size: 13.5px;
}

.report {
  margin-top: var(--sp-5);
  padding: var(--sp-4);
  border-radius: var(--r-control);
  background: var(--c-surface-sunken);
  font-size: 13px;
  line-height: 1.7;
}

.token-hint {
  font-size: 12.5px;
  color: var(--c-text-2);
  margin-bottom: var(--sp-4);
}

.token-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--sp-4);
}

.token {
  padding: var(--sp-4);
  border-radius: var(--r-control);
  background: var(--c-accent-tint);
}

.token__label {
  font-size: 12px;
  color: var(--c-text-2);
}

.token__value {
  margin-top: var(--sp-2);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  color: var(--c-accent);
  word-break: break-all;
}

.token__value--code {
  font-size: 26px;
  letter-spacing: 0.14em;
}

.tab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-2) var(--sp-3);
}

.tab-actions {
  display: flex;
  justify-content: flex-end;
  padding: var(--sp-3) var(--sp-2) 0;
}

.muted {
  color: var(--c-text-3);
  font-size: 12.5px;
}

@media (max-width: 900px) {
  .metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--sp-4) 0;
  }

  .metric:nth-child(3n + 1) {
    padding-left: 0;
    border-left: none;
  }

  .token-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
