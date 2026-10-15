/**
 * 软删除扩展（开发文档 6.4 节）。
 *
 * 目的：查询自动带上 `deletedAt = 0`，删除自动改写成 `deletedAt = 当前毫秒`，
 * 这样业务代码里不必（也不应该）手写 deletedAt 条件——三十多个模块靠自觉是守不住的。
 *
 * 为什么 deletedAt 是 BigInt 而不是可空 DateTime：MySQL 唯一索引不比较 NULL，
 * 若可空，`UNIQUE(club_id, user_id, term_id, deleted_at)` 在多次删除后会产生多行 NULL
 * 从而失效，「删掉再加入」就会撞唯一键。
 *
 * 注意：$queryRaw / $executeRaw 不走扩展，手写 SQL 必须自己带 deleted_at 条件。
 */
import { Prisma, type PrismaClient } from '@prisma/client';

/** 有 deletedAt 字段的表。新增模型时如果带软删除，记得加进来。 */
export const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set<string>([
  'Club', 'Term', 'Department', 'User', 'Member', 'Role', 'Permission',
  'SysDict', 'SysDictItem', 'SysConfig',
  'ApprovalFlow', 'ApprovalNode', 'ApprovalInstance', 'ApprovalTask',
  'ActivityCategory', 'Activity', 'ActivityRegistration', 'ActivityCheckin', 'ActivityLeave',
  'FundAccount', 'FundCategory', 'FundTransaction',
  'Announcement', 'Notification', 'NotificationTemplate', 'MessageChannelConfig',
  'FileFolder', 'FileItem', 'FileGrant',
  'Asset', 'AssetBorrow', 'Venue', 'VenueBooking',
  'DutyPlan', 'DutySchedule', 'DutyLog', 'DutySwap', 'MemberAvailability',
  'FundBudget', 'FundVoucher', 'MemberFeeStandard', 'MemberFee',
  'PointRule', 'PointRecord', 'Assessment', 'VolunteerHour',
  'RecruitCampaign', 'RecruitApplication', 'InterviewSlot', 'InterviewAppointment', 'InterviewScore',
  'Vote', 'VoteOption', 'VoteRecord', 'ActivityPhoto', 'Honor', 'ActivityTask',
]);

/** 需要往 where 里注入 deletedAt 条件的读操作 */
const READ_OPERATIONS = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy']);

/** 只有唯一条件、不接受额外 where 字段的读操作，需要改写成 findFirst */
const UNIQUE_READ_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow']);

const DELETE_OPERATIONS = new Set(['delete', 'deleteMany']);

type AnyDelegate = Record<string, (args: unknown) => Promise<unknown>>;

export const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model)) {
            return query(args);
          }

          const delegate = (client as unknown as Record<string, AnyDelegate>)[
            model.charAt(0).toLowerCase() + model.slice(1)
          ];
          if (delegate === undefined) {
            return query(args);
          }

          // 读：注入 deletedAt = 0
          if (READ_OPERATIONS.has(operation)) {
            const typed = args as { where?: Record<string, unknown> };
            typed.where = { ...(typed.where ?? {}), deletedAt: 0n };
            return query(args);
          }

          // findUnique 不允许非唯一字段进 where，改写成 findFirst
          if (UNIQUE_READ_OPERATIONS.has(operation)) {
            const typed = args as {
              where?: Record<string, unknown>;
              select?: unknown;
              include?: unknown;
              omit?: unknown;
            };
            const where = { ...(typed.where ?? {}), deletedAt: 0n };
            const rewritten: Record<string, unknown> = { where };
            if (typed.select !== undefined) rewritten.select = typed.select;
            if (typed.include !== undefined) rewritten.include = typed.include;
            if (typed.omit !== undefined) rewritten.omit = typed.omit;
            const found = await delegate.findFirst?.(rewritten);
            if (operation === 'findUniqueOrThrow' && found === null) {
              throw new Prisma.PrismaClientKnownRequestError('记录不存在或已被删除', {
                code: 'P2025',
                clientVersion: 'soft-delete',
              });
            }
            return found;
          }

          // 删：改写成软删除，绝不物理删除
          if (DELETE_OPERATIONS.has(operation)) {
            const typed = args as { where?: Record<string, unknown>; data?: unknown };
            const now = BigInt(Date.now());
            if (operation === 'delete') {
              return delegate.update?.({ where: typed.where, data: { deletedAt: now } });
            }
            return delegate.updateMany?.({ where: typed.where, data: { deletedAt: now } });
          }

          return query(args);
        },
      },
    },
  }),
);

/**
 * 用工厂函数拿到扩展后的客户端类型。
 * 不要写成 ReturnType<typeof softDeleteExtension>——defineExtension 返回的是
 * 扩展描述对象，不是客户端，那样会丢掉所有模型方法的类型。
 */
export function createExtendedPrismaClient(base: PrismaClient) {
  return base.$extends(softDeleteExtension);
}

export type ExtendedPrismaClient = ReturnType<typeof createExtendedPrismaClient>;

/** 交互式事务回调里拿到的客户端类型 */
export type PrismaTransactionClient = Parameters<
  Parameters<ExtendedPrismaClient['$transaction']>[0]
>[0];
