<script setup lang="ts">
/**
 * 数据对账。所有缓存字段（成员积分、预算已用、会费状态、物资可借数）都能按流水重算。
 * 这是财务类系统不可退让的底线能力，也是「缓存字段和明细不一致怎么办」的答案：
 * 准的永远是流水与明细表，缓存只是加速，随时可以重建。
 */
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fundApi } from '@/api/fund';

interface ReconcileBlock {
  checked: number;
  fixed: number;
  details: string[];
}

const running = ref(false);
const result = ref<{
  memberPoints?: ReconcileBlock;
  budgetUsed?: ReconcileBlock;
  feeStatus?: ReconcileBlock;
  assetQty?: ReconcileBlock;
  durationMs?: number;
  runAt?: string;
} | null>(null);

async function onRun(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '对账会按流水重算所有缓存字段，发现不一致就修正。它只读流水、只改缓存值，不会动任何流水与明细。',
      '执行数据对账',
      { confirmButtonText: '开始对账', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }

  running.value = true;
  try {
    result.value = await fundApi.reconcile();
    const totalFixed =
      (result.value.memberPoints?.fixed ?? 0) +
      (result.value.budgetUsed?.fixed ?? 0) +
      (result.value.feeStatus?.fixed ?? 0) +
      (result.value.assetQty?.fixed ?? 0);
    ElMessage.success(totalFixed === 0 ? '对账完成，未发现不一致' : `对账完成，修正了 ${totalFixed} 处不一致`);
  } catch {
    // 拦截器已提示
  } finally {
    running.value = false;
  }
}

const blocks = [
  { key: 'memberPoints', label: '成员积分', desc: '以 point_record 流水为准' },
  { key: 'budgetUsed', label: '预算已用金额', desc: '以已入账支出流水为准' },
  { key: 'feeStatus', label: '会费缴费状态', desc: '以已缴金额与应缴额比对' },
  { key: 'assetQty', label: '物资可借数量', desc: '以未归还借出数量为准' },
] as const;
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">数据对账</h1>
        <p class="page__desc">
          重算所有缓存字段。缓存只是加速手段，准的永远是流水与明细表——这一条是财务系统的底线。
        </p>
      </div>
      <el-button v-perm="'reconcile:update'" type="primary" :loading="running" @click="onRun">
        <el-icon><Refresh /></el-icon>
        执行对账
      </el-button>
    </header>

    <section class="panel">
      <h2 class="panel__title">对账范围</h2>
      <dl class="fields">
        <div v-for="block in blocks" :key="block.key">
          <dt>{{ block.label }}</dt>
          <dd>{{ block.desc }}</dd>
        </div>
      </dl>
      <p class="note">
        对账只读流水、只写缓存字段，不会修改或删除任何流水与明细，因此可以随时重复执行。
      </p>
    </section>

    <section v-if="result !== null" class="panel">
      <h2 class="panel__title">
        本次结果
        <span class="muted">
          {{ result.runAt ? new Date(result.runAt).toLocaleString('zh-CN') : '' }} · 耗时 {{ result.durationMs }}ms
        </span>
      </h2>

      <div class="results">
        <div v-for="block in blocks" :key="block.key" class="result-item">
          <div class="result-item__head">
            <span class="result-item__label">{{ block.label }}</span>
            <el-tag
              :type="(result[block.key]?.fixed ?? 0) > 0 ? 'warning' : 'success'"
              effect="plain"
              size="small"
            >
              {{ (result[block.key]?.fixed ?? 0) > 0 ? `修正 ${result[block.key]?.fixed} 处` : '一致' }}
            </el-tag>
          </div>
          <div class="result-item__meta">
            检查 {{ result[block.key]?.checked ?? 0 }} 条
          </div>
          <ul v-if="(result[block.key]?.details.length ?? 0) > 0" class="result-item__details">
            <li v-for="(line, index) in result[block.key]?.details ?? []" :key="index">{{ line }}</li>
          </ul>
        </div>
      </div>
    </section>
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

.panel__title {
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-2);
  margin-bottom: var(--sp-4);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--sp-4) var(--sp-6);
  margin: 0;
}

.fields dt {
  font-size: 13px;
  font-weight: 500;
}

.fields dd {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--c-text-3);
}

.note {
  margin-top: var(--sp-5);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-control);
  background: var(--c-surface-sunken);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--c-text-2);
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--sp-4);
}

.result-item {
  padding: var(--sp-4);
  border: 1px solid var(--c-border);
  border-radius: var(--r-control);
}

.result-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}

.result-item__label {
  font-size: 13.5px;
  font-weight: 500;
}

.result-item__meta {
  margin-top: var(--sp-1);
  font-size: 12px;
  color: var(--c-text-3);
}

.result-item__details {
  margin: var(--sp-2) 0 0;
  padding-left: 1.1em;
  font-size: 12px;
  line-height: 1.7;
  color: var(--c-text-2);
}

.muted {
  font-size: 12px;
  font-weight: 400;
  color: var(--c-text-3);
}
</style>
