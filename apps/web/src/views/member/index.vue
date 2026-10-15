<script setup lang="ts">
/**
 * 成员列表。阶段 1 只做只读列表，用来验证数据范围在界面上确实生效；
 * 新增 / 编辑 / 导入 / 导出在阶段 2 补上。
 *
 * 三种状态都按开发文档 8.5 节处理：加载态用骨架屏、空状态区分「没有数据」与
 * 「筛选后没有结果」、错误态用卡片式面板。
 */
import { computed } from 'vue';
import { MEMBER_POSITION_LABEL, MEMBER_STATUS_LABEL, MemberPosition, MemberStatus } from '@club/shared';
import type { MemberQuery, MemberVo } from '@club/shared';
import { memberApi } from '@/api/member';
import { useTable } from '@/composables/useTable';
import { useUserStore } from '@/stores/user';

const user = useUserStore();

/** 下拉选项都从共享枚举里推导，不在这里写死中文 */
const statusOptions = Object.entries(MEMBER_STATUS_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));
const positionOptions = Object.entries(MEMBER_POSITION_LABEL).map(([value, label]) => ({
  value: Number(value),
  label,
}));

const { list, total, loading, error, query, hasFilter, reload, reset, onPageChange, onPageSizeChange } =
  useTable<MemberVo, MemberQuery>(memberApi.page, {
    defaultQuery: { page: 1, pageSize: 20 },
  });

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
  if (status === MemberStatus.LEFT) return 'info';
  return 'info';
}

function positionTagType(position: number): 'primary' | 'info' {
  return position <= MemberPosition.VICE_PRESIDENT ? 'primary' : 'info';
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <div>
        <h1 class="page__title">成员管理</h1>
        <p class="page__desc">共 {{ total }} 条可见记录 · {{ scopeHint }}</p>
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
      <el-select v-model="query.status" class="filter filter--sm" placeholder="状态" clearable>
        <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-select v-model="query.position" class="filter filter--sm" placeholder="职务" clearable>
        <el-option v-for="opt in positionOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-button type="primary" @click="onSearch">查询</el-button>
      <el-button v-if="hasFilter" @click="reset">清空筛选</el-button>
    </section>

    <!-- 错误态：卡片式面板 -->
    <section v-if="error !== null" class="panel panel--error">
      <el-icon class="panel--error__icon"><WarningFilled /></el-icon>
      <div>
        <div class="panel--error__title">成员列表加载失败</div>
        <div class="panel--error__desc">{{ error }}</div>
      </div>
      <el-button @click="reload">重试</el-button>
    </section>

    <!-- 加载态：骨架屏，形状与最终内容一致，避免布局跳动 -->
    <section v-else-if="loading && list.length === 0" class="panel">
      <el-skeleton :rows="6" animated />
    </section>

    <!-- 空状态：区分「确实没有」与「筛选后没有结果」 -->
    <section v-else-if="list.length === 0" class="panel panel--empty">
      <el-empty :description="hasFilter ? '没有符合筛选条件的成员' : '当前范围内还没有成员'">
        <el-button v-if="hasFilter" type="primary" @click="reset">清空筛选</el-button>
      </el-empty>
    </section>

    <section v-else class="panel panel--table">
      <el-table v-loading="loading" :data="list" style="width: 100%" stripe>
        <el-table-column prop="memberNo" label="成员编号" width="140" />
        <el-table-column label="姓名" width="100">
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
            <el-tag :type="positionTagType(row.position)" effect="plain" size="small">
              {{ row.positionLabel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色" min-width="150">
          <template #default="{ row }">
            <span v-if="row.roles.length === 0">—</span>
            <el-tag
              v-for="role in row.roles"
              :key="role.id"
              class="role-tag"
              size="small"
              effect="plain"
            >
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
        <el-table-column label="积分" width="80" align="right">
          <template #default="{ row }">
            <span class="num">{{ row.totalPoints }}</span>
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

.pager {
  display: flex;
  justify-content: flex-end;
  padding: var(--sp-4) var(--sp-4) 0;
}
</style>
