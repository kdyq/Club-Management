<script setup lang="ts">
/**
 * 成员管理。筛选 + 表格 + 分页的样板页，同时承载新增/编辑/导入/导出。
 *
 * 三种状态按开发文档 8.5 节处理：加载态骨架屏、空状态区分「没有数据」与
 * 「筛选后没有结果」、错误态卡片式面板。
 */
import { computed, onMounted, ref } from 'vue';
import {
  MEMBER_POSITION_LABEL,
  MEMBER_STATUS_LABEL,
  MemberPosition,
  MemberStatus,
  type MemberQuery,
  type MemberVo,
} from '@club/shared';
import { departmentApi, memberApi, type MemberDetailVo } from '@/api/member';
import { roleApi } from '@/api/role';
import MemberFormDialog from '@/components/member/MemberFormDialog.vue';
import MemberImportDialog from '@/components/member/MemberImportDialog.vue';
import MemberDetailDrawer from '@/components/member/MemberDetailDrawer.vue';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';

const user = useUserStore();

const statusOptions = Object.entries(MEMBER_STATUS_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));
const positionOptions = Object.entries(MEMBER_POSITION_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));

const {
  list,
  total,
  loading,
  error,
  query,
  hasFilter,
  load,
  reload,
  reset,
  onPageChange,
  onPageSizeChange,
} = useTable<MemberVo, MemberQuery>(memberApi.page, {
  defaultQuery: { page: 1, pageSize: 20 },
});

// ---------- 下拉数据 ----------
const deptOptions = ref<{ id: string; name: string }[]>([]);
const roleOptions = ref<{ id: string; name: string; code: string }[]>([]);

onMounted(async () => {
  const tasks: Promise<unknown>[] = [];
  // 没权限就静默跳过，不要因为一个下拉拿不到就让整页报错
  if (user.hasPerm('department:read')) {
    tasks.push(
      departmentApi.options().then((rows) => {
        deptOptions.value = rows.map((row) => ({ id: row.id, name: row.name }));
      }).catch(() => undefined),
    );
  }
  if (user.hasPerm('role:read')) {
    tasks.push(
      roleApi.options().then((rows) => {
        roleOptions.value = rows;
      }).catch(() => undefined),
    );
  }
  await Promise.all(tasks);
});

// ---------- 新增 / 编辑 ----------
const formVisible = ref(false);
const formMode = ref<'create' | 'edit'>('create');
const editingMember = ref<MemberDetailVo | null>(null);

function openCreate(): void {
  formMode.value = 'create';
  editingMember.value = null;
  formVisible.value = true;
}

async function openEdit(row: MemberVo): Promise<void> {
  formMode.value = 'edit';
  try {
    editingMember.value = await memberApi.detail(row.id);
  } catch {
    return;
  }
  formVisible.value = true;
}

// ---------- 详情 ----------
const detailVisible = ref(false);
const detailId = ref<string | null>(null);

function openDetail(row: MemberVo): void {
  detailId.value = row.id;
  detailVisible.value = true;
}

// ---------- 导入 / 导出 ----------
const importVisible = ref(false);
const exporting = ref(false);

async function onExport(): Promise<void> {
  exporting.value = true;
  try {
    // 带上当前筛选条件；后端还会再叠一层数据范围
    await memberApi.export({ ...query.value });
  } finally {
    exporting.value = false;
  }
}

const scopeHint = computed(() => {
  const p = user.profile;
  if (p === null) return '';
  const parts = [`${p.clubName} · ${p.termName}`];
  if (p.deptName !== null) parts.push(p.deptName);
  return parts.join(' / ');
});

function onSearch(): void {
  void reload();
}

function statusTagType(status: number): 'success' | 'info' | 'warning' | 'danger' {
  if (status === MemberStatus.ACTIVE) return 'success';
  if (status === MemberStatus.FROZEN) return 'warning';
  return 'info';
}

void load;
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">成员管理</h1>
        <p class="page__desc">共 {{ total }} 条可见记录 · {{ scopeHint }}</p>
      </div>
      <div class="page__actions">
        <el-button v-perm="'member:create'" @click="importVisible = true">
          <el-icon><Upload /></el-icon>
          导入
        </el-button>
        <el-button v-perm="'member:export'" :loading="exporting" @click="onExport">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button v-perm="'member:create'" type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新增成员
        </el-button>
      </div>
    </header>

    <section class="panel panel--filters">
      <el-input
        v-model="query.keyword"
        class="filter"
        placeholder="搜索姓名 / 学号 / 成员编号"
        clearable
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-select v-model="query.deptId" class="filter filter--sm" placeholder="部门" clearable>
        <el-option v-for="d in deptOptions" :key="d.id" :label="d.name" :value="d.id" />
      </el-select>
      <el-select v-model="query.status" class="filter filter--sm" placeholder="状态" clearable>
        <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-select v-model="query.position" class="filter filter--sm" placeholder="职务" clearable>
        <el-option v-for="opt in positionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button v-if="hasFilter" @click="reset">清空筛选</el-button>
    </section>

    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">成员列表加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="reload">重试</el-button>
    </section>

    <section v-else-if="loading && list.length === 0" class="panel">
      <el-skeleton :rows="6" animated />
    </section>

    <section v-else-if="list.length === 0" class="panel panel--empty">
      <el-empty :description="hasFilter ? '没有符合筛选条件的成员' : '当前范围内还没有成员'">
        <el-button v-if="hasFilter" type="primary" @click="reset">清空筛选</el-button>
        <el-button v-else-if="user.hasPerm('member:create')" type="primary" @click="openCreate">
          新增第一个成员
        </el-button>
      </el-empty>
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="loading" :data="list" style="width: 100%" stripe>
        <el-table-column prop="memberNo" label="成员编号" width="140" />
        <el-table-column label="姓名" width="120">
          <template #default="{ row }">
            <span class="cell-name">
              <span class="avatar">{{ row.realName.slice(0, 1) }}</span>
              {{ row.realName }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="studentNo" label="学号" width="120" />
        <el-table-column label="部门" width="110">
          <template #default="{ row }">{{ row.deptName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="职务" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.position <= MemberPosition.VICE_PRESIDENT ? 'primary' : 'info'"
              effect="plain"
              size="small"
            >
              {{ row.positionLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色" min-width="140">
          <template #default="{ row }">
            <span v-if="row.roles.length === 0" class="muted">—</span>
            <el-tag v-for="role in row.roles" :key="role.id" class="role-tag" size="small" effect="plain">
              {{ role.name }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="plain" size="small">
              {{ row.statusLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="积分" width="76" align="right">
          <template #default="{ row }"><span class="num">{{ row.totalPoints }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button v-perm="'member:update'" link type="primary" @click="openEdit(row)">编辑</el-button>
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

    <MemberFormDialog
      v-model="formVisible"
      :mode="formMode"
      :member="editingMember"
      :dept-options="deptOptions"
      :role-options="roleOptions"
      @saved="reload"
    />
    <MemberImportDialog v-model="importVisible" @imported="reload" />
    <MemberDetailDrawer v-model="detailVisible" :member-id="detailId" />
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

.filter {
  width: 260px;
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

.cell-name {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
}

.avatar {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--r-avatar);
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-size: 11.5px;
  font-weight: 600;
  flex: none;
}

.role-tag {
  margin-right: var(--sp-1);
}

.muted {
  color: var(--c-text-3);
}

.pager {
  display: flex;
  justify-content: flex-end;
  padding: var(--sp-4) var(--sp-4) 0;
}
</style>
