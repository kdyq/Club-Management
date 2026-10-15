<script setup lang="ts">
/**
 * 部门管理。用 el-table 的树形展示，row-key 用 id、children 用后端返回的 children。
 * 删除的约束（有子部门或有成员）由后端判定并给出可读原因，前端只负责展示。
 */
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { DepartmentNodeVo } from '@club/shared';
import { departmentApi } from '@/api/member';
import { useUserStore } from '@/stores/user';

const user = useUserStore();

const tree = ref<DepartmentNodeVo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const submitting = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  parentId: null as string | null,
  description: '',
  sort: 0,
});

/** 上级候选：编辑时要把自己和自己的子孙排除，否则必然成环 */
const parentOptions = computed(() => {
  const flat: { id: string; name: string; depth: number }[] = [];
  const walk = (nodes: DepartmentNodeVo[], depth: number, skipId: string | null): void => {
    for (const node of nodes) {
      if (node.id === skipId) continue;
      flat.push({ id: node.id, name: node.name, depth });
      walk(node.children ?? [], depth + 1, skipId);
    }
  };
  walk(tree.value, 0, dialogMode.value === 'edit' ? editingId.value : null);
  return flat;
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    tree.value = await departmentApi.tree(true);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openCreate(parentId: string | null): void {
  dialogMode.value = 'create';
  editingId.value = null;
  form.value = { name: '', parentId, description: '', sort: 0 };
  dialogVisible.value = true;
}

function openEdit(row: DepartmentNodeVo): void {
  dialogMode.value = 'edit';
  editingId.value = row.id;
  form.value = {
    name: row.name,
    parentId: row.parentId,
    description: row.description ?? '',
    sort: row.sort,
  };
  dialogVisible.value = true;
}

async function onSubmit(): Promise<void> {
  if (form.value.name.trim().length < 2) {
    ElMessage.warning('部门名称至少 2 个字');
    return;
  }
  submitting.value = true;
  try {
    if (dialogMode.value === 'create') {
      await departmentApi.create({
        name: form.value.name.trim(),
        parentId: form.value.parentId,
        description: form.value.description.trim() || undefined,
        sort: form.value.sort,
      });
      ElMessage.success('部门已创建');
    } else if (editingId.value !== null) {
      await departmentApi.update(editingId.value, {
        name: form.value.name.trim(),
        parentId: form.value.parentId,
        description: form.value.description.trim() || undefined,
        sort: form.value.sort,
      });
      ElMessage.success('部门已更新');
    }
    dialogVisible.value = false;
    await load();
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false;
  }
}

async function onRemove(row: DepartmentNodeVo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除部门「${row.name}」吗？`, '删除部门', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await departmentApi.remove(row.id);
    ElMessage.success('部门已删除');
    await load();
  } catch {
    // 有子部门或有成员时后端会拒绝并说明原因
  }
}

const title = computed(() => (dialogMode.value === 'create' ? '新增部门' : '编辑部门'));
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">部门管理</h1>
        <p class="page__desc">
          部门是数据范围「本部门 / 本部门及以下」的判定基础，层级改动会影响这两档权限的可见范围。
        </p>
      </div>
      <el-button v-perm="'department:create'" type="primary" @click="openCreate(null)">
        <el-icon><Plus /></el-icon>
        新增顶级部门
      </el-button>
    </header>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">部门树加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="load">重试</el-button>
    </section>

    <section v-else-if="loading && tree.length === 0" class="panel">
      <el-skeleton :rows="5" animated />
    </section>

    <section v-else-if="tree.length === 0" class="panel panel--empty">
      <el-empty description="还没有任何部门">
        <el-button v-if="user.hasPerm('department:create')" type="primary" @click="openCreate(null)">
          新增第一个部门
        </el-button>
      </el-empty>
    </section>

    <section v-else class="panel panel--table">
      <el-table
        v-loading="loading"
        :data="tree"
        row-key="id"
        default-expand-all
        :tree-props="{ children: 'children' }"
        style="width: 100%"
      >
        <el-table-column prop="name" label="部门" min-width="200" />
        <el-table-column label="负责人" width="120">
          <template #default="{ row }">{{ row.leader?.realName ?? '未指定' }}</template>
        </el-table-column>
        <el-table-column label="直属成员" width="100" align="right">
          <template #default="{ row }"><span class="num">{{ row.memberCount }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="plain" size="small">
              {{ row.status === 1 ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="职责" min-width="200">
          <template #default="{ row }">
            <span class="muted">{{ row.description ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'department:create'" link type="primary" @click="openCreate(row.id)">
              加子部门
            </el-button>
            <el-button v-perm="'department:update'" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-perm="'department:delete'" link type="danger" @click="onRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" :title="title" width="480px">
      <el-form label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" maxlength="32" placeholder="如：观测部" />
        </el-form-item>
        <el-form-item label="上级部门">
          <el-select v-model="form.parentId" clearable placeholder="不选则为顶级部门" style="width: 100%">
            <el-option
              v-for="opt in parentOptions"
              :key="opt.id"
              :label="`${'　'.repeat(opt.depth)}${opt.name}`"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="职责">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="255" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
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
  padding: var(--sp-2);
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

.muted {
  color: var(--c-text-2);
  font-size: 13px;
}
</style>
