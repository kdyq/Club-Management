<script setup lang="ts">
/**
 * 收支流水。三种状态都处理：加载骨架、空状态区分筛选与否、错误面板。
 * 作废是**唯一**的「撤销」方式——列表里没有删除按钮，这是有意的。
 */
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { FundType, type FundAccountVo, type FundCategoryVo, type FundTransactionVo } from '@club/shared';
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
  onPageSizeChange,
} = useTable<FundTransactionVo, Record<string, unknown>>(
  (params) => fundApi.transactions(params),
  { defaultQuery: { page: 1, pageSize: 20 } },
);

const accounts = ref<FundAccountVo[]>([]);
const categories = ref<FundCategoryVo[]>([]);

onMounted(async () => {
  try {
    const [acc, cats] = await Promise.all([fundApi.accounts(), fundApi.categories()]);
    accounts.value = acc;
    categories.value = cats;
  } catch {
    // 下拉拿不到不影响列表
  }
});

// ---------- 登记收支 ----------
const dialogVisible = ref(false);
const submitting = ref(false);
const form = ref({
  accountId: '',
  categoryId: null as string | null,
  type: FundType.EXPENSE,
  amount: 0,
  title: '',
  occurredAt: new Date().toISOString().slice(0, 10),
  remark: '',
  needApproval: false,
});

function openCreate(): void {
  form.value = {
    accountId: accounts.value[0]?.id ?? '',
    categoryId: null,
    type: FundType.EXPENSE,
    amount: 0,
    title: '',
    occurredAt: new Date().toISOString().slice(0, 10),
    remark: '',
    needApproval: false,
  };
  dialogVisible.value = true;
}

/** 科目要跟收支方向对上，后端也会校验，前端先过滤一遍减少误操作 */
function categoriesOf(type: number): { id: string; name: string }[] {
  return categories.value.filter((c) => c.type === type).map((c) => ({ id: c.id, name: c.name }));
}

async function onCreate(): Promise<void> {
  if (form.value.title.trim().length < 2) {
    ElMessage.warning('请填写摘要');
    return;
  }
  if (form.value.amount <= 0) {
    ElMessage.warning('金额必须大于 0');
    return;
  }

  submitting.value = true;
  try {
    await fundApi.createTransaction({
      accountId: form.value.accountId,
      categoryId: form.value.categoryId,
      type: form.value.type,
      amount: form.value.amount,
      title: form.value.title.trim(),
      occurredAt: form.value.occurredAt,
      remark: form.value.remark.trim() || undefined,
      needApproval: form.value.needApproval,
    });
    ElMessage.success(form.value.needApproval ? '已提交审批，通过后才会入账' : '已登记并入账');
    dialogVisible.value = false;
    await reload();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

// ---------- 作废 ----------
async function onVoid(row: FundTransactionVo): Promise<void> {
  let reason: string;
  try {
    const input = await ElMessageBox.prompt(
      '财务流水不会被删除，只会标记为已作废并记下原因。要冲正请再记一笔反向流水。',
      `作废「${row.title}」`,
      { confirmButtonText: '确认作废', cancelButtonText: '取消', inputPlaceholder: '如：重复记账' },
    );
    reason = input.value;
    if (reason.trim().length < 2) {
      ElMessage.warning('请填写作废原因');
      return;
    }
  } catch {
    return;
  }
  try {
    await fundApi.voidTransaction(row.id, reason);
    ElMessage.success('已作废，原记录仍在库中可供审计');
    await reload();
  } catch {
    // 拦截器已提示
  }
}

function onSearch(): void {
  void reload();
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">收支流水</h1>
        <p class="page__desc">
          共 {{ total }} 条。金额一律存正数、方向由收支类型决定；流水只能作废不能删除，审计链不断。
        </p>
      </div>
      <el-button v-perm="'fund:create'" type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        登记收支
      </el-button>
    </header>

    <section class="panel panel--filters">
      <el-input
        v-model="query.keyword"
        class="filter"
        placeholder="搜索摘要"
        clearable
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select v-model="query.type" class="filter--sm" placeholder="收支" clearable>
        <el-option label="收入" :value="1" />
        <el-option label="支出" :value="2" />
      </el-select>
      <el-select v-model="query.status" class="filter--sm" placeholder="状态" clearable>
        <el-option label="待审批" :value="1" />
        <el-option label="已入账" :value="2" />
        <el-option label="已作废" :value="3" />
      </el-select>
      <el-date-picker
        v-model="query.dateFrom"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="起始日期"
        class="filter--date"
      />
      <el-date-picker
        v-model="query.dateTo"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="截止日期"
        class="filter--date"
      />
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button v-if="hasFilter" @click="reset">清空筛选</el-button>
    </section>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">流水加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="reload">重试</el-button>
    </section>

    <section v-else-if="loading && list.length === 0" class="panel">
      <el-skeleton :rows="6" animated />
    </section>

    <section v-else-if="list.length === 0" class="panel panel--empty">
      <el-empty :description="hasFilter ? '没有符合筛选条件的流水' : '还没有任何流水'">
        <el-button v-if="hasFilter" type="primary" @click="reset">清空筛选</el-button>
      </el-empty>
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="loading" :data="list" style="width: 100%">
        <el-table-column prop="occurredAt" label="日期" width="110" />
        <el-table-column label="摘要" min-width="200">
          <template #default="{ row }">
            <div class="cell-title">{{ row.title }}</div>
            <div v-if="row.voidReason" class="cell-sub cell-sub--danger">作废原因：{{ row.voidReason }}</div>
            <div v-else-if="row.remark" class="cell-sub">{{ row.remark }}</div>
          </template>
        </el-table-column>
        <el-table-column label="科目" width="120">
          <template #default="{ row }">{{ row.categoryName ?? '未分类' }}</template>
        </el-table-column>
        <el-table-column label="账户" width="130">
          <template #default="{ row }">{{ row.accountName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="金额" width="130" align="right">
          <template #default="{ row }">
            <span class="num" :class="row.type === 1 ? 'amount--in' : 'amount--out'">
              {{ row.type === 1 ? '+' : '-' }}{{ row.amount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.status === 2 ? 'success' : row.status === 1 ? 'warning' : 'info'"
              effect="plain"
              size="small"
            >
              {{ row.statusLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="经办" width="90">
          <template #default="{ row }">{{ row.handlerName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 3"
              v-perm="'fund:update'"
              link
              type="danger"
              @click="onVoid(row)"
            >
              作废
            </el-button>
            <span v-else class="muted">已作废</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          :current-page="query.page"
          :page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" title="登记收支" width="560px" :close-on-click-modal="false">
      <el-form label-width="88px">
        <el-form-item label="收支方向" required>
          <el-radio-group v-model="form.type" @change="form.categoryId = null">
            <el-radio :value="1">收入</el-radio>
            <el-radio :value="2">支出</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input-number v-model="form.amount" :min="0" :max="99999999" :precision="2" controls-position="right" />
        </el-form-item>
        <el-form-item label="摘要" required>
          <el-input v-model="form.title" maxlength="128" placeholder="如：购买指星笔与电池" />
        </el-form-item>
        <el-form-item label="科目">
          <el-select v-model="form.categoryId" clearable placeholder="未分类" style="width: 100%">
            <el-option
              v-for="c in categoriesOf(form.type)"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="账户" required>
          <el-select v-model="form.accountId" style="width: 100%">
            <el-option v-for="a in accounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="发生日期" required>
          <el-date-picker v-model="form.occurredAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
        <el-form-item label="走审批">
          <el-switch v-model="form.needApproval" />
          <span class="hint">开启后先提交审批，通过才计入余额</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onCreate">保存</el-button>
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
  width: 120px;
}

.filter--date {
  width: 150px;
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

.cell-sub--danger {
  color: var(--c-danger);
}

.amount--in {
  color: var(--c-ok);
  font-weight: 600;
}

.amount--out {
  color: var(--c-danger);
  font-weight: 600;
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

.hint {
  margin-left: var(--sp-2);
  font-size: 12px;
  color: var(--c-text-3);
}
</style>
