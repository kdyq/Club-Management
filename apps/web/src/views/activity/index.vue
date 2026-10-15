<script setup lang="ts">
/**
 * 活动列表。报名入口、状态标签、报名进度都按开发文档 9.4 节的一致性清单来：
 * 状态标签用「报名中（强调色）/ 进行中（绿）/ 已结束（中性）」，进度用细条 + 等宽数字。
 */
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  ACTIVITY_STATUS_LABEL,
  ActivityStatus,
  CheckinType,
  CHECKIN_TYPE_LABEL,
  type ActivityQuery,
  type ActivityVo,
} from '@club/shared';
import { activityApi, type CreateActivityPayload } from '@/api/activity';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';

const user = useUserStore();

const statusOptions = Object.entries(ACTIVITY_STATUS_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));

const {
  list,
  total,
  loading,
  error,
  query,
  hasFilter,
  reload,
  reset,
  onPageChange,
  onPageSizeChange,
} = useTable<ActivityVo, ActivityQuery>(activityApi.page, {
  defaultQuery: { page: 1, pageSize: 12 },
});

const categories = ref<{ id: string; name: string }[]>([]);

onMounted(async () => {
  try {
    categories.value = await activityApi.categories();
  } catch {
    // 拿不到分类不影响列表
  }
});

// ---------- 新增活动 ----------
const dialogVisible = ref(false);
const submitting = ref(false);
const form = ref<CreateActivityPayload>({
  title: '',
  categoryId: null,
  summary: '',
  location: '',
  startTime: '',
  endTime: '',
  capacity: 0,
  needAudit: false,
  checkinType: CheckinType.QRCODE,
  points: 0,
  volunteerHours: 0,
  budgetAmount: 0,
});

function openCreate(): void {
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 3600_000);
  form.value = {
    title: '',
    categoryId: null,
    summary: '',
    location: '',
    startTime: toLocalInput(now),
    endTime: toLocalInput(later),
    signupStart: toLocalInput(now),
    signupEnd: toLocalInput(later),
    checkinStart: toLocalInput(now),
    checkinEnd: toLocalInput(later),
    capacity: 0,
    needAudit: false,
    checkinType: CheckinType.QRCODE,
    points: 5,
    volunteerHours: 0,
    budgetAmount: 0,
  };
  dialogVisible.value = true;
}

function toLocalInput(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function onCreate(): Promise<void> {
  if (form.value.title.trim().length < 2) {
    ElMessage.warning('请填写活动标题');
    return;
  }
  if (form.value.startTime === '' || form.value.endTime === '') {
    ElMessage.warning('请填写起止时间');
    return;
  }

  submitting.value = true;
  try {
    const payload: CreateActivityPayload = {
      ...form.value,
      startTime: new Date(form.value.startTime).toISOString(),
      endTime: new Date(form.value.endTime).toISOString(),
      signupStart: form.value.signupStart === undefined || form.value.signupStart === ''
        ? undefined
        : new Date(form.value.signupStart).toISOString(),
      signupEnd: form.value.signupEnd === undefined || form.value.signupEnd === ''
        ? undefined
        : new Date(form.value.signupEnd).toISOString(),
      checkinStart: form.value.checkinStart === undefined || form.value.checkinStart === ''
        ? undefined
        : new Date(form.value.checkinStart).toISOString(),
      checkinEnd: form.value.checkinEnd === undefined || form.value.checkinEnd === ''
        ? undefined
        : new Date(form.value.checkinEnd).toISOString(),
    };
    await activityApi.create(payload);
    ElMessage.success('活动已创建为草稿，请到详情页提交立项审批');
    dialogVisible.value = false;
    await reload();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

/** 报名 / 详情 */
const myRegistrations = ref<Record<string, number>>({});

async function onRegister(activity: ActivityVo): Promise<void> {
  try {
    const result = await activityApi.register(activity.id);
    ElMessage.success(result.message);
    await reload();
  } catch {
    // 拦截器已提示（名额满、重复报名等都有明确中文）
  }
}

function statusTagType(status: number): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  if (status === ActivityStatus.REGISTERING) return 'primary';
  if (status === ActivityStatus.ONGOING) return 'success';
  if (status === ActivityStatus.PENDING_APPROVAL) return 'warning';
  if (status === ActivityStatus.CANCELLED) return 'danger';
  return 'info';
}

function canRegister(a: ActivityVo): boolean {
  return a.status === ActivityStatus.REGISTERING || a.status === ActivityStatus.ONGOING;
}

const progressPercent = (a: ActivityVo): number => {
  if (a.capacity <= 0) return 0;
  return Math.min(100, Math.round((a.approvedCount / a.capacity) * 100));
};

void myRegistrations;
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">活动管理</h1>
        <p class="page__desc">共 {{ total }} 场活动。活动立项需经部门负责人与社长两级审批。</p>
      </div>
      <el-button v-perm="'activity:create'" type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建活动
      </el-button>
    </header>

    <section class="panel panel--filters">
      <el-input
        v-model="query.keyword"
        class="filter"
        placeholder="搜索活动标题"
        clearable
        @keyup.enter="reload"
        @clear="reload"
      />
      <el-select v-model="query.categoryId" class="filter filter--sm" placeholder="分类" clearable>
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <el-select v-model="query.status" class="filter filter--sm" placeholder="状态" clearable>
        <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-checkbox v-model="query.mine">只看我组织的</el-checkbox>
      <el-checkbox v-model="query.joined">只看我报名的</el-checkbox>
      <el-button v-if="hasFilter" @click="reset">清空筛选</el-button>
    </section>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">活动列表加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="reload">重试</el-button>
    </section>

    <section v-else-if="loading && list.length === 0" class="cards">
      <div v-for="i in 4" :key="i" class="panel"><el-skeleton :rows="3" animated /></div>
    </section>

    <section v-else-if="list.length === 0" class="panel panel--empty">
      <el-empty :description="hasFilter ? '没有符合筛选条件的活动' : '还没有活动'">
        <el-button v-if="hasFilter" type="primary" @click="reset">清空筛选</el-button>
        <el-button v-else-if="user.hasPerm('activity:create')" type="primary" @click="openCreate">
          创建第一场活动
        </el-button>
      </el-empty>
    </section>

    <section v-else class="cards">
      <article v-for="a in list" :key="a.id" class="card">
        <div class="card__head">
          <el-tag :type="statusTagType(a.status)" effect="plain" size="small">{{ a.statusLabel }}</el-tag>
          <span v-if="a.categoryName" class="card__cat">{{ a.categoryName }}</span>
        </div>

        <h2 class="card__title">
          <router-link :to="`/activities/${a.id}`">{{ a.title }}</router-link>
        </h2>
        <p class="card__summary">{{ a.summary ?? '暂无简介' }}</p>

        <dl class="card__meta">
          <div>
            <dt>时间</dt>
            <dd class="num">{{ new Date(a.startTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}</dd>
          </div>
          <div>
            <dt>地点</dt>
            <dd>{{ a.location ?? '待定' }}</dd>
          </div>
          <div>
            <dt>签到</dt>
            <dd>{{ CHECKIN_TYPE_LABEL[a.checkinType as CheckinType] ?? '—' }}</dd>
          </div>
          <div>
            <dt>组织者</dt>
            <dd>{{ a.organizerName ?? '—' }}</dd>
          </div>
        </dl>

        <div class="card__progress">
          <div class="bar">
            <div class="bar__fill" :style="{ width: `${progressPercent(a)}%` }" />
          </div>
          <span class="num card__count">
            {{ a.approvedCount }} / {{ a.capacity === 0 ? '不限' : a.capacity }}
            <span v-if="a.pendingCount > 0" class="card__pending">· {{ a.pendingCount }} 待审</span>
          </span>
        </div>

        <div class="card__actions">
          <el-button v-if="canRegister(a)" size="small" type="primary" @click="onRegister(a)">
            报名
          </el-button>
          <router-link :to="`/activities/${a.id}`">
            <el-button size="small">查看详情</el-button>
          </router-link>
        </div>
      </article>
    </section>

    <div v-if="list.length > 0" class="pager">
      <el-pagination
        :current-page="query.page"
        :page-size="query.pageSize"
        :total="total"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next"
        background
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <el-dialog v-model="dialogVisible" title="新建活动" width="640px" :close-on-click-modal="false">
      <el-form label-width="88px">
        <div class="grid">
          <el-form-item label="标题" required>
            <el-input v-model="form.title" maxlength="128" placeholder="如：英仙座流星雨观测" />
          </el-form-item>
          <el-form-item label="分类">
            <el-select v-model="form.categoryId" clearable placeholder="未分类" style="width: 100%">
              <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始时间" required>
            <el-date-picker v-model="form.startTime" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="结束时间" required>
            <el-date-picker v-model="form.endTime" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="报名开始">
            <el-date-picker v-model="form.signupStart" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="报名截止">
            <el-date-picker v-model="form.signupEnd" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="签到开始">
            <el-date-picker v-model="form.checkinStart" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="签到截止">
            <el-date-picker v-model="form.checkinEnd" type="datetime" style="width: 100%" />
          </el-form-item>
          <el-form-item label="人数上限">
            <el-input-number v-model="form.capacity" :min="0" :max="9999" controls-position="right" />
            <span class="hint">0 表示不限</span>
          </el-form-item>
          <el-form-item label="签到方式">
            <el-select v-model="form.checkinType" style="width: 100%">
              <el-option
                v-for="(label, value) in CHECKIN_TYPE_LABEL"
                :key="value"
                :label="label"
                :value="Number(value)"
                :disabled="Number(value) === 3"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="参与积分">
            <el-input-number v-model="form.points" :min="0" :max="100" controls-position="right" />
          </el-form-item>
          <el-form-item label="志愿时长">
            <el-input-number v-model="form.volunteerHours" :min="0" :max="999" :step="0.5" controls-position="right" />
          </el-form-item>
        </div>

        <el-form-item label="地点">
          <el-input v-model="form.location" maxlength="128" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.summary" maxlength="255" />
        </el-form-item>
        <el-form-item label="报名需审核">
          <el-switch v-model="form.needAudit" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreate">创建草稿</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.page__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
}

.page__title {
  font-size: 20px;
}

.page__desc {
  margin-top: var(--sp-1);
  color: var(--c-text-2);
  font-size: 13.5px;
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
}

.panel--filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
}

.filter {
  width: 220px;
}

.filter--sm {
  width: 140px;
}

.panel--empty {
  padding: var(--sp-8);
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

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--sp-4);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
}

.card__head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.card__cat {
  font-size: 12px;
  color: var(--c-text-3);
}

.card__title {
  font-size: 16px;
}

.card__title a {
  color: var(--c-text);
}

.card__title a:hover {
  color: var(--c-accent);
}

.card__summary {
  font-size: 13px;
  color: var(--c-text-2);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--sp-2) var(--sp-4);
  margin: 0;
  font-size: 12.5px;
}

.card__meta dt {
  color: var(--c-text-3);
}

.card__meta dd {
  margin: 0;
  color: var(--c-text);
}

.card__progress {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--c-neutral-tint);
  overflow: hidden;
}

.bar__fill {
  height: 100%;
  background: var(--c-accent);
}

.card__count {
  font-size: 12.5px;
  color: var(--c-text-2);
  white-space: nowrap;
}

.card__pending {
  color: var(--c-warn);
}

.card__actions {
  display: flex;
  gap: var(--sp-2);
  margin-top: auto;
}

.pager {
  display: flex;
  justify-content: flex-end;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--sp-5);
}

.hint {
  margin-left: var(--sp-2);
  font-size: 12px;
  color: var(--c-text-3);
}
</style>
