/**
 * 路由与守卫（开发文档 8.4 节）。
 *
 * 守卫做三件事：没登录先试着续期、续期也失败就跳登录页、进了页面再按权限码判一次。
 * 前端权限只是体验优化，真正的拦截在后端。
 *
 * 侧栏菜单由本文件推导出来（见 DefaultLayout），所以**新页面只要在这里注册，
 * 菜单、标题、权限控制就都齐了**，不用再去改导航组件。
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { useUserStore } from '@/stores/user';

declare module 'vue-router' {
  interface RouteMeta {
    /** 无需登录 */
    public?: boolean;
    /** 页面标题，用于顶栏、菜单与 document.title */
    title?: string;
    /** 进入该页所需的权限码（菜单权限） */
    perm?: string;
    /** Element Plus 图标组件名，见 @element-plus/icons-vue */
    icon?: string;
    /** 侧栏分组名 */
    group?: string;
    /** 组内排序，越小越靠前 */
    order?: number;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: DefaultLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '工作台', icon: 'HomeFilled', perm: 'menu:dashboard', group: '总览', order: 1 },
      },
      {
        path: 'activities',
        name: 'activities',
        component: () => import('@/views/activity/index.vue'),
        meta: { title: '活动管理', icon: 'Calendar', perm: 'menu:activity-list', group: '活动', order: 20 },
      },
      {
        path: 'activities/:id',
        name: 'activity-detail',
        component: () => import('@/views/activity/detail.vue'),
        // 详情不单独进菜单，权限继承列表；这里不设 perm，避免直接打开链接被判 403
        meta: { title: '活动详情', group: '活动', order: 21 },
      },
      {
        path: 'approvals',
        name: 'approvals',
        component: () => import('@/views/approval/index.vue'),
        meta: { title: '审批中心', icon: 'Checked', group: '活动', order: 22 },
      },
      {
        path: 'members',
        name: 'members',
        component: () => import('@/views/member/index.vue'),
        meta: { title: '成员管理', icon: 'User', perm: 'menu:member', group: '组织', order: 10 },
      },
      {
        path: 'departments',
        name: 'departments',
        component: () => import('@/views/department/index.vue'),
        meta: { title: '部门管理', icon: 'Grid', perm: 'menu:department', group: '组织', order: 11 },
      },
      {
        path: 'terms',
        name: 'terms',
        component: () => import('@/views/term/index.vue'),
        meta: { title: '届次管理', icon: 'Calendar', perm: 'menu:term', group: '组织', order: 12 },
      },
      {
        path: 'ops/duty',
        name: 'duty',
        component: () => import('@/views/ops/duty.vue'),
        meta: { title: '值班表', icon: 'Clock', perm: 'menu:duty', group: '日常', order: 50 },
      },
      {
        path: 'ops/assets',
        name: 'assets',
        component: () => import('@/views/ops/assets.vue'),
        meta: { title: '物资管理', icon: 'Box', perm: 'menu:asset', group: '日常', order: 51 },
      },
      {
        path: 'ops/venues',
        name: 'venues',
        component: () => import('@/views/ops/venues.vue'),
        meta: { title: '场地预约', icon: 'House', perm: 'menu:venue', group: '日常', order: 52 },
      },
      {
        path: 'announcements',
        name: 'announcements',
        component: () => import('@/views/ops/announcements.vue'),
        meta: { title: '公告管理', icon: 'Bell', perm: 'menu:announcement', group: '日常', order: 53 },
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('@/views/notification/index.vue'),
        // 人人都有收件箱，不看权限码
        meta: { title: '站内信', icon: 'Message', group: '个人', order: 81 },
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/profile/index.vue'),
        meta: { title: '我的档案', icon: 'Postcard', group: '个人', order: 80 },
      },
      {
        path: 'fund/overview',
        name: 'fund-overview',
        component: () => import('@/views/fund/overview.vue'),
        meta: { title: '财务公示', icon: 'Wallet', perm: 'menu:fund-account', group: '经费', order: 40 },
      },
      {
        path: 'fund/transactions',
        name: 'fund-transactions',
        component: () => import('@/views/fund/transactions.vue'),
        meta: { title: '收支流水', icon: 'Tickets', perm: 'fund:read', group: '经费', order: 41 },
      },
      {
        path: 'fund/budgets',
        name: 'fund-budgets',
        component: () => import('@/views/fund/budgets.vue'),
        meta: { title: '预算管理', icon: 'PieChart', perm: 'menu:budget', group: '经费', order: 42 },
      },
      {
        path: 'fund/fees',
        name: 'fund-fees',
        component: () => import('@/views/fund/fees.vue'),
        meta: { title: '会费管理', icon: 'Money', perm: 'menu:fee', group: '经费', order: 43 },
      },
      {
        path: 'system/reconcile',
        name: 'reconcile',
        component: () => import('@/views/system/reconcile.vue'),
        meta: { title: '数据对账', icon: 'Refresh', perm: 'reconcile:update', group: '系统', order: 92 },
      },
      {
        path: 'system/roles',
        name: 'roles',
        component: () => import('@/views/system/role/index.vue'),
        meta: { title: '角色权限', icon: 'Lock', perm: 'menu:role', group: '系统', order: 90 },
      },
    ],
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { public: true, title: '没有权限' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/error/404.vue'),
    meta: { public: true, title: '页面不存在' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const user = useUserStore();

  // 首次进入应用时先尝试用 refresh cookie 恢复登录态
  if (!user.ready) {
    await user.restore();
  }

  if (to.meta.public === true) {
    if (to.name === 'login' && user.isLoggedIn) {
      return { name: 'dashboard' };
    }
    return true;
  }

  if (!user.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  const required = to.meta.perm;
  if (required !== undefined && !user.hasPerm(required)) {
    return { name: 'forbidden' };
  }

  return true;
});

router.afterEach((to) => {
  const base = '星野天文社';
  document.title = to.meta.title !== undefined ? `${to.meta.title} · ${base}` : base;
});

export default router;
