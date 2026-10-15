<script setup lang="ts">
/** 预算与执行率。执行率由已入账支出流水实时算出，待审批的支出不计入。 */
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { BUDGET_STATUS_LABEL, BudgetStatus, type FundBudgetVo, type FundCategoryVo } from '@club/shared';
import { fundApi } from '@/api/fund';
import { useTable } from '@/composables/useTable';

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
} = useTable<FundBudgetVo, Record<string, unknown>>(
  (params) => fundApi.budgets(params),
  { defaultQuery: { page: 1, pageSize: 20 } },
);

const categories = ref<FundCategoryVo[]>([]);
onMounted(async () => {
  try {
    categories.value = await fundApi.categories();
  } catch {
    categories.value = [];
  }
});

const statusOptions = Object.entries(BUDGET_STATUS_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));

const dialogVisible = ref(false);
const submitting = ref(false);
const form = ref({
  name: '',
  amount: 0,
  categoryId: null as string | null,
  periodStart: '',
  periodEnd: '',
});

function openCreate(): void {
  form.value = { name: '', amount: 0, categoryId: null, periodStart: '', periodEnd: '' };
  dialogVisible.value = true;
}

async function onCreate(): Promise<void> {
  if (form.value.name.trim().length < 2) {
    ElMessage.warning('请填写预算名称');
    return;
  }
  if (form.value.amount <= 0) {
    ElMessage.warning('预算金额必须大于 0');
    return;
  }
  submitting.value = true;
  try {
    await fundApi.createBudget({
      name: form.value.name.trim(),
      amount: form.value.amount,
      categoryId: form.value.categoryId,
      periodStart: form.value.periodStart === '' ? undefined : form.value.periodStart,
      periodEnd: form.value.periodEnd === '' ? undefined : form.value.periodEnd,
    });
    ElMessage.success('预算已创建为草稿，请提交审批');
    dialogVisible.value = false;
    await reload();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

async function onSubmit(row: FundBudgetVo): Promise<void> {
  try {
    await fundApi.submitBudget(row.id);
    ElMessage.success('已提交预算审批');
    await reload();
  } catch {
    // 拦截器已提示
  }
}

async function onClose(row: FundBudgetVo): Promise<void> {
  try {
    await fundApi.closeBudget(row.id);
    ElMessage.success('预算已关闭');
    await reload();
  } catch {
    // 拦截器已提示
  }
}

function rateTagType(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 100) return 'danger';
  if (rate >= 80) return 'warning';
  return 'success';
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">预算管理</h1>
        <p class="page__desc">
          共 {{ total }} 条。执行率由该科目下**已入账**的支出流水实时算出，待审批的不计入。
        </p>
      </div>
      <el-button v-perm="'budget:create'" type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新建预算
      </el-button>
    </header>

    <section class="panel panel--filters">
      <el-input v-model="query.keyword" class="filter" placeholder="搜索预算名称" clearable @keyup.enter="reload" @clear="reload" />
      <el-select v-model="query.status" class="filter--sm" placeholder="状态" clearable>
        <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-button v-if="hasFilter" @click="reset">清空筛选</el-button>
    </section>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">预算加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="reload">重试</el-button>
    </section>

    <section v-else-if="loading && list.length === 0" class="panel"><el-skeleton :rows="5" animated /></section>

    <section v-else-if="list.length === 0" class="panel panel--empty">
      <el-empty :description="hasFilter ? '没有符合条件的预算' : '还没有预算'">
        <el-button v-if="hasFilter" type="primary" @click="reset">清空筛选</el-button>
      </el-empty>
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="loading" :data="list" style="width: 100%">
        <el-table-column label="预算" min-width="200">
          <template #default="{ row }">
            <div class="cell-title">{{ row.name }}</div>
            <div class="cell-sub">
              {{ row.categoryName ?? '未指定科目' }}
              <span v-if="row.periodStart"> · {{ row.periodStart }} ~ {{ row.periodEnd ?? '不限' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="预算额" width="120" align="right">
          <template #default="{ row }"><span class="num">¥{{ row.amount }}</span></template>
        </el-table-column>
        <el-table-column label="已用" width="120" align="right">
          <template #default="{ row }"><span class="num">¥{{ row.usedAmount }}</span></template>
        </el-table-column>
        <el-table-column label="执行率" width="180">
          <template #default="{ row }">
            <div class="rate">
              <div class="rate__track">
                <div
                  class="rate__fill"
                  :class="`rate__fill--${rateTagType(row.executionRate)}`"
                  :style="{ width: `${Math.min(100, row.executionRate)}%` }"
                />
              </div>
              <span class="num rate__value">{{ row.executionRate }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.status === BudgetStatus.APPROVED ? 'success' : row.status === BudgetStatus.PENDING ? 'warning' : row.status === BudgetStatus.REJECTED ? 'danger' : 'info'"
              effect="plain"
              size="small"
            >
              {{ row.statusLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === BudgetStatus.DRAFT || row.status === BudgetStatus.REJECTED"
              v-perm="'budget:update'"
              link
              type="primary"
              @click="onSubmit(row)"
            >
              提交审批
            </el-button>
            <el-button
              v-if="row.status === BudgetStatus.APPROVED"
              v-perm="'budget:update'"
              link
              @click="onClose(row)"
            >
              关闭
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :total="total"
          layout="total, prev, pager, next"
          background
          @current-change="onPageChange"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" title="新建预算" width="520px">
      <el-form label-width="88px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="64" placeholder="如：本学期活动物料预算" />
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input-number v-model="form.amount" :min="0" :max="9999999" :precision="2" controls-position="right" />
        </el-form-item>
        <el-form-item label="科目">
          <el-select v-model="form.categoryId" clearable placeholder="不限定科目则按期间统计" style="width: 100%">
            <el-option
              v-for="c in categories.filter((x) => x.type === 2)"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="期间起">
          <el-date-picker v-model="form.periodStart" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="期间止">
          <el-date-picker v-model="form.periodEnd" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreate">创建</el-button>
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
  width: 240px;
}

.filter--sm {
  width: 130px;
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

.cell-title {
  font-weight: 500;
}

.cell-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--c-text-3);
}

.rate {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.rate__track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--c-neutral-tint);
  overflow: hidden;
}

.rate__fill {
  height: 100%;
}

.rate__fill--success {
  background: var(--c-ok);
}

.rate__fill--warning {
  background: var(--c-warn);
}

.rate__fill--danger {
  background: var(--c-danger);
}

.rate__value {
  font-size: 12.5px;
  color: var(--c-text-2);
  white-space: nowrap;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: var(--sp-4) var(--sp-4) 0;
}
</style>
