/**
 * 开发种子数据（开发文档 12 章阶段 0）。
 *
 * 灌入一套自洽的虚构社团：1 个社团、1 个届次、4 个部门、5 个角色与 140 条权限、
 * 10 个成员（其中林知遥是管理员）、1 个经费账户，以及科目与基础参数。
 *
 * 幂等：每次运行先清空本脚本管理的表，再重新写入。开发期可以反复执行。
 *   运行：npm run db:seed
 */
import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  ALL_PERMISSION_CODES,
  ACTION_PERMISSIONS,
  MENU_PERMISSION_CODES,
  flattenMenuTree,
  menuCodeForModule,
  ClubStatus,
  DataScope,
  EnableStatus,
  FundType,
  MemberPosition,
  MemberStatus,
  PermissionType,
  RegisterSource,
  TermStatus,
  UserStatus,
} from '@club/shared';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === '') {
  throw new Error('缺少 DATABASE_URL，请确认仓库根目录的 .env 已按开发文档 5.2 节配置');
}
const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

/** 所有种子账号共用的开发密码 */
const DEV_PASSWORD = 'Xingye@2026';
const BCRYPT_COST = 10;

// ---------------------------------------------------------------------------
// 一、清空本脚本管理的表
// ---------------------------------------------------------------------------

async function reset(): Promise<void> {
  // 自引用外键先置空，避免删除顺序问题
  await prisma.department.updateMany({ data: { leaderMemberId: null } });
  await prisma.department.updateMany({ data: { parentId: null } });
  await prisma.permission.updateMany({ data: { parentId: null } });
  await prisma.fundCategory.updateMany({ data: { parentId: null } });
  await prisma.fileFolder.updateMany({ data: { parentId: null } });

  // 删除顺序必须按外键依赖从叶子往根走，否则会被 FK 挡住。
  // 分四段：明细表 → 主表 → 成员 → 组织与基础数据。

  // 1) 只指向别的表、不被别人引用的明细表
  await prisma.activityCheckin.deleteMany();
  await prisma.activityLeave.deleteMany();
  await prisma.activityRegistration.deleteMany();
  await prisma.activityPhoto.deleteMany();
  await prisma.activityTask.deleteMany();
  await prisma.fundVoucher.deleteMany();
  await prisma.memberFee.deleteMany();
  await prisma.pointRecord.deleteMany();
  await prisma.volunteerHour.deleteMany();
  await prisma.assetBorrow.deleteMany();
  await prisma.venueBooking.deleteMany();
  await prisma.dutyLog.deleteMany();
  await prisma.dutySwap.deleteMany();
  await prisma.dutySchedule.deleteMany();
  await prisma.approvalTask.deleteMany();

  // 2) 主表
  await prisma.activity.deleteMany();
  await prisma.activityCategory.deleteMany();
  await prisma.fundTransaction.deleteMany();
  await prisma.fundBudget.deleteMany();
  await prisma.memberFeeStandard.deleteMany();
  await prisma.pointRule.deleteMany();
  await prisma.dutyPlan.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.approvalInstance.deleteMany();
  await prisma.approvalNode.deleteMany();
  await prisma.approvalFlow.deleteMany();

  // 3) 通知与文件：都挂在 user 上，要先于 user 清掉
  await prisma.notificationReceiver.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.fileGrant.deleteMany();
  await prisma.fileItem.deleteMany();
  await prisma.fileFolder.deleteMany();

  // 4) 成员及其关联，然后才是组织与基础数据
  await prisma.memberRole.deleteMany();
  await prisma.member.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.department.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.term.deleteMany();
  await prisma.fundAccount.deleteMany();
  await prisma.fundCategory.deleteMany();
  await prisma.sysConfig.deleteMany();
  await prisma.sysDictItem.deleteMany();
  await prisma.sysDict.deleteMany();
  await prisma.user.deleteMany();
  await prisma.club.deleteMany();
}

// ---------------------------------------------------------------------------
// 二、社团 / 届次 / 部门
// ---------------------------------------------------------------------------

const CLUB = {
  code: 'XYAS',
  name: '星野天文社',
  shortName: '星野社',
  description:
    '以校园天文观测与科普为核心的学生社团。每月组织路边天文与夜间观测，面向全校开设天文科普讲座与志愿服务活动，欢迎所有对星空好奇的同学。',
  schoolName: '明远大学',
  collegeName: '物理科学与技术学院',
  foundedAt: new Date('2016-09-15'),
  contactEmail: 'xyas@example.edu.cn',
  contactPhone: '0571-88886666',
  advisorName: '张明远',
  maxMembers: 0,
} as const;

const DEPARTMENTS = [
  { name: '学术部', description: '负责科普讲座、读书会与观测报告整理', sort: 1 },
  { name: '观测部', description: '负责观测计划、器材维护与外出带队', sort: 2 },
  { name: '宣传部', description: '负责海报设计、公众号与活动摄影', sort: 3 },
  { name: '秘书处', description: '负责会议记录、档案与经费台账', sort: 4 },
] as const;

const TERM = {
  name: '2026-2027 学年',
  startDate: new Date('2026-09-01'),
  endDate: new Date('2027-08-31'),
} as const;

// ---------------------------------------------------------------------------
// 三、成员（第 1 位是管理员，社长）
// ---------------------------------------------------------------------------

interface SeedMember {
  realName: string;
  studentNo: string;
  gender: number;
  grade: string;
  major: string;
  className: string;
  dept: string;
  position: MemberPosition;
  isCore: boolean;
  roleCode: string;
  memberNo: string;
}

const ADMIN_MEMBER: SeedMember = {
  realName: '林知遥', studentNo: '2024100101', gender: 2, grade: '2024',
  major: '天文学', className: '天文2401', dept: '秘书处',
  position: MemberPosition.PRESIDENT, isCore: true, roleCode: 'president', memberNo: 'XYAS-2026-001',
};

const MEMBERS: readonly SeedMember[] = [
  ADMIN_MEMBER,
  {
    realName: '沈亦舟', studentNo: '2024100102', gender: 1, grade: '2024',
    major: '天文学', className: '天文2401', dept: '学术部',
    position: MemberPosition.VICE_PRESIDENT, isCore: true, roleCode: 'vice_president', memberNo: 'XYAS-2026-002',
  },
  {
    realName: '陆星野', studentNo: '2024100103', gender: 1, grade: '2024',
    major: '物理学', className: '物理2402', dept: '观测部',
    position: MemberPosition.VICE_PRESIDENT, isCore: true, roleCode: 'vice_president', memberNo: 'XYAS-2026-003',
  },
  {
    realName: '苏晚晴', studentNo: '2024100104', gender: 2, grade: '2024',
    major: '天文学', className: '天文2401', dept: '学术部',
    position: MemberPosition.DIRECTOR, isCore: true, roleCode: 'director', memberNo: 'XYAS-2026-004',
  },
  {
    realName: '顾行川', studentNo: '2024100105', gender: 1, grade: '2024',
    major: '光电信息科学与工程', className: '光电2403', dept: '观测部',
    position: MemberPosition.DIRECTOR, isCore: true, roleCode: 'director', memberNo: 'XYAS-2026-005',
  },
  {
    realName: '江月白', studentNo: '2025100106', gender: 2, grade: '2025',
    major: '新闻传播学', className: '新闻2501', dept: '宣传部',
    position: MemberPosition.DIRECTOR, isCore: true, roleCode: 'director', memberNo: 'XYAS-2026-006',
  },
  {
    realName: '温子墨', studentNo: '2025100107', gender: 1, grade: '2025',
    major: '视觉传达设计', className: '设计2502', dept: '宣传部',
    position: MemberPosition.OFFICER, isCore: false, roleCode: 'officer', memberNo: 'XYAS-2026-007',
  },
  {
    realName: '许听澜', studentNo: '2025100108', gender: 2, grade: '2025',
    major: '汉语言文学', className: '中文2501', dept: '秘书处',
    position: MemberPosition.OFFICER, isCore: false, roleCode: 'officer', memberNo: 'XYAS-2026-008',
  },
  {
    realName: '周砚清', studentNo: '2025100109', gender: 1, grade: '2025',
    major: '物理学', className: '物理2503', dept: '观测部',
    position: MemberPosition.MEMBER, isCore: false, roleCode: 'member', memberNo: 'XYAS-2026-009',
  },
  {
    realName: '陈砚书', studentNo: '2025100110', gender: 2, grade: '2025',
    major: '应用数学', className: '数学2502', dept: '学术部',
    position: MemberPosition.MEMBER, isCore: false, roleCode: 'member', memberNo: 'XYAS-2026-010',
  },
];

// ---------------------------------------------------------------------------
// 四、角色与它们拿到的权限
// ---------------------------------------------------------------------------

const ROLES = [
  {
    code: 'president', name: '社长', dataScope: DataScope.CLUB, isSystem: true, sort: 1,
    description: '社团负责人，拥有全部权限',
  },
  {
    code: 'vice_president', name: '副社长', dataScope: DataScope.CLUB, isSystem: true, sort: 2,
    description: '协助社长，不能管理角色与系统参数',
  },
  {
    code: 'director', name: '部长', dataScope: DataScope.DEPT_AND_BELOW, isSystem: true, sort: 3,
    description: '本部门及以下的数据范围，可组织活动与审批请假',
  },
  {
    code: 'officer', name: '干事', dataScope: DataScope.DEPT, isSystem: true, sort: 4,
    description: '本部门数据范围，可录入日常事务',
  },
  {
    code: 'member', name: '普通成员', dataScope: DataScope.SELF, isSystem: true, sort: 5,
    description: '仅本人的数据范围，只读为主',
  },
] as const;

/** 部长可写的模块 */
const DIRECTOR_WRITABLE = ['activity', 'notice', 'file', 'duty', 'asset', 'point'];
/** 干事可写的模块 */
const OFFICER_WRITABLE = ['activity', 'file', 'duty'];

function isMenu(code: string): boolean {
  return code.startsWith('menu:');
}

/** 社长：全部 */
function presidentPerms(): string[] {
  return [...ALL_PERMISSION_CODES];
}

/** 副社长：去掉角色、权限、字典、参数与系统管理菜单 */
function vicePresidentPerms(): string[] {
  const blockedPrefix = ['role:', 'permission:', 'dict:', 'config:', 'user:'];
  return ALL_PERMISSION_CODES.filter(
    (code) =>
      !blockedPrefix.some((p) => code.startsWith(p)) &&
      code !== 'menu:system' &&
      !code.startsWith('menu:system'),
  );
}

function managerPerms(writable: readonly string[]): string[] {
  return ALL_PERMISSION_CODES.filter((code) => {
    // 菜单：系统管理相关一律不给
    if (isMenu(code)) {
      return !code.startsWith('menu:system') && !code.startsWith('menu:reconcile');
    }
    const [module, action] = code.split(':') as [string, string];
    if (action === 'read' || action === 'export') return true;
    if (writable.includes(module)) {
      return action === 'create' || action === 'update';
    }
    // 请假与场地可以审批
    if (module === 'leave' || module === 'venue' || module === 'approval') {
      return action === 'approve';
    }
    return false;
  });
}

/**
 * 普通成员：只看自己的数据，但**能自助办事**。
 *
 * 借器材、约场地、看值班、读公告这些是成员本来就该自己能做的动作，
 * 把它们放在管理员权限里是设计错误——系统的意义就在于让成员自助。
 * 需要管控的是「审批」与「改删别人的」，那部分仍然只给管理角色。
 */
function memberPerms(): string[] {
  const allowedMenus = [
    'menu:dashboard',
    'menu:activity-list',
    'menu:member',
    'menu:asset',
    'menu:venue',
    'menu:duty',
    'menu:announcement',
  ];
  const allowedActions = [
    'member:read',
    'activity:read',
    'notice:read',
    'file:read',
    'point:read',
    'leave:approve',
    // 自助类动作
    'asset:read',
    'asset:create',
    'venue:read',
    'venue:create',
    'duty:read',
    'announcement:read',
  ];
  return ALL_PERMISSION_CODES.filter(
    (code) => allowedMenus.includes(code) || allowedActions.includes(code),
  );
}

function permsForRole(roleCode: string): string[] {
  switch (roleCode) {
    case 'president':
      return presidentPerms();
    case 'vice_president':
      return vicePresidentPerms();
    case 'director':
      return managerPerms(DIRECTOR_WRITABLE);
    case 'officer':
      return managerPerms(OFFICER_WRITABLE);
    default:
      return memberPerms();
  }
}

// ---------------------------------------------------------------------------
// 五、经费科目与基础参数
// ---------------------------------------------------------------------------

const FUND_CATEGORIES = [
  { name: '会费收入', type: FundType.INCOME, sort: 1 },
  { name: '学校拨款', type: FundType.INCOME, sort: 2 },
  { name: '企业赞助', type: FundType.INCOME, sort: 3 },
  { name: '活动物料', type: FundType.EXPENSE, sort: 1 },
  { name: '场地与设备', type: FundType.EXPENSE, sort: 2 },
  { name: '宣传印刷', type: FundType.EXPENSE, sort: 3 },
  { name: '器材维护', type: FundType.EXPENSE, sort: 4 },
] as const;

const SYS_CONFIGS = [
  { configKey: 'auth.captcha.enabled', configValue: 'true', name: '登录是否要求图形验证码' },
  { configKey: 'member.initPassword', configValue: 'Xy@123456', name: '新增成员时的初始密码' },
  { configKey: 'upload.maxSize', configValue: '20971520', name: '单文件大小上限（字节）' },
  { configKey: 'checkin.qrcode.ttlSeconds', configValue: '30', name: '签到二维码刷新间隔（秒）' },
  { configKey: 'checkin.lateGraceMinutes', configValue: '10', name: '签到迟到宽限（分钟）' },
  { configKey: 'activity.remindHoursBefore', configValue: '24', name: '活动开始前提醒（小时）' },
  { configKey: 'fee.remindDaysBefore', configValue: '3', name: '会费截止前催缴（天）' },
  { configKey: 'approval.timeoutMinutes', configValue: '1440', name: '审批超时（分钟）' },
  { configKey: 'duty.remindHour', configValue: '20', name: '值班提醒时间（时）' },
] as const;

const DICTS = [
  {
    code: 'activity_type',
    name: '活动类型',
    remark: '活动分类，用于筛选与统计',
    items: [
      { label: '科普讲座', value: 'lecture', sort: 1, isDefault: true },
      { label: '观测活动', value: 'observation', sort: 2, isDefault: false },
      { label: '校内竞赛', value: 'contest', sort: 3, isDefault: false },
      { label: '志愿服务', value: 'volunteer', sort: 4, isDefault: false },
      { label: '团建交流', value: 'social', sort: 5, isDefault: false },
    ],
  },
  {
    code: 'leave_type',
    name: '请假类型',
    remark: '活动请假原因分类',
    items: [
      { label: '课程冲突', value: 'course', sort: 1, isDefault: true },
      { label: '身体不适', value: 'sick', sort: 2, isDefault: false },
      { label: '回家', value: 'home', sort: 3, isDefault: false },
      { label: '其他', value: 'other', sort: 4, isDefault: false },
    ],
  },
] as const;

/** 活动分类。与上面的 activity_type 字典对应，但活动表用的是独立分类表 */
const ACTIVITY_CATEGORIES = [
  { name: '科普讲座', color: '#3553c6', sort: 1 },
  { name: '观测活动', color: '#186147', sort: 2 },
  { name: '校内竞赛', color: '#7d510c', sort: 3 },
  { name: '志愿服务', color: '#2f7d5c', sort: 4 },
  { name: '团建交流', color: '#9c2f2f', sort: 5 },
] as const;

/**
 * 审批流程。活动立项走两级：先部门负责人，再社长。
 * approverType：1 指定角色 / 2 指定成员 / 3 部门负责人 / 4 上级（本项目取社长）
 * approveMode：1 或签 / 2 会签
 */
const APPROVAL_FLOWS = [
  {
    code: 'activity_apply',
    name: '活动立项审批',
    bizType: 'activity',
    description: '活动立项：部门负责人 → 社长',
    nodes: [
      {
        seq: 1,
        name: '部门负责人审批',
        approverType: 3,
        approverValue: null,
        approveMode: 1,
        timeoutHours: 24,
        timeoutAction: 1,
      },
      {
        seq: 2,
        name: '社长审批',
        approverType: 4,
        approverValue: null,
        approveMode: 1,
        timeoutHours: 48,
        timeoutAction: 1,
      },
    ],
  },
  {
    code: 'fund_expense',
    name: '经费收支审批',
    bizType: 'fund',
    description: '经费收支：秘书处复核 → 社长审批',
    nodes: [
      {
        seq: 1,
        name: '秘书处复核',
        approverType: 3,
        approverValue: null,
        approveMode: 1,
        timeoutHours: 24,
        timeoutAction: 1,
      },
      {
        seq: 2,
        name: '社长审批',
        approverType: 4,
        approverValue: null,
        approveMode: 1,
        timeoutHours: 48,
        timeoutAction: 1,
      },
    ],
  },
  {
    code: 'budget_apply',
    name: '预算申请审批',
    bizType: 'budget',
    description: '预算申请：社长单级审批',
    nodes: [
      {
        seq: 1,
        name: '社长审批',
        approverType: 4,
        approverValue: null,
        approveMode: 1,
        timeoutHours: 48,
        timeoutAction: 1,
      },
    ],
  },
] as const;

/** 场地。天台观测点是社团最常用的场地 */
const VENUES = [
  { name: '理学院天台观测点', location: '理学院 A 座顶层', capacity: 30, openTime: '18:00', closeTime: '23:00' },
  { name: '社团活动室', location: '学生活动中心 305', capacity: 40, openTime: '08:00', closeTime: '22:00' },
] as const;

/** 物资。可借数量初始等于总数，之后由借还记录驱动 */
const ASSETS = [
  { code: 'XYAS-EQ-001', name: '星特朗 130EQ 天文望远镜', category: '观测器材', spec: '130mm 反射式', unit: '台', totalQty: 2, location: '活动室器材柜' },
  { code: 'XYAS-EQ-002', name: '双筒望远镜', category: '观测器材', spec: '10×50', unit: '副', totalQty: 6, location: '活动室器材柜' },
  { code: 'XYAS-EQ-003', name: '指星笔', category: '观测器材', spec: '绿光', unit: '支', totalQty: 4, location: '活动室器材柜' },
  { code: 'XYAS-EQ-004', name: '便携投影仪', category: '宣传器材', spec: '1080P', unit: '台', totalQty: 1, location: '活动室储物柜' },
  { code: 'XYAS-EQ-005', name: '星图折页（印刷品）', category: '宣传物料', spec: 'A3 双面', unit: '份', totalQty: 200, location: '活动室纸箱' },
] as const;

const ANNOUNCEMENTS = [
  {
    title: '2026-2027 学年会费开始收缴',
    content:
      '各位社员：本学年会费每人 50 元，请在本月底前完成缴纳。可通过社长或秘书处缴纳现金，也可微信转账后上传凭证。' +
      '确有困难的同学请联系社长申请减免。',
    type: 2,
    isTop: true,
  },
  {
    title: '英仙座流星雨观测活动开始报名',
    content:
      '一年一度的英仙座流星雨来了。活动定于本月于理学院天台观测点举行，名额 20 人，需报名审核。' +
      '请自备保暖衣物，社团提供望远镜与星图。',
    type: 1,
    isTop: false,
  },
] as const;
const POINT_RULES = [
  { code: 'activity_join', name: '参与活动', eventType: 2, points: 5 },
  { code: 'activity_checkin', name: '活动签到', eventType: 1, points: 2 },
  { code: 'duty_finish', name: '完成值班', eventType: 3, points: 3 },
  { code: 'contribution', name: '突出贡献', eventType: 4, points: 10 },
  { code: 'violation', name: '违规扣分', eventType: 5, points: -5 },
] as const;

// ---------------------------------------------------------------------------
// 六、写入
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('清空种子数据…');
  await reset();

  console.log('写入社团与届次…');
  const club = await prisma.club.create({
    data: { ...CLUB, status: ClubStatus.NORMAL },
  });

  const term = await prisma.term.create({
    data: {
      clubId: club.id,
      name: TERM.name,
      startDate: TERM.startDate,
      endDate: TERM.endDate,
      isCurrent: true,
      status: TermStatus.ACTIVE,
    },
  });

  console.log('写入部门…');
  const deptIdByName = new Map<string, bigint>();
  for (const dept of DEPARTMENTS) {
    const row = await prisma.department.create({
      data: {
        clubId: club.id,
        parentId: null,
        name: dept.name,
        description: dept.description,
        sort: dept.sort,
        status: EnableStatus.ENABLED,
      },
    });
    deptIdByName.set(dept.name, row.id);
  }

  console.log('写入权限树…');
  const permissionIdByCode = new Map<string, bigint>();

  // 目录与菜单：按树的深度顺序写入，父节点先于子节点
  for (const { node, parentCode } of flattenMenuTree()) {
    const parentId = parentCode === null ? null : (permissionIdByCode.get(parentCode) ?? null);
    const row = await prisma.permission.create({
      data: {
        parentId,
        name: node.name,
        code: node.code,
        type: node.type,
        path: node.path ?? null,
        component: node.component ?? null,
        icon: node.icon ?? null,
        sort: node.sort,
        status: EnableStatus.ENABLED,
      },
    });
    permissionIdByCode.set(node.code, row.id);
  }

  // 功能权限：按模块归到对应的菜单下
  for (const perm of ACTION_PERMISSIONS) {
    const module = perm.code.split(':')[0] as string;
    const menuCode = menuCodeForModule(module);
    const parentId = menuCode === null ? null : (permissionIdByCode.get(menuCode) ?? null);
    const row = await prisma.permission.create({
      data: {
        parentId,
        name: perm.name,
        code: perm.code,
        type: PermissionType.ACTION,
        sort: perm.sort,
        status: EnableStatus.ENABLED,
      },
    });
    permissionIdByCode.set(perm.code, row.id);
  }

  const permissionTotal = await prisma.permission.count();
  console.log(
    `  菜单权限 ${MENU_PERMISSION_CODES.length} 条，功能权限 ${ACTION_PERMISSIONS.length} 条，共 ${permissionTotal} 条`,
  );

  console.log('写入角色与角色权限…');
  const roleIdByCode = new Map<string, bigint>();
  for (const role of ROLES) {
    const row = await prisma.role.create({
      data: {
        clubId: club.id,
        name: role.name,
        code: role.code,
        dataScope: role.dataScope,
        description: role.description,
        isSystem: role.isSystem,
        sort: role.sort,
        status: EnableStatus.ENABLED,
      },
    });
    roleIdByCode.set(role.code, row.id);

    const codes = permsForRole(role.code);
    await prisma.rolePermission.createMany({
      data: codes
        .map((code) => permissionIdByCode.get(code))
        .filter((id): id is bigint => id !== undefined)
        .map((permissionId) => ({ roleId: row.id, permissionId })),
    });
    console.log(`  ${role.name}（dataScope=${role.dataScope}）分配 ${codes.length} 条权限`);
  }

  console.log('写入成员账号…');
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, BCRYPT_COST);
  const memberIdByNo = new Map<string, bigint>();

  for (const [index, person] of MEMBERS.entries()) {
    const user = await prisma.user.create({
      data: {
        username: person.studentNo,
        passwordHash,
        realName: person.realName,
        studentNo: person.studentNo,
        gender: person.gender,
        email: `${person.studentNo}@example.edu.cn`,
        phone: `138${String(10000000 + index).padStart(8, '0')}`,
        college: CLUB.collegeName,
        major: person.major,
        className: person.className,
        grade: person.grade,
        registerSource: RegisterSource.ADMIN,
        status: UserStatus.NORMAL,
      },
    });

    const member = await prisma.member.create({
      data: {
        clubId: club.id,
        userId: user.id,
        termId: term.id,
        deptId: deptIdByName.get(person.dept) ?? null,
        memberNo: person.memberNo,
        position: person.position,
        joinDate: TERM.startDate,
        status: MemberStatus.ACTIVE,
        isCore: person.isCore,
      },
    });
    memberIdByNo.set(person.memberNo, member.id);

    const roleId = roleIdByCode.get(person.roleCode);
    if (roleId !== undefined) {
      await prisma.memberRole.create({ data: { memberId: member.id, roleId } });
    }
  }

  console.log('回填部门负责人…');
  for (const [no, deptName] of [
    ['XYAS-2026-002', '学术部'],
    ['XYAS-2026-003', '观测部'],
    ['XYAS-2026-006', '宣传部'],
    ['XYAS-2026-001', '秘书处'],
  ] as const) {
    const leaderMemberId = memberIdByNo.get(no);
    const deptId = deptIdByName.get(deptName);
    if (leaderMemberId !== undefined && deptId !== undefined) {
      await prisma.department.update({ where: { id: deptId }, data: { leaderMemberId } });
    }
  }

  console.log('写入经费账户与科目…');
  await prisma.fundAccount.create({
    data: {
      clubId: club.id,
      name: '社团经费账户',
      accountNo: 'XYAS-CASH-001',
      initialAmount: 0,
      isDefault: true,
      status: EnableStatus.ENABLED,
    },
  });

  for (const category of FUND_CATEGORIES) {
    await prisma.fundCategory.create({
      data: {
        clubId: club.id,
        parentId: null,
        name: category.name,
        type: category.type,
        sort: category.sort,
        status: EnableStatus.ENABLED,
      },
    });
  }

  console.log('写入活动分类…');
  for (const category of ACTIVITY_CATEGORIES) {
    await prisma.activityCategory.create({
      data: {
        clubId: club.id,
        name: category.name,
        color: category.color,
        sort: category.sort,
        status: EnableStatus.ENABLED,
      },
    });
  }

  console.log('写入审批流程与节点…');
  for (const flow of APPROVAL_FLOWS) {
    const created = await prisma.approvalFlow.create({
      data: {
        clubId: club.id,
        code: flow.code,
        name: flow.name,
        bizType: flow.bizType,
        description: flow.description,
        version: 1,
        status: EnableStatus.ENABLED,
      },
    });
    for (const node of flow.nodes) {
      await prisma.approvalNode.create({
        data: {
          flowId: created.id,
          seq: node.seq,
          name: node.name,
          approverType: node.approverType,
          approverValue: node.approverValue,
          approveMode: node.approveMode,
          allowEmptySkip: false,
          timeoutHours: node.timeoutHours,
          timeoutAction: node.timeoutAction,
        },
      });
    }
    console.log(`  ${flow.name}：${flow.nodes.length} 个节点`);
  }

  console.log('写入场地与物资…');
  for (const venue of VENUES) {
    await prisma.venue.create({
      data: {
        clubId: club.id,
        name: venue.name,
        location: venue.location,
        capacity: venue.capacity,
        openTime: venue.openTime,
        closeTime: venue.closeTime,
        status: EnableStatus.ENABLED,
      },
    });
  }
  for (const asset of ASSETS) {
    await prisma.asset.create({
      data: {
        clubId: club.id,
        code: asset.code,
        name: asset.name,
        category: asset.category,
        spec: asset.spec,
        unit: asset.unit,
        totalQty: asset.totalQty,
        availableQty: asset.totalQty,
        location: asset.location,
        status: EnableStatus.ENABLED,
      },
    });
  }

  console.log('写入公告…');
  for (const item of ANNOUNCEMENTS) {
    await prisma.announcement.create({
      data: {
        clubId: club.id,
        title: item.title,
        content: item.content,
        type: item.type,
        isTop: item.isTop,
        publishStatus: 2,
        publishAt: new Date(),
        publisherMemberId: memberIdByNo.get('XYAS-2026-001') ?? null,
        viewCount: 0,
      },
    });
  }

  console.log('写入积分规则…');
  for (const rule of POINT_RULES) {
    await prisma.pointRule.create({
      data: {
        clubId: club.id,
        code: rule.code,
        name: rule.name,
        eventType: rule.eventType,
        points: rule.points,
        maxPerTerm: 0,
        status: EnableStatus.ENABLED,
      },
    });
  }

  console.log('写入基础参数与字典…');
  for (const config of SYS_CONFIGS) {
    await prisma.sysConfig.create({
      data: {
        clubId: null, // null = 全局参数
        configKey: config.configKey,
        configValue: config.configValue,
        name: config.name,
      },
    });
  }

  for (const dict of DICTS) {
    const created = await prisma.sysDict.create({
      data: { code: dict.code, name: dict.name, remark: dict.remark, status: EnableStatus.ENABLED },
    });
    for (const item of dict.items) {
      await prisma.sysDictItem.create({
        data: {
          dictId: created.id,
          label: item.label,
          value: item.value,
          sort: item.sort,
          isDefault: 'isDefault' in item ? (item.isDefault ?? false) : false,
          status: EnableStatus.ENABLED,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  const counts = {
    社团: await prisma.club.count(),
    届次: await prisma.term.count(),
    部门: await prisma.department.count(),
    权限: await prisma.permission.count(),
    角色: await prisma.role.count(),
    角色权限: await prisma.rolePermission.count(),
    用户: await prisma.user.count(),
    成员: await prisma.member.count(),
    成员角色: await prisma.memberRole.count(),
    经费账户: await prisma.fundAccount.count(),
    经费科目: await prisma.fundCategory.count(),
    参数: await prisma.sysConfig.count(),
    字典项: await prisma.sysDictItem.count(),
  };

  console.log('\n种子数据写入完成：');
  for (const [label, value] of Object.entries(counts)) {
    console.log(`  ${label.padEnd(6, '　')} ${value}`);
  }
  console.log(`\n管理员登录：${ADMIN_MEMBER.studentNo} / ${DEV_PASSWORD}（${ADMIN_MEMBER.realName}，社长）`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('种子数据写入失败：', error);
    await prisma.$disconnect();
    process.exit(1);
  });
