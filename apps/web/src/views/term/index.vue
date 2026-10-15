<script setup lang="ts">
/**
 * 届次管理。届次是成员归属的时间维度：换届时新建一个届次并切为当前届次，
 * 上一届的记录随之归档，成员与活动都不会被覆盖。
 */
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { termApi, type TermVo } from '@/api/member';

const list = ref<TermVo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const dialogVisible = ref(false);
const submitting = ref(false);
const form = ref({ name: '', startDate: '', endDate: '' });

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    list.value = await termApi.list();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openCreate(): void {
  const year = new Date().getFullYear();
  form.value = {
    name: `${year}-${year + 1} 学年`,
    startDate: `${year}-09-01`,
    endDate: `${year + 1}-08-31`,
  };
  dialogVisible.value = true;
}

async function onSubmit(): Promise<void> {
  if (form.value.name.trim() === '' || form.value.startDate === '' || form.value.endDate === '') {
    ElMessage.warning('请填写完整的届次名称与起止日期');
    return;
  }
  submitting.value = true;
  try {
    await termApi.create({
      name: form.value.name.trim(),
      startDate: form.value.startDate,
      endDate: form.value.endDate,
    });
    ElMessage.success('届次已创建，需要手动切换为当前届次');
    dialogVisible.value = false;
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

async function onSetCurrent(row: TermVo): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `把「${row.name}」设为当前届次？此后新增成员都会挂到这个届次下。`,
      '切换当前届次',
      { confirmButtonText: '切换', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await termApi.setCurrent(row.id);
    ElMessage.success(`已切换到「${row.name}」，重新登录后生效`);
    await load();
  } catch {
    // 拦截器已提示
  }
}

async function onArchive(row: TermVo): Promise<void> {
  try {
    await termApi.update(row.id, { status: 2 });
    ElMessage.success(`「${row.name}」已归档`);
    await load();
  } catch {
    // 拦截器已提示
  }
}

async function onRemove(row: TermVo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除届次「${row.name}」吗？`, '删除届次', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await termApi.remove(row.id);
    ElMessage.success('届次已删除');
    await load();
  } catch {
    // 当前届次或有成员时会拒绝
  }
}

const currentTerm = computed(() => list.value.find((item) => item.isCurrent) ?? null);
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">届次管理</h1>
        <p class="page__desc">
          当前届次：<b>{{ currentTerm?.name ?? '未设置' }}</b>
          <span v-if="currentTerm" class="muted">（{{ currentTerm.memberCount }} 名成员）</span>
        </p>
      </div>
      <el-button v-perm="'term:create'" type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新增届次
      </el-button>
    </header>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">届次列表加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="load">重试</el-button>
    </section>

    <section v-else-if="loading && list.length === 0" class="panel">
      <el-skeleton :rows="4" animated />
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="loading" :data="list" style="width: 100%">
        <el-table-column label="届次" min-width="180">
          <template #default="{ row }">
            <span class="term-name">{{ row.name }}</span>
            <el-tag v-if="row.isCurrent" class="term-current" type="primary" size="small" effect="plain">
              当前
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="起止" width="220">
          <template #default="{ row }">
            <span class="num">{{ row.startDate }} ~ {{ row.endDate }}</span>
          </template>
        </el-table-column>
        <el-table-column label="成员数" width="90" align="right">
          <template #default="{ row }"><span class="num">{{ row.memberCount }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="plain" size="small">
              {{ row.statusLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-perm="'term:update'"
              link
              type="primary"
              :disabled="row.isCurrent || row.status === 2"
              @click="onSetCurrent(row)"
            >
              设为当前
            </el-button>
            <el-button
              v-perm="'term:update'"
              link
              type="primary"
              :disabled="row.isCurrent || row.status === 2"
              @click="onArchive(row)"
            >
              归档
            </el-button>
            <el-button
              v-perm="'term:delete'"
              link
              type="danger"
              :disabled="row.isCurrent"
              @click="onRemove(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" title="新增届次" width="460px">
      <el-form label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="32" />
        </el-form-item>
        <el-form-item label="开始日期" required>
          <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束日期" required>
          <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">创建</el-button>
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

.panel--table {
  padding: var(--sp-2);
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

.term-name {
  font-weight: 500;
}

.term-current {
  margin-left: var(--sp-2);
}

.muted {
  color: var(--c-text-3);
  font-size: 12.5px;
}
</style>
