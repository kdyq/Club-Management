# 社团管理系统 · 开发文档

> 版本：v1.0（2026-10-15）
> 配套文档：`docs/database-design.md`（数据库设计）、`design/README.md`（视觉方案）
> 本文件是开发的唯一入口。动手写代码前先读完第 2、5、7 章。

---

## 目录

1. [这份文档怎么用](#1-这份文档怎么用)
2. [项目定位与范围](#2-项目定位与范围)
3. [技术栈（已锁定，不要改）](#3-技术栈已锁定不要改)
4. [仓库结构](#4-仓库结构)
5. [环境准备与初始化](#5-环境准备与初始化)
6. [数据库落地约定](#6-数据库落地约定)
7. [后端架构](#7-后端架构)
8. [前端架构](#8-前端架构)
9. [设计系统：方向 A 的工程化落地](#9-设计系统方向-a-的工程化落地)
10. [共享层](#10-共享层)
11. [开发规范](#11-开发规范)
12. [分阶段实施计划](#12-分阶段实施计划)
13. [测试策略](#13-测试策略)
14. [部署](#14-部署)
15. [风险与待定项](#15-风险与待定项)

---

## 1. 这份文档怎么用

| 你要做的事 | 看哪几章 |
|---|---|
| 刚接手，搭环境跑起来 | 第 3、4、5 章 |
| 加一个新模块（例如「值班表」） | 第 7 章 + 第 12 章对应阶段 + 第 11 章规范 |
| 改数据库 | 第 6 章，然后改 `prisma/schema.prisma` |
| 调样式 / 加组件 | 第 8、9 章 |
| 加一个接口 | 第 7.2 至 7.5 节 |
| 阶段交付前检查 | 第 12 章的验收标准 + 第 13 章 |

**三条不可违背的红线**（违反会导致返工，见各章详述）：

1. **业务代码里不出现颜色字面值**，一律走 CSS 变量（第 9 章）。
2. **每个查询都必须带租户与数据范围过滤**，不能只靠前端隐藏（第 7.5 节）。
3. **聚合数字（余额、积分、票数）一律由流水算出**，缓存字段必须能重算（第 6.3 节）。

---

## 2. 项目定位与范围

**目标**：一套服务学生社团的成员、活动、经费管理系统。当前定位是个人练手项目，
不围绕比赛排期；但架构仍按「将来能服务多个社团」来设计，不写死单社团假设。

**首要评价标准**：功能完整度与业务闭环，其次才是视觉效果。所以实施顺序上，
先把一条业务链路从头到尾跑通（活动从立项到归档），再铺开模块广度。

**明确不做**（避免范围蔓延）：

- 不做出入校门禁、宿舍管理等与社团无关的校园系统
- 不做即时聊天（通知用站内信加推送，不做 IM）
- 不做在线支付（会费只记「已缴 / 未缴 + 凭证」，不接支付网关）
- 不做原生 App（移动端走响应式，有余力再考虑小程序）

---

## 3. 技术栈（已锁定，不要改）

```
前端   Vue 3 + TypeScript + Vite + Pinia + Vue Router + Element Plus + ECharts + Axios
后端   NestJS + Prisma + Passport-JWT + class-validator + @nestjs/swagger + ExcelJS
数据库  MySQL 8.0（本机已作为 Windows 服务运行）
缓存    Redis 8.8（登录限流、首页聚合缓存、定时任务队列）
文件    本地磁盘（Multer），通过 storageType 字段预留对象存储切换
动效    GSAP 3.13 + ScrollTrigger（仅用于仪表盘与登录页，见 8.6 节）
部署    Vite 构建产物由 NestJS 静态托管，单进程起服务；需要守护进程用 pm2
```

**为什么不用别的**（避免反复讨论）：

- **不用 Java / Spring**：本机只有 JDK 8 且没有 Maven，Spring Boot 3 需要 JDK 17+，
  2.7 已停止维护。走 Java 要先装环境，纯属浪费时间。
- **不用 Docker**：本机没有 Docker，而 MySQL / Redis 都是原生服务，直接连更简单。
- **不用 PostgreSQL**：PG 技术上更强，但国内比赛评委与云服务器默认 MySQL，风险更低。
- **不用 FastAPI**：写起来更快，但无法与前端共享类型。全栈 TypeScript 是本项目的核心收益之一。

---

## 4. 仓库结构

单仓库、两个应用加一个共享包。**不要拆成多个仓库**，个人项目拆仓库只会增加同步成本。

```
club-management/
├── package.json                 工作区根，npm workspaces（用 workspaces 字段声明）
├── .env / .env.example          环境变量（.env 不入库）
├── .gitignore
├── prisma/
│   ├── schema.prisma            62 张表，已通过 prisma validate
│   ├── migrations/              版本化迁移，必须入库
│   └── seed.ts                  开发种子数据（管理员、部门、示例成员）
├── packages/
│   └── shared/                  前后端共享：类型、枚举、常量、校验规则
│       ├── src/enums/           状态枚举（唯一真相，见第 10 章）
│       ├── src/constants/       权限码、错误码、配置键
│       └── src/dto/             请求与响应类型
├── apps/
│   ├── server/                  NestJS
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/          跨模块基础设施
│   │   │   │   ├── filters/     全局异常过滤器
│   │   │   │   ├── interceptors/ 统一响应体、审计日志
│   │   │   │   ├── decorators/  @CurrentMember() @RequirePerm() @DataScope()
│   │   │   │   ├── guards/      JwtAuthGuard、PermissionGuard
│   │   │   │   └── prisma/      PrismaService、软删除扩展、数据范围扩展
│   │   │   ├── modules/
│   │   │   │   ├── auth/        登录、刷新、登出、验证码
│   │   │   │   ├── club/  term/  department/
│   │   │   │   ├── user/  member/  role/  permission/
│   │   │   │   ├── activity/  registration/  checkin/
│   │   │   │   ├── fund/  budget/  fee/
│   │   │   │   ├── approval/    审批引擎
│   │   │   │   ├── notice/  file/  duty/  asset/  venue/
│   │   │   │   ├── point/  recruit/  vote/  stats/
│   │   │   │   └── log/  dict/  config/
│   │   │   └── tasks/           定时任务（提醒、超时审批、对账）
│   │   └── test/
│   └── web/                     Vue 3
│       ├── src/
│       │   ├── main.ts
│       │   ├── App.vue
│       │   ├── api/             接口封装，按模块分文件
│       │   ├── router/          路由与守卫
│       │   ├── stores/          Pinia
│       │   ├── styles/          设计系统（见第 9 章）
│       │   │   ├── tokens.css   设计变量，唯一真相
│       │   │   ├── element.scss Element Plus 主题覆盖
│       │   │   └── index.scss
│       │   ├── components/      通用组件
│       │   ├── composables/     usePermission、useTable、useMotion
│       │   ├── directives/      v-perm
│       │   ├── layouts/         侧栏布局、空白布局
│       │   └── views/           页面，按模块分目录
│       └── vite.config.ts
├── design/                      设计原型（已完成，作为视觉参考保留）
└── docs/
    ├── database-design.md
    └── development-guide.md     本文件
```

---

## 5. 环境准备与初始化

### 5.1 本机已有

| 组件 | 版本 | 状态 |
|---|---|---|
| Node.js | v24.16.0 | 已装 |
| npm | 11.13.0 | 已装，本项目用它做工作区与脚本驱动 |
| TypeScript | 5.9.3 | 全局已装 |
| MySQL | 8.0.35 | Windows 服务 `MySQL80`，监听 3306 |
| Redis | 8.8.0 | Windows 服务 `Redis` |
| git | 2.53.0 | 已装 |
| npm 镜像 | registry.npmmirror.com | 已配置，装包快 |

不需要装 Docker，不需要装 JDK。

### 5.2 数据库初始化

先在 MySQL 里建库（字符集必须是 utf8mb4）：

```sql
CREATE DATABASE club_management
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

然后把 `.env.example` 复制为 `.env`，**把 `DATABASE_URL` 里的 `PASSWORD` 换成你本机
MySQL 的真实密码**。这一步不做，后面所有 Prisma 命令都会报
`Environment variable not found: DATABASE_URL` 或认证失败。

### 5.3 常用命令

```bash
npm install                         # 装依赖（工作区内所有包一起装）

npm run prisma:validate             # 校验 schema 语法与关系（改完 schema 先跑这个）
npm run prisma:format               # 规范化 schema 排版
npm run db:migrate -- --name xxx    # 生成迁移并应用到开发库
npm run db:deploy                   # 部署环境应用迁移
npm run db:studio                   # 可视化看数据
npm run db:seed                     # 灌种子数据

npm run dev:server                  # 起后端，默认 3000
npm run dev:web                     # 起前端，默认 5173
```

上面是根 `package.json` 里的快捷脚本。工作区内的单个包用 npm 原生写法调用，
例如 `npm run start:dev -w @club/server`。包名固定为 `@club/server`、`@club/web`、`@club/shared`。

**改表的流程**：改 `schema.prisma` → `prisma validate` → `prisma format` →
`prisma migrate dev --name 描述` → 提交迁移文件。**迁移文件必须入库**，
它是别人（或未来的你）能跑起这个项目的唯一保证。

---

## 6. 数据库落地约定

`docs/database-design.md` 是设计依据，`prisma/schema.prisma` 是它的代码化实现。
两者如有出入，以 **schema.prisma 为准**，并回头更新设计文档。

### 6.1 与设计文档的两处有意偏差

这两处是在写 schema 时发现的改进，已落地：

1. **`clubId` 是软引用，不建外键。** 设计文档原写「核心表建物理外键」。
   实测声明关系会让 `Club` 模型挂上 40 多个反向关系字段，可读性代价过大；
   而 club 行永不删除，外键提供不了额外完整性保障；租户隔离本来就必须在查询层
   强制（见 7.5 节），外键不代替它。所以各业务模型只保留 `clubId` 列与索引。
2. **`sys_config.clubId` 改为可空**，`null` 表示全局参数。原设计写「0 = 全局」，
   但 `0` 无法通过外键校验，可空语义更清楚。

### 6.2 状态字段用 Int，不用 Prisma enum

Prisma 的 `enum` 会建成 MySQL `ENUM` 列，增删取值需要 `ALTER TABLE`。
本项目统一用 `Int`，取值的唯一真相放在 `packages/shared/src/enums/`，
前后端 import 同一份常量。这样做的好处是：

- 加一个状态值只改常量文件，不动表结构
- 前端拿到的不是魔法数字，而是可读的常量
- 业务上需要运营人员配置的枚举（活动类型、经费科目）另走 `sys_dict` 字典表

代价是数据库里看到的是数字。用 `prisma/seed.ts` 里的字典数据与注释补足可读性。

### 6.3 聚合数字的处理

| 字段 | 谁是准的 | 缓存用途 |
|---|---|---|
| `fund_account` | **不存余额**，一律 `SUM(收入) - SUM(支出)` | 首页余额缓存在 Redis |
| `member.totalPoints` | `point_record` 流水 | 列表展示，避免每次 SUM |
| `asset.availableQty` | `asset_borrow` 未归还数量 | 借还页展示 |
| `vote_option.voteCount` | `vote_record` | 投票结果页 |
| `interview_slot.bookedCount` | `interview_appointment` | 剩余名额展示 |
| `fund_budget.usedAmount` | 关联流水汇总 | 预算执行率 |

**所有缓存字段都必须提供对账修复能力**。至少实现一个 `POST /api/admin/reconcile`
接口，重算指定表的缓存值。这是财务类系统不可退让的底线。

### 6.4 软删除

`deletedAt BigInt @default(0)`，`0` 表示未删除，否则存删除瞬间的毫秒时间戳。

**不要用可空 DateTime**。MySQL 唯一索引不比较 `NULL`，若 `deletedAt` 允许为 NULL，
`UNIQUE(club_id, user_id, term_id, deleted_at)` 在多次删除后会产生多行 NULL 从而失效，
「删掉再加入」就会撞唯一键。

查询时用 Prisma 扩展自动过滤，不要在每处 `where` 手写 `deletedAt: 0`：

```ts
// common/prisma/soft-delete.extension.ts 思路
prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const softDeleteModels = SOFT_DELETE_MODELS; // 白名单
        if (softDeleteModels.has(model)) {
          if (['findMany', 'findFirst', 'count', 'aggregate'].includes(operation)) {
            args.where = { ...args.where, deletedAt: 0n };
          }
        }
        return query(args);
      },
    },
  },
});
```

删除操作一律改写成 `UPDATE ... SET deleted_at = 当前毫秒`。
**财务流水例外**：流水只能改 `status = 3`（已作废）并记录 `voidReason`，
绝不物理删除也绝不软删除，否则审计链断裂。

### 6.5 并发必须靠数据库兜底

应用层的「先查再插」在并发下一定失效。以下场景的唯一索引是最终防线，**不要删**：

| 场景 | 约束 |
|---|---|
| 重复签到 | `UNIQUE(activity_id, member_id, deleted_at)` |
| 重复报名 | `UNIQUE(activity_id, member_id, deleted_at)` |
| 重复投票 | `UNIQUE(vote_id, option_id, member_id)` |
| 会费重复缴纳 | `UNIQUE(fee_standard_id, member_id)` |
| 一人一届一次考核 | `UNIQUE(term_id, member_id, deleted_at)` |
| 同一面试官对同一申请只评一次 | `UNIQUE(application_id, interviewer_member_id)` |

活动报名超额、场地预约时间冲突这两类涉及计数与区间判断，唯一索引覆盖不到，
必须在事务内用 `SELECT ... FOR UPDATE` 加锁校验。

---

## 7. 后端架构

### 7.1 分层

每个模块固定四层，不要跨层调用：

```
Controller   只做参数接收与响应包装，不写业务判断
  ↓
Service      业务逻辑与事务边界。事务一律在 Service 层用 prisma.$transaction
  ↓
Repository   可选。只有查询复杂到需要复用时才抽，不要为每个 Service 都建一个
  ↓
Prisma       数据访问
```

DTO 用 `class-validator` 装饰器声明校验规则，配合全局 `ValidationPipe`
（`whitelist: true, transform: true`）。**不要手写参数校验**。

Swagger 装饰器（`@ApiTags` `@ApiOperation`）要跟上，自动生成的接口文档是排错与接手项目的入口。

**模块格式：全仓库 ESM。** NestJS 12 的官方包已经是 ESM-only（`"type": "module"`），
所以 `apps/server` 与 `packages/shared` 都声明了 `"type": "module"`，tsconfig 用
`module: nodenext`。由此带来两条硬性约定：

- **相对导入必须带 `.js` 扩展名**，例如 `import { AppModule } from './app.module.js'`。
  这是 Node ESM 的解析规则作用在编译产物上的要求，不是笔误。
- **没有 `__dirname`**，需要目录时用 `import.meta.dirname`。

### 7.2 统一响应体

```ts
// 成功
{ code: 0, message: "ok", data: T, traceId: "..." }

// 分页
{ code: 0, message: "ok", data: { list: T[], total: number, page: number, pageSize: number } }

// 失败
{ code: 40101, message: "登录已过期", data: null, traceId: "..." }
```

实现方式：全局拦截器包成功响应，全局异常过滤器包失败响应。Controller 里
直接 `return data`，不要手动拼这一层。

HTTP 状态码保持语义正确（400 参数错、401 未登录、403 无权限、404 不存在、
500 服务器错），**不要一律返回 200**，那样 Swagger 与前端拦截器都会失真。

### 7.3 错误码

五位数字，前三位对应 HTTP 状态码，后两位是该类下的序号：

| 区间 | 含义 |
|---|---|
| `400xx` | 参数校验失败、业务规则不满足 |
| `401xx` | 未登录、Token 过期、密码错误 |
| `403xx` | 已登录但无权限、数据范围外 |
| `404xx` | 资源不存在 |
| `409xx` | 冲突（重复报名、唯一键冲突、状态不允许该操作） |
| `500xx` | 服务器内部错误 |

错误码常量放 `packages/shared/src/constants/error-codes.ts`，前后端共用。
Prisma 的 `P2002`（唯一键冲突）必须在全局过滤器里映射成 `409xx` 并给出
**可读的中文提示**，不要把原始错误抛给前端。

### 7.4 认证

- 登录成功签发 **access token（2 小时）+ refresh token（14 天）**，双 token。
- access token 存内存（Pinia），refresh token 存 `httpOnly` Cookie。
  **不要把 access token 存 localStorage**，XSS 时会被直接读走。
- 登录接口按 IP + 用户名双维度限流，用 Redis 计数，5 次失败锁 10 分钟。
- 密码 `bcrypt` 哈希，cost 10。数据库里绝不出现明文。
- 前端 Axios 拦截器在 401 时用 refresh token 静默续期一次，失败才跳登录页。
  续期请求要加并发锁，避免多个 401 同时触发多次续期。

### 7.5 权限：功能权限 + 数据范围

权限是**两层**，缺一不可。只做第一层是最常见的越权来源。

**第一层，功能权限**：`role_permission` 决定「能不能做这个操作」。
用装饰器声明，Guard 校验：

```ts
@Post()
@RequirePerm('member:create')
@ApiOperation({ summary: '新增成员' })
create(@Body() dto: CreateMemberDto, @CurrentMember() me: MemberContext) { ... }
```

权限码命名统一为 `模块:动作`，动作限定为
`create / read / update / delete / export / audit / approve`。
完整清单放 `packages/shared/src/constants/permissions.ts`。

**第二层，数据权限**：`role.dataScope` 决定「能看谁的数据」。

| dataScope | 含义 | 追加条件 |
|---|---|---|
| 1 | 仅本人 | `memberId = 当前成员` |
| 2 | 本部门 | `deptId = 当前部门` |
| 3 | 本部门及以下 | `deptId IN (当前部门及子孙部门)` |
| 4 | 本社团 | `clubId = 当前社团` |
| 5 | 全部 | 不加条件 |

多角色时取**最大范围**（并集）。

落地方式：在 Service 层统一调用一个工具函数生成 where 片段，
**不要在每个 Service 里手写**，否则迟早漏掉一个接口导致越权。

```ts
// common/prisma/data-scope.ts 思路
export async function buildScopeWhere(
  me: MemberContext,
  resource: 'member' | 'activity' | 'fund' | 'file' | ...,
): Promise<Prisma.Args<any, 'findMany'>['where']> {
  const scope = maxScopeOf(me.roles);           // 多角色取并集
  if (scope === DataScope.ALL) return {};
  if (scope === DataScope.CLUB) return { clubId: me.clubId };
  if (scope === DataScope.DEPT_AND_BELOW)
    return { clubId: me.clubId, deptId: { in: await deptSubtreeIds(me.deptId) } };
  if (scope === DataScope.DEPT) return { clubId: me.clubId, deptId: me.deptId };
  return { id: me.memberId };                    // 仅本人
}
```

部门树用递归 CTE 或物化路径求子孙集合。社团级数据量下递归 CTE 完全够用，
不必引入闭包表。

**导出接口同样要过数据范围**。Excel 导出是最容易被忽略的越权入口。

### 7.6 审批引擎用法

审批是横切能力，活动和经费都复用它。业务模块只需两步：

```ts
// 1. 提交审批
const instance = await approvalService.submit({
  clubId, bizType: 'activity', bizId: activity.id,
  title: `活动立项：${activity.title}`,
  applicantMemberId: me.memberId,
  formData: { budgetAmount: activity.budgetAmount },
});

// 2. 记录关联，并把业务状态推进到「待审批」
await prisma.activity.update({
  where: { id: activity.id },
  data: { status: ActivityStatus.PENDING_APPROVAL, approvalInstanceId: instance.id },
});
```

审批通过后由审批模块**回调**业务模块，业务模块实现统一的接口：

```ts
export interface ApprovableHandler {
  bizType: string;
  onApproved(instance: ApprovalInstance): Promise<void>;
  onRejected(instance: ApprovalInstance, opinion: string): Promise<void>;
}
```

用 NestJS 的 `DiscoveryService` 自动收集所有实现，按 `bizType` 注册成路由表。
**不要在业务模块里轮询审批状态**，那是反向依赖。

审批节点支持「或签 / 会签」，以及超时后的四种动作（提醒、自动通过、自动驳回、
转交上级）。超时检查由 `tasks/approval-timeout.task.ts` 每分钟扫描一次。

### 7.7 审计日志

用全局拦截器 + 装饰器实现。给需要留痕的接口加 `@Audit('member', 'update')`：

- 自动记录请求参数（**必须脱敏 password、token 等字段**）
- 自动记录变更前后的值（Service 层更新前先查出旧值）
- 财务与权限相关的变更**强制留痕**，不允许用装饰器关掉

`operation_log.beforeValue` / `afterValue` 是回答「怎么保证财务不可篡改」的依据。

### 7.8 文件上传

- 存本地磁盘，路径 `storage/uploads/{yyyy}/{MM}/{uuid}.{ext}`
- **按扩展名与 MIME 双重白名单校验**，不信任客户端传来的 `Content-Type`
- 大小上限从 `sys_config` 读，默认 20MB
- 文件名用 UUID 重命名，**绝不使用用户上传的原始文件名做路径**（防路径穿越）
- 上传时算 MD5，命中已有记录则秒传（`file.md5` 上有索引）
- 下载走鉴权接口，不直接暴露磁盘路径。`scope` 与 `file_grant` 决定能否下载
- 预留 `storageType` 字段，将来切对象存储只改存储实现类，不动业务代码

### 7.9 定时任务

| 任务 | 频率 | 作用 |
|---|---|---|
| 活动提醒 | 每 10 分钟 | 活动开始前 24 小时给报名者发通知 |
| 审批超时 | 每分钟 | 按节点配置执行提醒 / 自动通过 / 转交 |
| 会费催缴 | 每天 09:00 | 截止前 3 天给欠费成员发通知 |
| 值班提醒 | 每天 20:00 | 提醒次日值班人员 |
| 积分对账 | 每天 03:00 | 重算 `member.totalPoints` 并记录差异 |
| 日志归档 | 每月 1 日 | 90 天前的 `operation_log` 归档 |

用 `@nestjs/schedule`。任务要**幂等**，重复执行不能产生重复通知或重复扣分。

---

## 8. 前端架构

### 8.1 目录职责

| 目录 | 放什么 | 不放什么 |
|---|---|---|
| `api/` | 接口函数，一个模块一个文件 | 不放业务判断 |
| `stores/` | 跨页面共享的状态（当前用户、权限、字典、主题） | 不放只在单页面用的状态 |
| `views/` | 页面级组件 | 不放可复用的通用组件 |
| `components/` | 可复用组件，按功能分子目录 | 不放接口调用 |
| `composables/` | 可复用的组合式逻辑 | 不放样式 |
| `directives/` | 全局指令（只有 `v-perm` 一个） | |

### 8.2 状态管理边界

**Pinia 只放这五样**：`user`（当前用户与成员身份）、`permission`（权限码集合与数据范围）、`dict`（字典缓存）、`theme`（主题）、`app`（侧栏折叠等界面状态）。

**列表数据、表单数据、筛选条件一律放组件内**。放进 Pinia 会导致状态不同步、
缓存脏数据、返回页面时看到别人的数据。这是 Vue 项目最常见的架构失误。

### 8.3 API 层

```ts
// api/member.ts
import type { PageResult, MemberVO, MemberQuery } from '@club/shared';

export const memberApi = {
  page: (params: MemberQuery) => http.get<PageResult<MemberVO>>('/members', { params }),
  create: (data: CreateMemberDto) => http.post<MemberVO>('/members', data),
  update: (id: string, data: UpdateMemberDto) => http.put<MemberVO>(`/members/${id}`, data),
  remove: (id: string) => http.delete<void>(`/members/${id}`),
  export: (params: MemberQuery) => http.download('/members/export', params),
};
```

Axios 实例统一处理三件事：注入 `Authorization`、解包响应体的 `data` 字段、
401 时静默续期。**业务代码里不要出现 `.data.data`**。

### 8.4 权限控制

```vue
<!-- 按钮级 -->
<a-button v-perm="'member:create'" type="primary">新增成员</a-button>

<!-- 逻辑里判断 -->
<script setup lang="ts">
const { hasPerm, inScope } = usePermission();
if (!hasPerm('member:export')) { ... }
</script>
```

路由守卫在进入页面前校验权限码，无权限跳 403 页。
**前端权限只是体验优化，真正的拦截必须在后端**。只靠前端隐藏的权限等于没有权限。

### 8.5 表格页的统一形态

项目中大量页面是「筛选 + 表格 + 分页」。抽一个 `useTable` 组合式函数统一处理
加载态、分页、筛选、排序、刷新，避免每个页面各写一遍：

```ts
const { list, total, loading, query, reload } = useTable(memberApi.page, {
  defaultQuery: { page: 1, pageSize: 20 },
  immediate: true,
});
```

对应设计要求（见 `design/README.md` 列出的可触发状态）：

- **加载态**用骨架屏，形状与最终内容一致，避免布局跳动
- **空状态**要区分「确实没有数据」与「筛选后没有结果」，后者给「清空筛选」按钮
- **错误态**在表单里走行内提示，在列表页走卡片式错误面板
- 表格行高、单元格内边距固定，渲染前后不跳动

### 8.6 动效规范

用 GSAP，但**只在三个地方**用，其余一律用 CSS `transition`：

| 位置 | 动效 | 动机 |
|---|---|---|
| 数字指标 | 进入视口时数字增长 | 让读数像刚算出来，而非静态贴图 |
| 面板容器 | 首次渲染时错峰淡入 | 建立阅读顺序，引导视线 |
| 经费趋势线 | 滚入视口时按路径绘制 | 叙事：把这段时间的支出读出来 |

硬性约束：

- 只动 `transform` 与 `opacity`，**绝不动 `width` / `height` / `top` / `left`**
- **禁止 `window.addEventListener('scroll')`**。滚动相关一律用 `ScrollTrigger`
- 每个动效都要能一句话说明动机。说不出来就不要加
- 全局 `prefers-reduced-motion` 判断，命中时折叠为静态（原型里已有实现，照搬 `design/js/motion.js`）
- 组件卸载时清理 `ScrollTrigger`，用 `gsap.context()` 或 `useGSAP()` 包裹
- **循环动效全站最多一处**（报名中的实时指示点），且必须有语义

### 8.7 响应式

- 断点：`sm 640 / md 768 / lg 1024 / xl 1280`
- 侧栏在 `< 1024px` 收成横向滚动条，与原型一致
- 表格在 `< 768px` 转为卡片列表，**不要横向滚动**
- 全高容器用 `min-height: 100dvh`，不用 `100vh`（iOS 地址栏会顶掉内容）

---

## 9. 设计系统：方向 A 的工程化落地

视觉方案已定为**方向 A · 静默墨蓝**。原型在 `design/direction-a.html`，
变量定义在 `design/css/a-calm.css`。本节把它变成工程约束。

### 9.1 三层变结构

```
tokens.css          原始值，唯一真相。业务代码只准引用这一层的变量
      ↓
element.scss        Element Plus 主题变量覆盖，把 tokens 喂给它
      ↓
业务组件           只用 Element Plus 组件 + 少量自定义类，不写颜色字面值
```

**红线：`.vue` 文件里不出现 `#` 开头的颜色值**，也不出现 `rgb(` / `rgba(`。
需要新颜色时先在 `tokens.css` 里加变量。评审时可以用一条 grep 检查：

```bash
grep -rEn "#[0-9a-fA-F]{3,8}\b" apps/web/src --include=*.vue
```

这条命令的输出应该是空的。

### 9.2 tokens.css

```css
:root {
  /* 中性色：冷调单一灰族，不混暖灰 */
  --c-canvas:        #f5f6f8;  /* 页面底色 */
  --c-surface:       #ffffff;  /* 卡片、面板 */
  --c-surface-sunken:#fafbfc;  /* 表头、悬停行、内容区凹陷面 */
  --c-border:        #e3e7ed;
  --c-border-strong: #cbd2db;

  /* 文字：三级，均按 WCAG AA(4.5:1) 验算过 */
  --c-text:   #141a24;  /* 对白 16.7:1 */
  --c-text-2: #4a5566;  /* 对白 7.5:1 */
  --c-text-3: #66707f;  /* 对白 5.0:1，占位符与次级元信息同样达标 */

  /* 唯一的强调色：钴蓝，饱和度 57% */
  --c-accent:       #3553c6;
  --c-accent-hover: #2b45a8;
  --c-accent-tint:  #edf0fb;
  --c-accent-ring:  rgba(53, 83, 198, 0.18);
  --c-on-accent:    #ffffff;  /* 白字在强调色上 6.6:1 */

  /* 语义色：只用于表达状态，不做装饰 */
  --c-ok:     #186147;  --c-ok-tint:     #e8f3ee;
  --c-warn:   #7d510c;  --c-warn-tint:   #f7f0e2;
  --c-danger: #9c2f2f;  --c-danger-tint: #f8ecec;
  --c-neutral-tint: #eceff4;  --c-neutral-text: #4a5566;

  /* 圆角：容器 / 控件 / 标签 / 头像 四档，全站不引入第五档 */
  --r-container: 10px;
  --r-control:   8px;
  --r-tag:       6px;
  --r-avatar:    8px;

  --shadow-panel: 0 1px 2px rgba(20, 26, 36, 0.04);

  /* 字体：中文优先走系统字重较全的家族，不依赖外部字体服务 */
  --font-ui: ui-sans-serif, "Segoe UI Variable Text", "Segoe UI", system-ui,
    -apple-system, "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI",
    "Microsoft YaHei", sans-serif;
  --font-mono: "Cascadia Mono", ui-monospace, "SF Mono", Consolas, monospace;

  /* 间距标尺：4px 基准，只允许用这七档 */
  --sp-1: 4px;  --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px;  --sp-8: 32px;  --sp-12: 48px;
}
```

### 9.3 Element Plus 主题映射

Element Plus 2.x 的 `--el-color-primary-light-N` 是把主色与白色按
`N*10%` 混合得到的。用 SCSS 的 `@forward ... with` 让 EP 自己算，
**不要手动写一串 light 变量**，否则升级 EP 后色阶会对不上。

```scss
// apps/web/src/styles/element.scss
@forward "element-plus/theme-chalk/src/common/var.scss" with (
  $colors: (
    "primary": ("base": #3553c6),
    "success": ("base": #2f7d5c),
    "warning": ("base": #9a6a11),
    "danger":  ("base": #b03a3a),
    "error":   ("base": #b03a3a),
    "info":    ("base": #66707f)
  ),
  $text-color: (
    "primary":   #141a24,
    "regular":   #4a5566,
    "secondary": #66707f,
    "placeholder": #66707f,
    "disabled":  #a3aab5
  ),
  $border-color: (
    "":            #e3e7ed,
    "light":       #e3e7ed,
    "lighter":     #edf0f4,
    "extra-light": #f5f6f8,
    "dark":        #cbd2db,
    "darker":      #cbd2db
  ),
  $bg-color: (
    "":         #ffffff,
    "page":     #f5f6f8,
    "overlay":  #ffffff
  ),
  $fill-color: (
    "":            #f5f6f8,
    "light":       #fafbfc,
    "lighter":     #fafbfc,
    "extra-light": #ffffff,
    "dark":        #e3e7ed,
    "darker":      #e3e7ed,
    "blank":       #ffffff
  ),
  $border-radius: ("base": 8px, "small": 6px, "round": 20px, "circle": 100%)
);

@use "element-plus/theme-chalk/src/index.scss" as *;
```

几个需要单独覆盖的组件变量（EP 的默认值与本设计不一致）：

```scss
:root {
  --el-font-family: var(--font-ui);
  --el-font-size-base: 14px;
  --el-card-border-radius: var(--r-container);   /* EP 默认 4px */
  --el-card-padding: var(--sp-5);
  --el-border-radius-base: var(--r-control);
  --el-border-radius-small: var(--r-tag);
  --el-box-shadow-light: var(--shadow-panel);
  --el-table-header-bg-color: var(--c-surface-sunken);
  --el-table-header-text-color: var(--c-text-2);
  --el-table-row-hover-bg-color: var(--c-surface-sunken);
  --el-table-border-color: var(--c-border);
}
```

### 9.4 与原型的一致性清单

原型里已经定下来的东西，实现时必须对齐：

| 项 | 规格 | 原型出处 |
|---|---|---|
| 侧栏宽度 | 232px，含品牌区 60px、三组导航、底部用户卡 | `direction-a.html` |
| 顶栏高度 | 60px，左侧全局搜索，右侧通知按钮 | 同上 |
| 内容区 | 最大宽 1240px 居中，内边距 `24px 28px 48px` | 同上 |
| 指标行 | 一张面板 + 竖线分隔，**不是四张并排卡片** | 同上 |
| 活动状态标签 | 报名中（强调色）/ 进行中（绿）/ 已结束（中性） | 同上 |
| 报名进度 | 细进度条 + `46 / 60` 等宽数字 | 同上 |
| 部门构成 | 只用条形长度对比，**不加背景槽**，行间不加分隔线 | 同上 |
| 经费流水 | 四行以内用留白分组，**不加逐行横线** | 同上 |
| 数字 | 全部 `font-variant-numeric: tabular-nums` | `base.css` |
| 头像 | 姓氏首字，两种交替底色，不用通用占位图 | `base.css` |
| 主按钮 | 强调色底 + 白字，高度 36px，标签单行不折行 | `base.css` |
| 页面标题区 | 单一标题 + 一句说明，右上角操作按钮，**不做左标题右小字分栏** | `console.css` |

**同页不允许出现两个同意图的按钮**。例如顶栏已有「新建活动」，页面标题区就不要再来一个。

### 9.5 可访问性基线

这些在原型里已经验算过，实现时保持：

- 正文与控件文字对比度 ≥ 4.5:1，大字号 ≥ 3:1
- 占位符文字对比度过 4.5:1（`--c-text-3` 的实测值是 5.0:1）
- 白色文字压在照片上时，照片必须加压暗层（原型用两层渐变叠加）
- 所有交互元素有清晰的 `:focus-visible` 描边，用 `--c-accent-ring`
- 按钮 `:active` 时 `translateY(1px)` 做触感反馈
- 骨架屏在 `prefers-reduced-motion` 下改为静态色块

---

## 10. 共享层

`packages/shared` 是全栈 TypeScript 的核心收益所在。**枚举与类型只写一份**。

```ts
// packages/shared/src/enums/member.ts
export const MemberStatus = {
  ACTIVE: 1,
  LEFT: 2,
  GRADUATED: 3,
  FROZEN: 4,
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  [MemberStatus.ACTIVE]: '在册',
  [MemberStatus.LEFT]: '退会',
  [MemberStatus.GRADUATED]: '毕业',
  [MemberStatus.FROZEN]: '冻结',
};
```

后端 import 它做校验与赋值，前端 import 它做渲染与中文映射，
**标签文案也只写一份**，避免前后端说法不一致。

需要共享的内容：

| 目录 | 内容 |
|---|---|
| `enums/` | 所有状态枚举 + 中文标签映射（对照 `database-design.md` 第 7 节） |
| `constants/` | 权限码、错误码、配置键、正则（学号、手机号） |
| `dto/` | 请求与响应类型；后端用 DTO 类实现，前端用同名的 interface |

---

## 11. 开发规范

### 11.1 命名

| 对象 | 规则 | 例 |
|---|---|---|
| 数据库表 | snake_case 单数 | `activity_registration` |
| Prisma 模型 | PascalCase 单数 | `ActivityRegistration` |
| 后端文件 | kebab-case | `activity-registration.service.ts` |
| 前端组件 | PascalCase | `MemberTable.vue` |
| 组合式函数 | `use` 前缀 | `useTable` |
| 权限码 | `模块:动作` | `member:create` |
| 接口路径 | 复数、kebab-case | `/api/activity-registrations` |

### 11.2 提交

Conventional Commits，一个提交只做一件事：

```
feat(member): 成员列表支持按部门筛选与批量导入
fix(fund): 修正余额计算未排除已作废流水的问题
docs(db): 补充会费对账链路的说明
refactor(approval): 将超时检查抽为独立任务
```

**改数据库必须单独一个提交**，消息里带 `db:` 前缀，方便出问题时定位与回滚。

### 11.3 分支

个人项目不必上 GitFlow，用两条长期分支即可：

- `main`：始终可运行，只接受从 `dev` 合入的已验证状态
- `dev`：日常开发

功能分支 `feat/xxx` 合进 `dev`，阶段性稳定后合 `main`。
**每完成一个可验证的步骤就提交一次**，不要把多个步骤压成一个提交。

### 11.4 代码审查的自我检查

提交前自己过一遍：

- [ ] 新增接口有没有加 `@RequirePerm`？
- [ ] 查询有没有过数据范围？（尤其导出接口）
- [ ] 返回给前端的对象里有没有带出 `passwordHash` 等敏感字段？
- [ ] 前端 `.vue` 里有没有出现颜色字面值？
- [ ] 涉及多表写入的操作有没有放在事务里？
- [ ] 改 schema 后跑过 `prisma validate` 且迁移文件已入库？

---

## 12. 分阶段实施计划

每阶段结束都要能在浏览器里完整演示，不要出现「全部写完才第一次跑」的情况。

### 阶段 0：地基（预计 2 天）

- npm 工作区 + 两个应用脚手架 + shared 包
- `tokens.css` 与 Element Plus 主题覆盖跑通，随便放个按钮验证配色生效
- Prisma 连接到本机 MySQL，`migrate dev` 建出全部 62 张表
- `seed.ts` 灌入：1 个社团、1 个届次、4 个部门、5 个角色与权限、1 个管理员、
  10 个示例成员、1 个经费账户
- 全局响应体、异常过滤器、Swagger 就位

**验收**：`npm run dev:server` 后访问 `/api/docs` 能看到 Swagger；
`prisma studio` 能看到 62 张表都有数据或结构。

### 阶段 1：登录与权限（预计 2 天）

- 登录 / 刷新 / 登出，双 token
- 前端登录页（照 `design/direction-a.html` 的登录页实现）
- 侧栏布局、路由守卫、`v-perm` 指令、403 / 404 页
- RBAC 五张表的增删改查（角色管理页、权限分配页）
- 数据范围工具函数 + 一个用到它的接口（成员列表）

**验收**：用两个不同角色登录，同一份成员列表看到的数据范围不同；
无权限的菜单与按钮不可见，直接调接口返回 403。

### 阶段 2：成员闭环（预计 3 天）

- 部门树、届次切换
- 成员列表（筛选、搜索、分页）、新增 / 编辑 / 详情、批量导入（Excel）、导出
- 成员档案页（我的活动、积分、缴费记录）

**验收**：Excel 导入 10 个成员成功；导出结果受数据范围限制；
空状态与加载骨架屏与原型一致。

### 阶段 3：活动闭环（预计 4 天）

这是最重要的阶段，**必须把整条链路打通**，而不是只做列表页。

- 活动 CRUD、活动分类
- 审批引擎（四张表）+ 活动立项审批
- 报名（含审核）、签到（动态二维码 + 口令 + 管理员代签）、请假
- 积分发放、志愿时长登记
- 活动相册与总结归档

**验收**：能完整走一遍
`创建草稿 → 提交审批 → 审批通过 → 报名 → 审核 → 现场扫码签到 → 登记支出 → 发积分 → 写总结 → 归档`，
每一步都在数据库里留下记录。

### 阶段 4：经费闭环（预计 3 天）

- 经费账户、科目、流水、凭证上传
- 预算申请与执行率
- 会费标准、应缴名单生成、缴费登记、欠费统计与催缴
- 经费审批（复用阶段 3 的引擎）
- 财务公示页；操作日志与对账接口

**验收**：缴一笔会费能自动派生收入流水，账户余额与手工汇总一致；
作废一笔流水后余额正确变化，且原流水仍在库里可查。

### 阶段 5：完善模块（预计 4 天）

通知（站内信 + 邮件 + 群机器人）、文件共享（目录树、版本、权限）、
值班表（排班、换班、日志、空闲时段收集）、物资与场地预约、
数据统计看板（ECharts）、公告与社团主页。

**验收**：首页指标行的数字全部由真实查询得出，可点进对应模块。

### 阶段 6：亮点（纯可选，不做交付要求）

招新与面试评分、考核与优秀成员评选、投票、多社团隔离演示、移动端适配、
AI 增强（自动写活动总结、自然语言查数据）。

### 阶段 7：取消

项目定位是个人练手，不围绕比赛排期，原「答辩准备」阶段取消。原计划准备的三件事
已经落在实现里，不需要再单独准备：财务不可篡改靠流水加作废（6.4、7.7 节）、
越权靠两层权限（7.5 节）、并发靠唯一索引与行锁（6.5 节）。

**验收**：无额外验收。但种子与演示数据仍要真实到能自证系统可用——
不要 3 个成员 1 场活动，那样看不出系统能不能用。

---

## 13. 测试策略

个人项目不必追求覆盖率数字，但下面这些**必须有用例**，因为它们是并发与安全的
最后一道防线，且手工测不出来：

| 类型 | 覆盖对象 |
|---|---|
| 单元测试 | 数据范围 where 生成、审批节点推进、余额计算、权限码校验 |
| 集成测试 | 活动报名超额、场地预约冲突、重复签到、重复投票（并发各跑 50 次） |
| 接口测试 | 每个接口的 401 / 403 分支（不带 token、带错角色 token） |

工具：`vitest` + `supertest`。并发用例用 `Promise.all` 同时发请求，
断言只有一个成功。

前端不写组件测试，但**每次改完必须手工过一遍空状态、加载态、错误态**，
这三种状态最容易在迭代中被破坏。

---

## 14. 部署

### 14.1 构建

```bash
npm ci                         # 按 package-lock.json 精确安装
npm run db:deploy              # 不要用 migrate dev，它会尝试重置数据
npm run build:shared
npm run build:web              # 产物 apps/web/dist
npm run build:server           # 产物 apps/server/dist
```

### 14.2 运行

单进程：NestJS 静态托管前端产物，只需要开一个端口。

```ts
// main.ts
app.useStaticAssets(join(__dirname, '..', '..', 'web', 'dist'));
```

需要守护进程与开机自启就装 pm2（`npm i -g pm2`）：

```bash
pm2 start apps/server/dist/main.js --name club-api
pm2 save
```

### 14.3 生产环境检查清单

- [ ] `.env` 里 `JWT_SECRET` 已换成随机长串（**不要沿用开发值**）
- [ ] `DATABASE_URL` 不是 root 账号，用最小权限的专用账号
- [ ] `NODE_ENV=production`，Swagger 关闭或加访问限制
- [ ] 上传目录不在 web 根目录下，无法被直接 URL 访问
- [ ] 数据库已配置定时备份（mysqldump + 计划任务）
- [ ] 日志按天轮转，磁盘不会被打满

### 14.4 备份

社团系统的数据量很小，但**财务数据丢了无法重建**。最低要求：
每天 `mysqldump` 一次，保留 30 天，存到与数据库不同的磁盘上。

---

## 15. 风险与待定项

### 15.1 已识别的风险

| 风险 | 影响 | 应对 |
|---|---|---|
| 62 张表铺得太开 | 每块都做一半，没有一块能用 | 严格按阶段推进，阶段 3 结束前不碰阶段 4 以后的表 |
| 深色配色若要回切 | 方向 B 的对比度需逐项重算 | 已锁定方向 A，不为 B 分心 |
| 审批引擎过度设计 | 拖慢阶段 3 | 先支持「顺序节点 + 或签」，会签与超时自动动作放阶段 4 |
| 动态二维码依赖客户端时间 | 时间不同步会导致签到失败 | 二维码内容用服务端时间片，客户端只做展示 |
| 位置围栏签到精度不足 | 室内定位偏差大 | 默认只开二维码，围栏作为可选开关 |
| 一个人开发容易范围蔓延 | 没有外部截止，容易无限打磨 | 阶段 6 全部标记为「可选」；阶段 3 的闭环优先于任何横向扩展 |

### 15.2 已确认（2026-10-15）

原本待确认的四项已经答复，留档备查：

1. **不做比赛**，按个人练手项目推进：阶段 7 取消，阶段 6 纯可选（见第 12 章）。
2. **不做移动端小程序**。阶段 5 的文件与通知模块按只有 Web 端来设计，不必为多端复用让步。
3. **不做多社团演示**。`club_id` 保留在每张业务表上作为架构预留，但种子与演示数据只覆盖一个社团。
4. **登录页继续用占位图**（`design/img/panel-calm.jpg`），活动暂不加封面图。

### 15.3 需要外部提供的东西

三项均已确认，实现时不再等待外部输入：

- **社团信息**：用虚构数据。由实现方编造一套自洽的社团、届次、部门、成员与角色，
  不依赖真实资料；具体内容见第 12 章阶段 0 的种子数据。
- **照片**：暂用原型里的占位图。将来若换真实素材，登录页 1 张竖向、活动封面若干张横向。
- **通知渠道**：只做站内信。不提供邮件 SMTP，也不接企业微信 / 钉钉群机器人，
  `NotifyChannel` 里对应的枚举值保留但不实现。

---

*本文件随开发推进更新。改动数据库设计时同步更新 `docs/database-design.md`，
改动视觉规范时同步更新 `design/README.md`。*
