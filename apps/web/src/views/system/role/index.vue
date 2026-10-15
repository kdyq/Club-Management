<script setup lang="ts">
/**
 * 角色与权限管理（开发文档 12 章阶段 1）。
 *
 * 这里是 v-perm 真正被用起来的地方：新增 / 编辑 / 删除 / 分配权限四个按钮
 * 都按权限码渲染，没权限的账号根本看不到按钮——但那只是体验优化，
 * 直接调接口照样会被后端拦成 403。
 */
import { computed, nextTick, ref } from 'vue';
import { ElMessage, ElMessageBox, ElTree } from 'element-plus';
import {
  DATA_SCOPE_LABEL,
  DataScope,
  type PermissionNodeVo,
  type RoleQuery,
  type RoleVo,
} from '@club/shared';
import { permissionApi, roleApi } from '@/api/role';
import { useTable } from '@/composables/useTable';

const { list, total, loading, error, query, reload, onPageChange } = useTable<RoleVo, RoleQuery>(
  roleApi.page,
  { defaultQuery: { page: 1, pageSize: 20 } },
);

const dataScopeOptions = Object.entries(DATA_SCOPE_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));

// ---------- 新增 / 编辑 ----------
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const submitting = ref(false);
const editingId = ref<string | null>(null);
const form = ref({
  name: '',
  code: '',
  dataScope: DataScope.SELF as number,
  description: '',
  sort: 0,
});

const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新增角色' : '编辑角色'));

function openCreate(): void {
  dialogMode.value = 'create';
  editingId.value = null;
  form.value = {
    name: '',
    code: '',
    dataScope: DataScope.SELF,
    description: '',
    sort: (list.value.length + 1) * 10,
  };
  dialogVisible.value = true;
}

function openEdit(row: RoleVo): void {
  dialogMode.value = 'edit';
  editingId.value = row.id;
  form.value = {
    name: row.name,
    code: row.code,
    dataScope: row.dataScope,
    description: row.description ?? '',
    sort: row.sort,
  };
  dialogVisible.value = true;
}

async function onSubmit(): Promise<void> {
  if (form.value.name.trim() === '') {
    ElMessage.warning('请填写角色名称');
    return;
  }
  if (dialogMode.value === 'create' && !/^[a-z][a-z0-9_]{1,31}$/.test(form.value.code)) {
    ElMessage.warning('角色编码需以小写字母开头，只含小写字母、数字与下划线');
    return;
  }

  submitting.value = true;
  try {
    if (dialogMode.value === 'create') {
      await roleApi.create({
        name: form.value.name.trim(),
        code: form.value.code,
        dataScope: form.value.dataScope,
        description: form.value.description.trim() || undefined,
        sort: form.value.sort,
      });
      ElMessage.success('角色已创建');
    } else if (editingId.value !== null) {
      await roleApi.update(editingId.value, {
        name: form.value.name.trim(),
        dataScope: form.value.dataScope,
        description: form.value.description.trim() || undefined,
        sort: form.value.sort,
      });
      ElMessage.success('角色已更新');
    }
    dialogVisible.value = false;
    await reload();
  } catch {
    // 全局拦截器已经弹过提示
  } finally {
    submitting.value = false;
  }
}

async function onDelete(row: RoleVo): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除角色「${row.name}」吗？`, '删除角色', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  try {
    await roleApi.remove(row.id);
    ElMessage.success('角色已删除');
    await reload();
  } catch {
    // 内置角色与仍被使用的角色会被后端拒绝，提示已由拦截器给出
  }
}

// ---------- 分配权限 ----------
const drawerVisible = ref(false);
const permTree = ref<PermissionNodeVo[]>([]);
const permTreeRef = ref<InstanceType<typeof ElTree> | null>(null);
const assigningRole = ref<RoleVo | null>(null);
const checkedCodes = ref<string[]>([]);
const savingPerms = ref(false);

async function openAssign(row: RoleVo): Promise<void> {
  assigningRole.value = row;
  drawerVisible.value = true;
  try {
    const [tree, codes] = await Promise.all([permissionApi.tree(), roleApi.permissionCodes(row.id)]);
    permTree.value = tree;
    checkedCodes.value = codes;
    // 勾选状态必须在树渲染完成之后再设，否则会被渲染过程覆盖
    await nextTick();
    permTreeRef.value?.setCheckedKeys(codes, false);
  } catch {
    permTree.value = [];
  }
}

async function onSavePerms(): Promise<void> {
  const role = assigningRole.value;
  if (role === null) return;

  const tree = permTreeRef.value;
  if (tree === null) return;

  // 半选的父节点也要算进去，否则只勾了子节点时父菜单会丢
  const checked = tree.getCheckedKeys(false) as string[];
  const halfChecked = tree.getHalfCheckedKeys() as string[];
  const codes = [...new Set([...checked, ...halfChecked])];

  savingPerms.value = true;
  try {
    await roleApi.assignPermissions(role.id, codes);
    ElMessage.success(`已为「${role.name}」更新 ${codes.length} 条权限`);
    drawerVisible.value = false;
    await reload();
  } catch {
    // 拦截器已提示
  } finally {
    savingPerms.value = false;
  }
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">角色权限</h1>
        <p class="page__desc">
          共 {{ total }} 个角色。角色决定「能不能做」，数据范围决定「能看谁的数据」，两者缺一不可。
        </p>
      </div>
      <el-button v-perm="'role:create'" type="primary" @click="openCreate">新增角色</el-button>
    </header>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">角色列表加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="reload">重试</el-button>
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="loading" :data="list" style="width: 100%">
        <el-table-column label="角色" min-width="140">
          <template #default="{ row }">
            <div class="role-name">
              <span>{{ row.name }}</span>
              <el-tag v-if="row.isSystem" size="small" effect="plain" type="info">内置</el-tag>
            </div>
            <div class="role-code">{{ row.code }}</div>
          </template>
        </el-table-column>
        <el-table-column label="数据范围" width="140">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.dataScopeLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="权限数" width="90" align="right">
          <template #default="{ row }"><span class="num">{{ row.permissionCodes.length }}</span></template>
        </el-table-column>
        <el-table-column label="成员数" width="90" align="right">
          <template #default="{ row }"><span class="num">{{ row.memberCount }}</span></template>
        </el-table-column>
        <el-table-column label="说明" min-width="180">
          <template #default="{ row }">
            <span class="muted">{{ row.description ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button v-perm="'role:update'" link type="primary" @click="openAssign(row)">
              分配权限
            </el-button>
            <el-button v-perm="'role:update'" link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              v-perm="'role:delete'"
              link
              type="danger"
              :disabled="row.isSystem"
              @click="onDelete(row)"
            >
              删除
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

    <!-- 新增 / 编辑 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
      <el-form label-width="88px" label-position="right">
        <el-form-item label="角色名" required>
          <el-input v-model="form.name" maxlength="32" placeholder="如：宣传部长" />
        </el-form-item>
        <el-form-item label="角色编码" required>
          <el-input
            v-model="form.code"
            maxlength="32"
            :disabled="dialogMode === 'edit'"
            placeholder="如：publicity_lead"
          />
        </el-form-item>
        <el-form-item label="数据范围" required>
          <el-select v-model="form.dataScope" style="width: 100%">
            <el-option v-for="opt in dataScopeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" maxlength="255" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 分配权限 -->
    <el-drawer v-model="drawerVisible" :title="`分配权限 · ${assigningRole?.name ?? ''}`" size="420px">
      <div class="assign">
        <p class="assign__hint">
          勾选即授予。父节点半选表示只授予了部分子权限，保存时也会一并提交。
        </p>
        <el-tree
          ref="permTreeRef"
          :data="permTree"
          node-key="code"
          show-checkbox
          default-expand-all
          :props="{ label: 'name', children: 'children' }"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <span>{{ data.name }}</span>
              <span v-if="data.type === 3" class="tree-node__code">{{ data.code }}</span>
            </span>
          </template>
        </el-tree>
      </div>
      <template #footer>
        <el-button @click="drawerVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPerms" @click="onSavePerms">保存</el-button>
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
  max-width: 62ch;
}

.panel {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-container);
  box-shadow: var(--shadow-panel);
  padding: var(--sp-5);
}

.panel--table {
  padding: var(--sp-2) var(--sp-2) var(--sp-4);
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

.role-name {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 500;
}

.role-code {
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--c-text-3);
}

.muted {
  color: var(--c-text-2);
  font-size: 13px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: var(--sp-4) var(--sp-4) 0;
}

.assign__hint {
  margin-bottom: var(--sp-4);
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--c-text-2);
}

.tree-node {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-3);
}

.tree-node__code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--c-text-3);
}
</style>
