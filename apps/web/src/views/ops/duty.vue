<script setup lang="ts">
/** 值班表：排班 → 本人确认 → 写日志（自动置为已完成）。 */
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { DutyStatus, type DutyPlanVo, type DutyScheduleVo } from '@club/shared';
import { dutyApi } from '@/api/ops';
import { memberApi } from '@/api/member';
import { useUserStore } from '@/stores/user';

const user = useUserStore();

const plans = ref<DutyPlanVo[]>([]);
const schedules = ref<DutyScheduleVo[]>([]);
const loading = ref(false);
const selectedPlan = ref<string>('');

const planDialog = ref(false);
const scheduleDialog = ref(false);
const submitting = ref(false);

const planForm = ref({
  name: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
});
const scheduleForm = ref({
  dutyDate: new Date().toISOString().slice(0, 10),
  startTime: '15:00',
  endTime: '17:00',
  location: '',
  memberId: '',
});
const memberOptions = ref<{ id: string; realName: string }[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    plans.value = await dutyApi.plans();
    if (selectedPlan.value === '' && plans.value.length > 0) {
      selectedPlan.value = plans.value[0]?.id ?? '';
    }
    const result = await dutyApi.schedules({
      planId: selectedPlan.value || undefined,
      page: 1,
      pageSize: 100,
    });
    schedules.value = result.list;
  } catch {
    schedules.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  if (user.hasPerm('member:read')) {
    try {
      const members = await memberApi.page({ page: 1, pageSize: 100 });
      memberOptions.value = members.list.map((m) => ({ id: m.id, realName: m.realName }));
    } catch {
      memberOptions.value = [];
    }
  }
});

async function onCreatePlan(): Promise<void> {
  if (planForm.value.name.trim().length < 2) {
    ElMessage.warning('请填写计划名称');
    return;
  }
  submitting.value = true;
  try {
    const plan = await dutyApi.createPlan({
      name: planForm.value.name.trim(),
      startDate: planForm.value.startDate,
      endDate: planForm.value.endDate,
    });
    await dutyApi.publishPlan(plan.id);
    ElMessage.success('值班计划已创建并发布');
    planDialog.value = false;
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

async function onCreateSchedule(): Promise<void> {
  if (selectedPlan.value === '') {
    ElMessage.warning('请先创建值班计划');
    return;
  }
  if (scheduleForm.value.memberId === '') {
    ElMessage.warning('请选择值班人');
    return;
  }
  if (scheduleForm.value.endTime <= scheduleForm.value.startTime) {
    ElMessage.warning('结束时间必须晚于开始时间');
    return;
  }
  submitting.value = true;
  try {
    await dutyApi.createSchedule({
      planId: selectedPlan.value,
      dutyDate: scheduleForm.value.dutyDate,
      startTime: scheduleForm.value.startTime,
      endTime: scheduleForm.value.endTime,
      location: scheduleForm.value.location.trim() || undefined,
      memberId: scheduleForm.value.memberId,
    });
    ElMessage.success('排班成功');
    scheduleDialog.value = false;
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

async function onConfirm(row: DutyScheduleVo): Promise<void> {
  try {
    await dutyApi.confirm(row.id);
    ElMessage.success('已确认班次');
    await load();
  } catch {
    // 拦截器已提示
  }
}

async function onWriteLog(row: DutyScheduleVo): Promise<void> {
  try {
    const content = await ElMessageBox.prompt('记录本次值班做了什么、发现了什么问题', '值班日志', {
      confirmButtonText: '下一步',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '如：整理器材柜，清点望远镜；1 支指星笔电量不足',
    });
    const handover = await ElMessageBox.prompt('需要交接给下一班的事项（可留空）', '交接事项', {
      confirmButtonText: '提交',
      cancelButtonText: '留空提交',
      inputPlaceholder: '如：指星笔需更换电池',
    }).catch(() => ({ value: '' }));

    await dutyApi.writeLog(row.id, {
      content: content.value,
      handoverContent: handover.value.trim() || undefined,
    });
    ElMessage.success('日志已记录，班次自动置为已完成');
    await load();
  } catch {
    // 用户取消或接口报错
  }
}

async function onAbsent(row: DutyScheduleVo): Promise<void> {
  try {
    await dutyApi.markAbsent(row.id);
    ElMessage.success('已标记缺勤');
    await load();
  } catch {
    // 拦截器已提示
  }
}

async function onPlanChange(): Promise<void> {
  await load();
}

const statusTagType = (status: number): 'warning' | 'primary' | 'success' | 'danger' | 'info' => {
  if (status === DutyStatus.PENDING) return 'warning';
  if (status === DutyStatus.CONFIRMED) return 'primary';
  if (status === DutyStatus.FINISHED) return 'success';
  if (status === DutyStatus.ABSENT) return 'danger';
  return 'info';
};
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">值班表</h1>
        <p class="page__desc">
          排班后由值班人本人确认；写完值班日志，班次自动置为已完成并记下实际时长。
        </p>
      </div>
      <div class="page__actions">
        <el-button v-perm="'duty:create'" @click="scheduleDialog = true">排班</el-button>
        <el-button v-perm="'duty:create'" type="primary" @click="planDialog = true">
          <el-icon><Plus /></el-icon>
          新建值班计划
        </el-button>
      </div>
    </header>

    <section class="panel panel--filters">
      <el-select v-model="selectedPlan" class="filter" placeholder="选择值班计划" @change="onPlanChange">
        <el-option v-for="p in plans" :key="p.id" :label="`${p.name}（${p.scheduleCount} 班）`" :value="p.id" />
      </el-select>
      <span v-if="plans.length === 0" class="muted">还没有值班计划，先新建一个</span>
    </section>

    <section v-if="loading && schedules.length === 0" class="panel"><el-skeleton :rows="5" animated /></section>

    <section v-else-if="schedules.length === 0" class="panel panel--empty">
      <el-empty description="这个计划下还没有排班" />
    </section>

    <section v-else class="panel panel--table">
      <el-table :data="schedules">
        <el-table-column label="日期" width="160">
          <template #default="{ row }">
            <span class="num">{{ row.dutyDate }}</span>
            <span class="weekday">{{ row.weekdayLabel }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时段" width="130">
          <template #default="{ row }"><span class="num">{{ row.startTime }} - {{ row.endTime }}</span></template>
        </el-table-column>
        <el-table-column label="值班人" width="140">
          <template #default="{ row }">
            {{ row.memberName }}
            <span class="muted">{{ row.deptName ?? '' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="地点" width="120">
          <template #default="{ row }">{{ row.location ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="plain" size="small">{{ row.statusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="实际时长" width="100" align="right">
          <template #default="{ row }">
            <span class="num">{{ row.actualMinutes === null ? '—' : `${row.actualMinutes} 分` }}</span>
          </template>
        </el-table-column>
        <el-table-column label="日志" width="80" align="right">
          <template #default="{ row }"><span class="num">{{ row.logCount }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.memberId === user.profile?.memberId && row.status === DutyStatus.PENDING"
              link
              type="primary"
              @click="onConfirm(row)"
            >
              确认班次
            </el-button>
            <el-button
              v-if="row.memberId === user.profile?.memberId && row.status !== DutyStatus.ABSENT"
              link
              type="primary"
              @click="onWriteLog(row)"
            >
              写日志
            </el-button>
            <el-button
              v-if="row.status !== DutyStatus.ABSENT && row.status !== DutyStatus.FINISHED"
              v-perm="'duty:update'"
              link
              type="danger"
              @click="onAbsent(row)"
            >
              缺勤
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="planDialog" title="新建值班计划" width="480px">
      <el-form label-width="88px">
        <el-form-item label="名称" required>
          <el-input v-model="planForm.name" maxlength="64" placeholder="如：2026 秋季值班表" />
        </el-form-item>
        <el-form-item label="开始日期" required>
          <el-date-picker v-model="planForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期" required>
          <el-date-picker v-model="planForm.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="planDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreatePlan">创建并发布</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="scheduleDialog" title="排班" width="480px">
      <el-form label-width="88px">
        <el-form-item label="值班人" required>
          <el-select v-model="scheduleForm.memberId" filterable placeholder="选择成员" style="width: 100%">
            <el-option v-for="m in memberOptions" :key="m.id" :label="m.realName" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="scheduleForm.dutyDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="时段" required>
          <div class="time-row">
            <el-input v-model="scheduleForm.startTime" style="width: 100px" />
            <span>至</span>
            <el-input v-model="scheduleForm.endTime" style="width: 100px" />
          </div>
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="scheduleForm.location" maxlength="64" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreateSchedule">排班</el-button>
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
  max-width: 72ch;
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

.panel--filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
}

.panel--table {
  padding: var(--sp-2) var(--sp-2) var(--sp-4);
}

.panel--empty {
  padding: var(--sp-8);
}

.filter {
  width: 280px;
}

.weekday {
  margin-left: var(--sp-2);
  font-size: 12px;
  color: var(--c-text-3);
}

.muted {
  color: var(--c-text-3);
  font-size: 12px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
</style>
