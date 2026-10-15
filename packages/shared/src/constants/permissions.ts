/**
 * 权限码的唯一定义。前后端共用。
 *
 * 命名规则（开发文档 7.5 节）：
 * - 功能权限（type 3，按钮·接口）用 `模块:动作`，动作限定为下面 7 个。
 * - 目录与菜单（type 1 / 2）用 `menu:标识`，因为 permission 表同时承担菜单树职责。
 *
 * 往数据库灌这些权限由 prisma/seed.ts 负责，本文件是它的输入。
 */
import { PermissionType } from '../enums/rbac.js';

/** 允许的动作，不要私自扩展 */
export const PERMISSION_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'export',
  'audit',
  'approve',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** 模块 → 该模块支持的动作 */
export const PERMISSION_MODULES = {
  club: ['read', 'update'],
  term: ['create', 'read', 'update', 'delete'],
  department: ['create', 'read', 'update', 'delete'],
  member: ['create', 'read', 'update', 'delete', 'export'],
  user: ['create', 'read', 'update', 'delete', 'export'],
  role: ['create', 'read', 'update', 'delete'],
  permission: ['read'],
  activity: ['create', 'read', 'update', 'delete', 'export', 'audit'],
  'activity-registration': ['read', 'update', 'export'],
  checkin: ['create', 'read', 'update', 'export'],
  leave: ['read', 'approve'],
  approval: ['read', 'approve'],
  fund: ['create', 'read', 'update', 'export', 'approve'],
  budget: ['create', 'read', 'update', 'delete', 'approve'],
  fee: ['create', 'read', 'update', 'export'],
  point: ['create', 'read', 'update'],
  announcement: ['create', 'read', 'update', 'delete'],
  notice: ['create', 'read', 'update', 'delete'],
  file: ['create', 'read', 'update', 'delete'],
  duty: ['create', 'read', 'update', 'delete'],
  asset: ['create', 'read', 'update', 'delete'],
  venue: ['create', 'read', 'update', 'delete', 'approve'],
  recruit: ['create', 'read', 'update', 'delete'],
  vote: ['create', 'read', 'update', 'delete'],
  stats: ['read', 'export'],
  log: ['read', 'export'],
  dict: ['create', 'read', 'update', 'delete'],
  config: ['create', 'read', 'update', 'delete'],
  reconcile: ['update'],
} as const satisfies Record<string, readonly PermissionAction[]>;

export type PermissionModule = keyof typeof PERMISSION_MODULES;

/** 所有功能权限码的联合类型，写错码在编译期就会报错 */
export type PermissionCode = {
  [M in PermissionModule]: `${M & string}:${(typeof PERMISSION_MODULES)[M][number]}`;
}[PermissionModule];

/** 权限码的机器可读名，如 `member:create` → `成员新增` */
export const PERMISSION_MODULE_NAME: Record<PermissionModule, string> = {
  club: '社团信息',
  term: '届次',
  department: '部门',
  member: '成员',
  user: '用户',
  role: '角色',
  permission: '权限',
  activity: '活动',
  'activity-registration': '活动报名',
  checkin: '签到',
  leave: '请假',
  approval: '审批',
  fund: '经费流水',
  budget: '预算',
  fee: '会费',
  point: '积分',
  announcement: '公告',
  notice: '通知',
  file: '文件',
  duty: '值班',
  asset: '物资',
  venue: '场地',
  recruit: '招新',
  vote: '投票',
  stats: '统计',
  log: '日志',
  dict: '字典',
  config: '参数',
  reconcile: '对账',
};

const ACTION_NAME: Record<PermissionAction, string> = {
  create: '新增',
  read: '查看',
  update: '修改',
  delete: '删除',
  export: '导出',
  audit: '审核',
  approve: '审批',
};

/** 把 PERMISSION_MODULES 展开成扁平的权限码清单 */
export const ACTION_PERMISSIONS: readonly {
  code: PermissionCode;
  name: string;
  type: typeof PermissionType.ACTION;
  sort: number;
}[] = (Object.keys(PERMISSION_MODULES) as PermissionModule[]).flatMap((module, moduleIndex) =>
  PERMISSION_MODULES[module].map((action, actionIndex) => ({
    code: `${module}:${action}` as PermissionCode,
    name: `${PERMISSION_MODULE_NAME[module]}${ACTION_NAME[action]}`,
    type: PermissionType.ACTION as typeof PermissionType.ACTION,
    sort: actionIndex + 1,
  })),
);

/** 目录与菜单节点（permission 表的 type 1 / 2） */
export interface MenuPermissionNode {
  code: string;
  name: string;
  type: typeof PermissionType.DIRECTORY | typeof PermissionType.MENU;
  path?: string;
  component?: string;
  icon?: string;
  sort: number;
  children?: readonly MenuPermissionNode[];
}

export const MENU_TREE: readonly MenuPermissionNode[] = [
  { code: 'menu:dashboard', name: '工作台', type: PermissionType.MENU, path: '/dashboard', icon: 'dashboard', sort: 1 },
  {
    code: 'menu:org', name: '组织管理', type: PermissionType.DIRECTORY, icon: 'org', sort: 2,
    children: [
      { code: 'menu:member', name: '成员管理', type: PermissionType.MENU, path: '/members', icon: 'user', sort: 1 },
      { code: 'menu:department', name: '部门管理', type: PermissionType.MENU, path: '/departments', icon: 'tree', sort: 2 },
      { code: 'menu:term', name: '届次管理', type: PermissionType.MENU, path: '/terms', icon: 'calendar', sort: 3 },
    ],
  },
  {
    code: 'menu:activity', name: '活动管理', type: PermissionType.DIRECTORY, icon: 'activity', sort: 3,
    children: [
      { code: 'menu:activity-list', name: '活动列表', type: PermissionType.MENU, path: '/activities', icon: 'list', sort: 1 },
      { code: 'menu:registration', name: '报名管理', type: PermissionType.MENU, path: '/registrations', icon: 'form', sort: 2 },
      { code: 'menu:checkin', name: '签到管理', type: PermissionType.MENU, path: '/checkins', icon: 'qrcode', sort: 3 },
      { code: 'menu:leave', name: '请假管理', type: PermissionType.MENU, path: '/leaves', icon: 'note', sort: 4 },
      { code: 'menu:approval', name: '审批中心', type: PermissionType.MENU, path: '/approvals', icon: 'check', sort: 5 },
    ],
  },
  {
    code: 'menu:fund', name: '经费管理', type: PermissionType.DIRECTORY, icon: 'wallet', sort: 4,
    children: [
      { code: 'menu:fund-account', name: '账户管理', type: PermissionType.MENU, path: '/fund/accounts', icon: 'card', sort: 1 },
      { code: 'menu:fund-transaction', name: '收支流水', type: PermissionType.MENU, path: '/fund/transactions', icon: 'flow', sort: 2 },
      { code: 'menu:budget', name: '预算管理', type: PermissionType.MENU, path: '/fund/budgets', icon: 'chart', sort: 3 },
      { code: 'menu:fee', name: '会费管理', type: PermissionType.MENU, path: '/fund/fees', icon: 'money', sort: 4 },
    ],
  },
  {
    code: 'menu:ops', name: '日常运营', type: PermissionType.DIRECTORY, icon: 'ops', sort: 5,
    children: [
      { code: 'menu:duty', name: '值班表', type: PermissionType.MENU, path: '/duty', icon: 'clock', sort: 1 },
      { code: 'menu:asset', name: '物资管理', type: PermissionType.MENU, path: '/assets', icon: 'box', sort: 2 },
      { code: 'menu:venue', name: '场地预约', type: PermissionType.MENU, path: '/venues', icon: 'home', sort: 3 },
      { code: 'menu:file', name: '文件共享', type: PermissionType.MENU, path: '/files', icon: 'folder', sort: 4 },
      { code: 'menu:announcement', name: '公告管理', type: PermissionType.MENU, path: '/announcements', icon: 'horn', sort: 5 },
      { code: 'menu:point', name: '积分管理', type: PermissionType.MENU, path: '/points', icon: 'star', sort: 6 },
    ],
  },
  {
    code: 'menu:recruit', name: '招新管理', type: PermissionType.DIRECTORY, icon: 'recruit', sort: 6,
    children: [
      { code: 'menu:recruit-campaign', name: '招新活动', type: PermissionType.MENU, path: '/recruit', icon: 'megaphone', sort: 1 },
      { code: 'menu:interview', name: '面试评分', type: PermissionType.MENU, path: '/interviews', icon: 'score', sort: 2 },
    ],
  },
  { code: 'menu:vote', name: '投票', type: PermissionType.MENU, path: '/votes', icon: 'vote', sort: 7 },
  { code: 'menu:stats', name: '数据看板', type: PermissionType.MENU, path: '/stats', icon: 'dashboard', sort: 8 },
  {
    code: 'menu:system', name: '系统管理', type: PermissionType.DIRECTORY, icon: 'setting', sort: 9,
    children: [
      { code: 'menu:user', name: '用户管理', type: PermissionType.MENU, path: '/system/users', icon: 'user', sort: 1 },
      { code: 'menu:role', name: '角色权限', type: PermissionType.MENU, path: '/system/roles', icon: 'lock', sort: 2 },
      { code: 'menu:dict', name: '字典管理', type: PermissionType.MENU, path: '/system/dicts', icon: 'book', sort: 3 },
      { code: 'menu:config', name: '参数配置', type: PermissionType.MENU, path: '/system/configs', icon: 'sliders', sort: 4 },
      { code: 'menu:log', name: '操作日志', type: PermissionType.MENU, path: '/system/logs', icon: 'history', sort: 5 },
      { code: 'menu:reconcile', name: '数据对账', type: PermissionType.MENU, path: '/system/reconcile', icon: 'balance', sort: 6 },
    ],
  },
];

/** 把 MENU_TREE 展平成清单，seed 用它建表 */
export function flattenMenuTree(
  nodes: readonly MenuPermissionNode[] = MENU_TREE,
): { node: MenuPermissionNode; parentCode: string | null }[] {
  const out: { node: MenuPermissionNode; parentCode: string | null }[] = [];
  const walk = (list: readonly MenuPermissionNode[], parentCode: string | null): void => {
    for (const node of list) {
      out.push({ node, parentCode });
      if (node.children) walk(node.children, node.code);
    }
  };
  walk(nodes, null);
  return out;
}

/** 目录与菜单的权限码清单 */
export const MENU_PERMISSION_CODES: readonly string[] = flattenMenuTree().map((x) => x.node.code);

/** 全部权限码（菜单 + 功能） */
export const ALL_PERMISSION_CODES: readonly string[] = [
  ...MENU_PERMISSION_CODES,
  ...ACTION_PERMISSIONS.map((p) => p.code),
];
