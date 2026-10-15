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

  await prisma.fundTransaction.deleteMany();
  await prisma.fundBudget.deleteMany();
  await prisma.memberRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.member.deleteMany();
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

/** 普通成员：只看自己的，菜单只留工作台与活动 */
function memberPerms(): string[] {
  const allowedMenus = ['menu:dashboard', 'menu:activity-list'];
  const allowedActions = ['activity:read', 'notice:read', 'file:read', 'point:read', 'leave:approve'];
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
