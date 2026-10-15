<script setup lang="ts">
/**
 * 会费管理。三段：标准（含应缴名单生成）、应缴明细（登记缴费）、欠费统计（催缴）。
 * 登记缴费会同时派生一笔收入流水，两者在同一事务内，所以缴费记录与账面天然一致。
 */
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { FEE_STATUS_LABEL, FeeStatus, type FeeStandardVo, type MemberFeeVo } from '@club/shared';
import { fundApi } from '@/api/fund';
import { useTable } from '@/composables/useTable';

const activeTab = ref('fees');
void activeTab;

// ---------- 标准 ----------
const standards = ref<FeeStandardVo[]>([]);
const selectedStandard = ref<string>('');
const standardDialog = ref(false);
const submittingStandard = ref(false);
const standardForm = ref({
  name: '',
  amount: 50,
  dueDate: new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  targetType: 1,
});
const targetIds = ref<string[]>([]);

async function loadStandards(): Promise<void> {
  try {
    standards.value = await fundApi.feeStandards();
    if (selectedStandard.value === '' && standards.value.length > 0) {
      selectedStandard.value = standards.value[0]?.id ?? '';
    }
  } catch {
    standards.value = [];
  }
}

onMounted(async () => {
  await loadStandards();
  await loadFees();
  await loadArrears();
});

async function onCreateStandard(): Promise<void> {
  if (standardForm.value.name.trim().length < 2) {
    ElMessage.warning('请填写会费名称');
    return;
  }
  submittingStandard.value = true;
  try {
    const result = await fundApi.createFeeStandard({
      name: standardForm.value.name.trim(),
      amount: standardForm.value.amount,
      dueDate: standardForm.value.dueDate,
      targetType: standardForm.value.targetType,
      targetIds: standardForm.value.targetType === 1 ? undefined : targetIds.value,
    });
    ElMessage.success(`已生成 ${result.totalCount} 条应缴记录`);
    standardDialog.value = false;
    await loadStandards();
    await loadFees();
    await loadArrears();
  } catch {
    // 拦截器已提示
  } finally {
    submittingStandard.value = false;
  }
}

// ---------- 应缴明细 ----------
const {
  list: fees,
  total: feeTotal,
  loading: feeLoading,
  error: feeError,
  query: feeQuery,
  reload: reloadFees,
  onPageChange: onFeePageChange,
} = useTable<MemberFeeVo, Record<string, unknown>>(
  (params) => fundApi.fees(params),
  { defaultQuery: { page: 1, pageSize: 20 }, immediate: false },
);

const loadFees = reloadFees;
void loadFees;

async function onFilterFees(): Promise<void> {
  if (selectedStandard.value !== '') {
    feeQuery.value.feeStandardId = selectedStandard.value;
  }
  await reloadFees();
}

const feeStatusOptions = Object.entries(FEE_STATUS_LABEL)
  .filter(([value]) => Number(value) !== FeeStatus.WAIVED)
  .map(([value, label]) => ({ value: Number(value), label }));

async function onPay(row: MemberFeeVo): Promise<void> {
  const remain = Number(row.shouldAmount) - Number(row.paidAmount);
  submitting.value = true;
  try {
    const input = await ElMessageBox.prompt(
      `应缴 ${row.shouldAmount}，已缴 ${row.paidAmount}，本次最多可缴 ${remain.toFixed(2)}`,
      `登记缴费 · ${row.memberName}`,
      {
        confirmButtonText: '确认收款',
        cancelButtonText: '取消',
        inputValue: remain.toFixed(2),
        inputPattern: /^\d+(\.\d{1,2})?$/,
        inputErrorMessage: '请输入合法的金额',
      },
    );
    const amount = Number(input.value);
    const methodPick = await ElMessageBox.prompt('收款方式：1 现金 / 2 微信 / 3 支付宝 / 4 银行转账', '收款方式', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputValue: '2',
      inputPattern: /^[1-4]$/,
      inputErrorMessage: '请输入 1-4',
    });

    const result = await fundApi.pay(row.id, {
      paidAmount: amount,
      payMethod: Number(methodPick.value),
    });
    ElMessage.success(
      result.transactionId !== null
        ? `已收款，并自动生成收入流水 #${result.transactionId}`
        : '已收款（未生成流水）',
    );
    await reloadFees();
    await loadStandards();
    await loadArrears();
  } catch {
    // 用户取消或接口报错
  } finally {
    submitting.value = false;
  }
}

async function onWaive(row: MemberFeeVo): Promise<void> {
  try {
    const input = await ElMessageBox.prompt('请填写减免原因', `减免 · ${row.memberName}`, {
      confirmButtonText: '确认减免',
      cancelButtonText: '取消',
    });
    await fundApi.waive(row.id, input.value);
    ElMessage.success('已减免');
    await reloadFees();
    await loadArrears();
  } catch {
    // 用户取消或接口报错
  }
}

const submitting = ref(false);

// ---------- 欠费统计 ----------
const arrears = ref<Awaited<ReturnType<typeof fundApi.arrears>> | null>(null);

async function loadArrears(): Promise<void> {
  try {
    arrears.value = await fundApi.arrears(selectedStandard.value === '' ? undefined : selectedStandard.value);
  } catch {
    arrears.value = null;
  }
}

async function onRemind(): Promise<void> {
  if (selectedStandard.value === '') {
    ElMessage.warning('请先选择会费标准');
    return;
  }
  try {
    const result = await fundApi.remind(selectedStandard.value);
    if (result.skipped) {
      ElMessage.info('这份会费标准已经催缴过了，没有重复发送');
    } else {
      ElMessage.success(`已给 ${result.notified} 人发送站内信催缴`);
    }
  } catch {
    // 拦截器已提示
  }
}

const currentStandard = computed(() =>
  standards.value.find((item) => item.id === selectedStandard.value) ?? null,
);
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">会费管理</h1>
        <p class="page__desc">
          建标准即生成应缴名单；登记缴费时会自动派生一笔收入流水，保证缴费记录与账面一致。
        </p>
      </div>
      <el-button v-perm="'fee:create'" type="primary" @click="standardDialog = true">
        <el-icon><Plus /></el-icon>
        新建会费标准
      </el-button>
    </header>

    <section class="panel">
      <div class="std-row">
        <el-select v-model="selectedStandard" class="std-select" placeholder="选择会费标准" @change="onFilterFees(); loadArrears();">
          <el-option v-for="s in standards" :key="s.id" :label="`${s.name}（¥${s.amount}）`" :value="s.id" />
        </el-select>
        <el-button v-if="currentStandard" v-perm="'fee:update'" @click="onRemind">
          <el-icon><Bell /></el-icon>
          催缴未缴
        </el-button>
      </div>

      <div v-if="currentStandard" class="std-meta">
        <span>截止 {{ currentStandard.dueDate }}</span>
        <span>应缴 {{ currentStandard.totalCount }} 人</span>
        <span>已缴清 {{ currentStandard.paidCount }} 人</span>
        <span>实收 ¥{{ currentStandard.paidAmount }} / 应收 ¥{{ currentStandard.shouldAmount }}</span>
      </div>

      <div v-if="arrears" class="arrears">
        <div class="arrears__item">
          <div class="arrears__value num">{{ arrears.unpaidCount }}</div>
          <div class="arrears__label">未缴</div>
        </div>
        <div class="arrears__item">
          <div class="arrears__value num">{{ arrears.partialCount }}</div>
          <div class="arrears__label">部分缴纳</div>
        </div>
        <div class="arrears__item">
          <div class="arrears__value num">{{ arrears.paidCount }}</div>
          <div class="arrears__label">已缴清</div>
        </div>
        <div class="arrears__item">
          <div class="arrears__value num">{{ arrears.waivedCount }}</div>
          <div class="arrears__label">已减免</div>
        </div>
        <div class="arrears__item arrears__item--outstanding">
          <div class="arrears__value num">¥{{ arrears.outstandingTotal }}</div>
          <div class="arrears__label">欠费合计</div>
        </div>
      </div>
    </section>

    <section class="panel panel--filters">
      <el-select v-model="feeQuery.status" class="filter--sm" placeholder="缴费状态" clearable @change="onFilterFees">
        <el-option v-for="opt in feeStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-input
        v-model="feeQuery.keyword"
        class="filter"
        placeholder="搜索姓名"
        clearable
        @keyup.enter="onFilterFees"
        @clear="onFilterFees"
      />
      <el-button type="primary" @click="onFilterFees">查询</el-button>
    </section>

    <section v-if="feeError !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">应缴明细加载失败</div>
        <div class="panel--error__desc">{{ feeError }}</div>
      </div>
      <el-button @click="reloadFees">重试</el-button>
    </section>

    <section v-else-if="feeLoading && fees.length === 0" class="panel"><el-skeleton :rows="5" animated /></section>

    <section v-else-if="fees.length === 0" class="panel panel--empty">
      <el-empty description="还没有应缴记录。先新建一份会费标准。" />
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="feeLoading" :data="fees" style="width: 100%">
        <el-table-column prop="memberName" label="成员" width="120" />
        <el-table-column label="部门" width="110">
          <template #default="{ row }">{{ row.deptName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="应缴" width="100" align="right">
          <template #default="{ row }"><span class="num">{{ row.shouldAmount }}</span></template>
        </el-table-column>
        <el-table-column label="已缴" width="100" align="right">
          <template #default="{ row }"><span class="num">{{ row.paidAmount }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag
              :type="row.status === FeeStatus.PAID ? 'success' : row.status === FeeStatus.PARTIAL ? 'warning' : row.status === FeeStatus.WAIVED ? 'info' : 'danger'"
              effect="plain"
              size="small"
            >
              {{ row.statusLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="缴费方式" width="100">
          <template #default="{ row }">{{ row.payMethodLabel ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="缴费时间" width="170">
          <template #default="{ row }">
            <span class="num">{{ row.paidAt ? new Date(row.paidAt).toLocaleString('zh-CN') : '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === FeeStatus.UNPAID || row.status === FeeStatus.PARTIAL">
              <el-button v-perm="'fee:update'" link type="primary" :disabled="submitting" @click="onPay(row)">
                登记缴费
              </el-button>
              <el-button v-perm="'fee:update'" link @click="onWaive(row)">减免</el-button>
            </template>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          :current-page="feeQuery.page"
          :page-size="feeQuery.pageSize"
          :total="feeTotal"
          layout="total, prev, pager, next"
          background
          @current-change="onFeePageChange"
        />
      </div>
    </section>

    <el-dialog v-model="standardDialog" title="新建会费标准" width="520px">
      <el-form label-width="96px">
        <el-form-item label="名称" required>
          <el-input v-model="standardForm.name" maxlength="64" placeholder="如：2026-2027 学年会费" />
        </el-form-item>
        <el-form-item label="每人金额" required>
          <el-input-number v-model="standardForm.amount" :min="1" :max="99999" :precision="2" controls-position="right" />
        </el-form-item>
        <el-form-item label="截止日期" required>
          <el-date-picker v-model="standardForm.dueDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="适用范围">
          <el-radio-group v-model="standardForm.targetType">
            <el-radio :value="1">全体在册成员</el-radio>
            <el-radio :value="2">指定部门</el-radio>
            <el-radio :value="3">指定成员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="standardForm.targetType !== 1"
        type="info"
        :closable="false"
        title="指定范围请在创建后用导入或成员页配合处理；当前版本建议先按全体生成，再对个别成员减免。"
      />
      <template #footer>
        <el-button @click="standardDialog = false">取消</el-button>
        <el-button type="primary" :loading="submittingStandard" @click="onCreateStandard">创建并生成名单</el-button>
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

.panel--table {
  padding: var(--sp-2) var(--sp-2) var(--sp-4);
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

.std-row {
  display: flex;
  gap: var(--sp-3);
  align-items: center;
}

.std-select {
  width: 300px;
}

.std-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-5);
  margin-top: var(--sp-4);
  font-size: 13px;
  color: var(--c-text-2);
}

.arrears {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: var(--sp-5);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border);
}

.arrears__item {
  padding: 0 var(--sp-4);
  border-left: 1px solid var(--c-border);
}

.arrears__item:first-child {
  padding-left: 0;
  border-left: none;
}

.arrears__value {
  font-size: 20px;
  font-weight: 700;
}

.arrears__item--outstanding .arrears__value {
  color: var(--c-danger);
}

.arrears__label {
  font-size: 12.5px;
  color: var(--c-text-2);
}

.muted {
  color: var(--c-text-3);
  font-size: 12.5px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: var(--sp-4) var(--sp-4) 0;
}

@media (max-width: 900px) {
  .arrears {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-4) 0;
  }

  .arrears__item:nth-child(odd) {
    padding-left: 0;
    border-left: none;
  }
}
</style>
