<script setup lang="ts">
/**
 * 审批中心：我的待办 + 我提交的申请。
 * 审批引擎是横切的，这里不区分业务类型——活动和经费的审批都落在同一处。
 */
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  APPROVAL_INSTANCE_STATUS_LABEL,
  APPROVAL_TASK_STATUS_LABEL,
  ApprovalInstanceStatus,
  ApprovalTaskStatus,
  BIZ_TYPE_LABEL,
  type ApprovalInstanceVo,
  type ApprovalTaskListItemVo,
  type BizType,
} from '@club/shared';
import { approvalApi } from '@/api/approval';

const activeTab = ref('tasks');
const tasks = ref<ApprovalTaskListItemVo[]>([]);
const applications = ref<ApprovalInstanceVo[]>([]);
const loading = ref(false);
const detail = ref<ApprovalInstanceVo | null>(null);
const drawerVisible = ref(false);

async function loadTasks(): Promise<void> {
  loading.value = true;
  try {
    const result = await approvalApi.myTasks({ page: 1, pageSize: 50 });
    tasks.value = result.list;
  } catch {
    tasks.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadApplications(): Promise<void> {
  loading.value = true;
  try {
    const result = await approvalApi.myApplications({ page: 1, pageSize: 50 });
    applications.value = result.list;
  } catch {
    applications.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadTasks(), loadApplications()]);
});

async function onApprove(row: ApprovalTaskListItemVo): Promise<void> {
  let opinion: string | undefined;
  try {
    const input = await ElMessageBox.prompt('可以填写审批意见（选填）', '同意', {
      confirmButtonText: '确认同意',
      cancelButtonText: '取消',
      inputPlaceholder: '同意',
    });
    opinion = input.value;
  } catch {
    return;
  }
  try {
    const result = await approvalApi.approve(row.id, opinion);
    ElMessage.success(result.finished ? '审批已通过' : '已同意，流程进入下一节点');
    await Promise.all([loadTasks(), loadApplications()]);
  } catch {
    // 拦截器已提示
  }
}

async function onReject(row: ApprovalTaskListItemVo): Promise<void> {
  let opinion: string;
  try {
    const input = await ElMessageBox.prompt('驳回必须填写意见，会展示给申请人', '驳回', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '如：预算超出上限，请调整后重新提交',
    });
    opinion = input.value;
    if (opinion.trim() === '') {
      ElMessage.warning('驳回必须填写意见');
      return;
    }
  } catch {
    return;
  }
  try {
    await approvalApi.reject(row.id, opinion);
    ElMessage.success('已驳回，流程终止');
    await Promise.all([loadTasks(), loadApplications()]);
  } catch {
    // 拦截器已提示
  }
}

async function onView(instanceId: string): Promise<void> {
  try {
    detail.value = await approvalApi.detail(instanceId);
    drawerVisible.value = true;
  } catch {
    // 拦截器已提示
  }
}

async function onRevoke(row: ApprovalInstanceVo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定撤销「${row.title}」的申请吗？`, '撤销申请', {
      confirmButtonText: '撤销',
      cancelButtonText: '返回',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await approvalApi.revoke(row.id);
    ElMessage.success('已撤销');
    await loadApplications();
  } catch {
    // 拦截器已提示
  }
}

function instanceTagType(status: number): 'warning' | 'success' | 'danger' | 'info' {
  if (status === ApprovalInstanceStatus.PENDING) return 'warning';
  if (status === ApprovalInstanceStatus.APPROVED) return 'success';
  if (status === ApprovalInstanceStatus.REJECTED) return 'danger';
  return 'info';
}

function taskTagType(status: number): 'warning' | 'success' | 'danger' | 'info' {
  if (status === ApprovalTaskStatus.PENDING) return 'warning';
  if (status === ApprovalTaskStatus.AGREED) return 'success';
  if (status === ApprovalTaskStatus.REFUSED) return 'danger';
  return 'info';
}

void BIZ_TYPE_LABEL;
void ApprovalTaskStatus;
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">审批中心</h1>
        <p class="page__desc">
          活动立项、经费收支等都走同一套审批引擎，审批通过后由引擎回调业务模块推进状态。
        </p>
      </div>
    </header>

    <section class="panel panel--table">
      <el-tabs v-model="activeTab">
        <el-tab-pane name="tasks">
          <template #label>
            我的待办
            <el-badge v-if="tasks.length > 0" :value="tasks.length" class="tab-badge" />
          </template>

          <el-table v-loading="loading" :data="tasks" size="default">
            <el-table-column label="申请事项" min-width="220">
              <template #default="{ row }">
                <div class="cell-title">{{ row.title }}</div>
                <div class="cell-sub">
                  {{ BIZ_TYPE_LABEL[row.bizType as BizType] ?? row.bizType }} · 第 {{ row.seq }} 步
                </div>
              </template>
            </el-table-column>
            <el-table-column label="提交时间" width="180">
              <template #default="{ row }"><span class="num">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="taskTagType(row.status)" effect="plain" size="small">
                  {{ APPROVAL_TASK_STATUS_LABEL[row.status as ApprovalTaskStatus] ?? row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <template v-if="row.status === ApprovalTaskStatus.PENDING">
                  <el-button v-perm="'approval:approve'" link type="primary" @click="onApprove(row)">同意</el-button>
                  <el-button v-perm="'approval:approve'" link type="danger" @click="onReject(row)">驳回</el-button>
                </template>
                <el-button link @click="onView(row.instanceId)">流程</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!loading && tasks.length === 0" description="没有待你处理的审批" />
        </el-tab-pane>

        <el-tab-pane label="我提交的申请" name="applications">
          <el-table v-loading="loading" :data="applications" size="default">
            <el-table-column label="申请事项" min-width="240">
              <template #default="{ row }">
                <div class="cell-title">{{ row.title }}</div>
                <div class="cell-sub">{{ row.flowName }}</div>
              </template>
            </el-table-column>
            <el-table-column label="当前节点" width="110">
              <template #default="{ row }">
                <span class="num">第 {{ row.currentSeq }} 步</span>
              </template>
            </el-table-column>
            <el-table-column label="提交时间" width="180">
              <template #default="{ row }"><span class="num">{{ new Date(row.submitAt).toLocaleString('zh-CN') }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="instanceTagType(row.status)" effect="plain" size="small">
                  {{ APPROVAL_INSTANCE_STATUS_LABEL[row.status as ApprovalInstanceStatus] ?? row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link @click="onView(row.id)">流程</el-button>
                <el-button
                  v-if="row.status === ApprovalInstanceStatus.PENDING"
                  link
                  type="danger"
                  @click="onRevoke(row)"
                >
                  撤销
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!loading && applications.length === 0" description="你还没有提交过审批" />
        </el-tab-pane>
      </el-tabs>
    </section>

    <el-drawer v-model="drawerVisible" size="460px" :title="detail?.title ?? '审批流程'">
      <template v-if="detail !== null">
        <div class="flow-head">
          <el-tag :type="instanceTagType(detail.status)" effect="plain">
            {{ APPROVAL_INSTANCE_STATUS_LABEL[detail.status as ApprovalInstanceStatus] ?? detail.status }}
          </el-tag>
          <span class="muted">申请人 {{ detail.applicantName }} · {{ detail.flowName }}</span>
        </div>

        <el-timeline class="timeline">
          <el-timeline-item
            v-for="task in detail.tasks"
            :key="task.id"
            :type="task.status === ApprovalTaskStatus.AGREED ? 'success' : task.status === ApprovalTaskStatus.REFUSED ? 'danger' : 'primary'"
            :timestamp="task.handledAt !== null ? new Date(task.handledAt).toLocaleString('zh-CN') : '待处理'"
          >
            <div class="node">
              <div class="node__head">
                第 {{ task.seq }} 步 · {{ task.approverName }}
                <el-tag :type="taskTagType(task.status)" effect="plain" size="small">
                  {{ APPROVAL_TASK_STATUS_LABEL[task.status as ApprovalTaskStatus] ?? task.status }}
                </el-tag>
              </div>
              <div v-if="task.opinion" class="node__opinion">{{ task.opinion }}</div>
            </div>
          </el-timeline-item>
        </el-timeline>

        <div v-if="detail.formData" class="form-data">
          <div class="form-data__title">提交内容</div>
          <pre class="form-data__body">{{ JSON.stringify(detail.formData, null, 2) }}</pre>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.page__title {
  font-size: 20px;
}

.page__desc {
  margin-top: var(--sp-1);
  color: var(--c-text-2);
  font-size: 13.5px;
  max-width: 68ch;
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

.tab-badge {
  margin-left: var(--sp-2);
}

.cell-title {
  font-weight: 500;
}

.cell-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--c-text-3);
}

.flow-head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding-bottom: var(--sp-4);
  border-bottom: 1px solid var(--c-border);
}

.timeline {
  margin-top: var(--sp-5);
}

.node__head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: 13.5px;
  font-weight: 500;
}

.node__opinion {
  margin-top: var(--sp-2);
  padding: var(--sp-3);
  border-radius: var(--r-control);
  background: var(--c-surface-sunken);
  font-size: 12.5px;
  color: var(--c-text-2);
}

.form-data {
  margin-top: var(--sp-5);
}

.form-data__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-text-2);
  margin-bottom: var(--sp-2);
}

.form-data__body {
  margin: 0;
  padding: var(--sp-3);
  border-radius: var(--r-control);
  background: var(--c-surface-sunken);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
}

.muted {
  color: var(--c-text-3);
  font-size: 12.5px;
}
</style>
