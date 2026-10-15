<script setup lang="ts">
/**
 * 财务公示页。所有数字都来自 /fund/overview 的实时汇总：
 * 余额由流水算出，科目构成与月度趋势也是流水聚合的结果，没有任何预置的展示值。
 */
import { computed, onMounted, ref } from 'vue';
import type { FundOverviewVo } from '@club/shared';
import { fundApi } from '@/api/fund';

const loading = ref(true);
const error = ref<string | null>(null);
const overview = ref<FundOverviewVo | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    overview.value = await fundApi.overview();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const metrics = computed(() => {
  const o = overview.value;
  if (o === null) return [];
  return [
    { label: '当前余额', value: `¥${o.totalBalance}`, hint: '由流水实时汇总' },
    { label: '累计收入', value: `¥${o.totalIncome}`, hint: '' },
    { label: '累计支出', value: `¥${o.totalExpense}`, hint: '' },
    { label: '本月收入', value: `¥${o.monthIncome}`, hint: '' },
    { label: '本月支出', value: `¥${o.monthExpense}`, hint: '' },
  ];
});

/** 科目构成按最大值归一化，用条形长度对比 */
const expenseBars = computed(() => {
  const rows = overview.value?.expenseByCategory ?? [];
  const max = Math.max(1, ...rows.map((r) => Number(r.amount)));
  return rows.map((r) => ({ ...r, percent: Math.round((Number(r.amount) / max) * 100) }));
});

/** 月度趋势同样按最大值归一化，收入支出并排 */
const trendBars = computed(() => {
  const rows = overview.value?.monthlyTrend ?? [];
  const max = Math.max(1, ...rows.flatMap((r) => [Number(r.income), Number(r.expense)]));
  return rows.map((r) => ({
    month: r.month,
    income: Number(r.income),
    expense: Number(r.expense),
    incomePercent: Math.round((Number(r.income) / max) * 100),
    expensePercent: Math.round((Number(r.expense) / max) * 100),
  }));
});
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">财务公示</h1>
        <p class="page__desc">
          账目公开是社团经费管理的基本要求。这里所有数字都由流水实时算出，不是预先存好的余额。
        </p>
      </div>
    </header>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">公示数据加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="load">重试</el-button>
    </section>

    <section v-else-if="loading" class="panel"><el-skeleton :rows="5" animated /></section>

    <template v-else-if="overview !== null">
      <section class="panel">
        <div class="metrics">
          <div v-for="item in metrics" :key="item.label" class="metric">
            <div class="metric__value num">{{ item.value }}</div>
            <div class="metric__label">{{ item.label }}</div>
            <div v-if="item.hint !== ''" class="metric__hint">{{ item.hint }}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">账户</h2>
        <el-table :data="overview.accounts" size="small">
          <el-table-column prop="name" label="账户" min-width="160" />
          <el-table-column label="期初" width="120" align="right">
            <template #default="{ row }"><span class="num">{{ row.initialAmount }}</span></template>
          </el-table-column>
          <el-table-column label="收入" width="120" align="right">
            <template #default="{ row }"><span class="num amount--in">{{ row.incomeTotal }}</span></template>
          </el-table-column>
          <el-table-column label="支出" width="120" align="right">
            <template #default="{ row }"><span class="num amount--out">{{ row.expenseTotal }}</span></template>
          </el-table-column>
          <el-table-column label="余额" width="130" align="right">
            <template #default="{ row }">
              <span class="num balance">{{ row.balance }}</span>
            </template>
          </el-table-column>
          <el-table-column label="流水数" width="90" align="right">
            <template #default="{ row }"><span class="num">{{ row.transactionCount }}</span></template>
          </el-table-column>
        </el-table>
      </section>

      <section class="panel">
        <h2 class="panel__title">支出构成</h2>
        <div v-if="expenseBars.length === 0" class="empty-hint">还没有支出记录</div>
        <div v-else class="bars">
          <div v-for="row in expenseBars" :key="row.categoryId ?? 'none'" class="bar-row">
            <div class="bar-row__label">{{ row.categoryName }}</div>
            <div class="bar-row__track">
              <div class="bar-row__fill" :style="{ width: `${row.percent}%` }" />
            </div>
            <div class="bar-row__value num">¥{{ row.amount }}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">近 6 个月收支</h2>
        <div class="trend">
          <div v-for="row in trendBars" :key="row.month" class="trend__col">
            <div class="trend__bars">
              <div class="trend__bar trend__bar--in" :style="{ height: `${row.incomePercent}%` }" :title="`收入 ${row.income}`" />
              <div class="trend__bar trend__bar--out" :style="{ height: `${row.expensePercent}%` }" :title="`支出 ${row.expense}`" />
            </div>
            <div class="trend__month">{{ row.month.slice(5) }}月</div>
          </div>
        </div>
        <div class="legend">
          <span><i class="dot dot--in" />收入</span>
          <span><i class="dot dot--out" />支出</span>
        </div>
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.metric {
  padding: 0 var(--sp-5);
  border-left: 1px solid var(--c-border);
}

.metric:first-child {
  padding-left: 0;
  border-left: none;
}

.metric__value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
}

.metric__label {
  margin-top: var(--sp-1);
  font-size: 13px;
  color: var(--c-text-2);
}

.metric__hint {
  font-size: 11.5px;
  color: var(--c-text-3);
}

.amount--in {
  color: var(--c-ok);
}

.amount--out {
  color: var(--c-danger);
}

.balance {
  font-weight: 700;
}

.bars {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.bar-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 110px;
  align-items: center;
  gap: var(--sp-3);
}

.bar-row__label {
  font-size: 13px;
  color: var(--c-text-2);
}

.bar-row__track {
  height: 8px;
  border-radius: 4px;
  background: var(--c-neutral-tint);
  overflow: hidden;
}

.bar-row__fill {
  height: 100%;
  background: var(--c-accent);
}

.bar-row__value {
  text-align: right;
  font-size: 13px;
}

.empty-hint {
  font-size: 13px;
  color: var(--c-text-3);
}

.trend {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-5);
  height: 160px;
  padding-bottom: var(--sp-2);
}

.trend__col {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
}

.trend__bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 100%;
}

.trend__bar {
  flex: 1;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
}

.trend__bar--in {
  background: var(--c-ok);
}

.trend__bar--out {
  background: var(--c-danger);
}

.trend__month {
  margin-top: var(--sp-2);
  text-align: center;
  font-size: 12px;
  color: var(--c-text-3);
}

.legend {
  display: flex;
  gap: var(--sp-4);
  margin-top: var(--sp-3);
  font-size: 12.5px;
  color: var(--c-text-2);
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: var(--sp-1);
}

.dot--in {
  background: var(--c-ok);
}

.dot--out {
  background: var(--c-danger);
}

@media (max-width: 900px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-4) 0;
  }

  .metric:nth-child(odd) {
    padding-left: 0;
    border-left: none;
  }
}
</style>
