<script setup lang="ts">
/**
 * 控制台外壳：侧栏 232px + 顶栏 60px + 内容区最大 1240px（开发文档 9.4 节一致性清单）。
 *
 * 侧栏菜单不是写死的，而是从路由表推导：只渲染「该用户有权限」且「路由已注册」的页面。
 * 这样菜单永远不会指向一个还不存在的页面。
 */
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import router from '@/router';
import { useAppStore } from '@/stores/app';
import { useUserStore } from '@/stores/user';

interface NavItem {
  name: string;
  path: string;
  title: string;
  icon?: string;
  order: number;
  group: string;
}

const route = useRoute();
const routerInstance = useRouter();
const user = useUserStore();
const app = useAppStore();

const navGroups = computed(() => {
  const items: NavItem[] = [];

  for (const record of router.getRoutes()) {
    const meta = record.meta;
    if (record.name === undefined) continue;
    if (meta.public === true) continue;
    if (meta.title === undefined) continue;
    // 带路径参数的路由（详情页之类）不是菜单项，它们只能从列表点进去
    if (record.path.includes(':')) continue;
    // 有 perm 的按权限过滤；没有 perm 的表示「登录即可见」，比如我的档案
    if (meta.perm !== undefined && !user.hasPerm(meta.perm)) continue;

    const item: NavItem = {
      name: String(record.name),
      path: record.path,
      title: meta.title,
      order: meta.order ?? 999,
      group: meta.group ?? '其他',
    };
    if (meta.icon !== undefined) item.icon = meta.icon;
    items.push(item);
  }

  items.sort((a, b) => a.order - b.order);

  const grouped = new Map<string, NavItem[]>();
  for (const item of items) {
    const list = grouped.get(item.group) ?? [];
    list.push(item);
    grouped.set(item.group, list);
  }
  return [...grouped.entries()].map(([group, list]) => ({ group, list }));
});

/** 顶栏的快速跳转，同样来自路由表 */
const jumpOptions = computed(() =>
  navGroups.value.flatMap((g) => g.list).map((item) => ({ value: item.path, label: item.title })),
);
const jumpValue = ref<string>('');
function onJump(path: string): void {
  if (path !== '') void routerInstance.push(path);
  jumpValue.value = '';
}

const initial = computed(() => (user.profile?.realName ?? '?').slice(0, 1));
const roleLabel = computed(() => user.roles.map((r) => r.name).join(' / ') || '—');

async function onLogout(): Promise<void> {
  try {
    await ElMessageBox.confirm('退出后需要重新登录，确定吗？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  await user.logout();
  void routerInstance.replace({ name: 'login' });
}
</script>

<template>
  <div class="shell" :class="{ 'shell--collapsed': app.sidebarCollapsed }">
    <aside class="sidebar">
      <div class="sidebar__head">
        <span class="sidebar__mark">星</span>
        <div class="sidebar__ident">
          <div class="sidebar__club">{{ user.profile?.clubName ?? '星野天文社' }}</div>
          <div class="sidebar__term">{{ user.profile?.termName ?? '—' }}</div>
        </div>
      </div>

      <nav class="sidebar__nav">
        <div v-for="group in navGroups" :key="group.group" class="sidebar__group">
          <div class="sidebar__group-label">{{ group.group }}</div>
          <router-link
            v-for="item in group.list"
            :key="item.name"
            class="nav-item"
            :class="{ 'nav-item--active': route.path === item.path }"
            :to="item.path"
          >
            <el-icon v-if="item.icon" class="nav-item__icon">
              <component :is="item.icon" />
            </el-icon>
            <span class="nav-item__text">{{ item.title }}</span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar__foot">
        <span class="avatar">{{ initial }}</span>
        <div class="sidebar__user">
          <div class="sidebar__user-name">{{ user.profile?.realName ?? '未登录' }}</div>
          <div class="sidebar__user-role">{{ roleLabel }}</div>
        </div>
      </div>
    </aside>

    <div class="body">
      <header class="topbar">
        <el-select
          v-model="jumpValue"
          class="topbar__jump"
          filterable
          placeholder="跳转到…"
          size="default"
          @change="onJump"
        >
          <el-option
            v-for="opt in jumpOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <div class="topbar__right">
          <el-tag v-if="user.profile?.deptName" type="info" effect="plain" size="small">
            {{ user.profile.deptName }}
          </el-tag>
          <el-tag v-else type="info" effect="plain" size="small">未分配部门</el-tag>
          <el-dropdown trigger="click">
            <span class="topbar__user">
              <span class="avatar avatar--sm">{{ initial }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>{{ user.profile?.realName }}（{{ roleLabel }}）</el-dropdown-item>
                <el-dropdown-item divided @click="onLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--layout-sidebar-w) minmax(0, 1fr);
  min-height: 100dvh;
}

/* ---------- 侧栏 ---------- */
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--c-surface);
  border-right: 1px solid var(--c-border);
}

.sidebar__head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  height: var(--layout-header-h);
  padding: 0 var(--sp-4);
  border-bottom: 1px solid var(--c-border);
  flex: none;
}

.sidebar__mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-control);
  background: var(--c-accent);
  color: var(--c-on-accent);
  font-size: 13px;
  font-weight: 700;
  flex: none;
}

.sidebar__ident {
  min-width: 0;
}

.sidebar__club {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__term {
  font-size: 11.5px;
  color: var(--c-text-3);
}

.sidebar__nav {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-4) var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.sidebar__group-label {
  padding: 0 var(--sp-3) var(--sp-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--c-text-3);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  height: 36px;
  padding: 0 var(--sp-3);
  border-radius: var(--r-control);
  color: var(--c-text-2);
  font-size: 13.5px;
}

.nav-item:hover {
  background: var(--c-surface-sunken);
  color: var(--c-text);
}

.nav-item--active {
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-weight: 600;
}

.nav-item__icon {
  font-size: 15px;
  flex: none;
}

.sidebar__foot {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--c-border);
  flex: none;
}

.sidebar__user {
  min-width: 0;
}

.sidebar__user-name {
  font-size: 13px;
  font-weight: 600;
}

.sidebar__user-role {
  font-size: 11.5px;
  color: var(--c-text-3);
}

/* ---------- 顶栏与内容 ---------- */
.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  height: var(--layout-header-h);
  padding: 0 var(--sp-6);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  flex: none;
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar__jump {
  width: 240px;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.topbar__user {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  cursor: pointer;
  color: var(--c-text-2);
  outline: none;
}

.content {
  flex: 1;
  width: 100%;
  max-width: var(--layout-content-max);
  margin: 0 auto;
  padding: var(--sp-6) 28px var(--sp-12);
}

/* ---------- 头像：姓氏首字 ---------- */
.avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--r-avatar);
  background: var(--c-accent-tint);
  color: var(--c-accent);
  font-size: 13px;
  font-weight: 600;
  flex: none;
}

.avatar--sm {
  width: 26px;
  height: 26px;
  font-size: 12px;
}

/* ---------- 响应式：< 1024px 侧栏收成横向滚动条 ---------- */
@media (max-width: 1023px) {
  .shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    border-right: none;
    border-bottom: 1px solid var(--c-border);
  }

  .sidebar__nav {
    flex-direction: row;
    gap: var(--sp-2);
    overflow-x: auto;
    overflow-y: hidden;
    padding: var(--sp-2) var(--sp-3);
  }

  .sidebar__group {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .sidebar__group-label {
    display: none;
  }

  .nav-item {
    white-space: nowrap;
  }

  .sidebar__foot {
    display: none;
  }

  .content {
    padding: var(--sp-5) var(--sp-4) var(--sp-8);
  }
}
</style>
