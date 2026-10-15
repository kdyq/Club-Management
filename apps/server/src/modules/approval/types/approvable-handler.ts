/**
 * 业务模块接入审批引擎的唯一契约（开发文档 7.6 节）。
 *
 * 业务模块实现它，审批引擎用 DiscoveryService 自动收集并按 bizType 注册。
 * **不要在业务模块里轮询审批状态**——那是反向依赖。审批通过后由引擎回调这里。
 */
export interface ApprovableInstance {
  id: bigint;
  clubId: bigint;
  bizType: string;
  bizId: bigint;
  applicantMemberId: bigint;
  formDataJson: unknown;
}

export interface ApprovableHandler {
  /** 与 ApprovalFlow.bizType 一致，如 'activity' */
  readonly bizType: string;
  onApproved(instance: ApprovableInstance): Promise<void>;
  onRejected(instance: ApprovableInstance, opinion: string): Promise<void>;
}

/** 运行期判定一个 provider 是不是业务处理器 */
export function isApprovableHandler(value: unknown): value is ApprovableHandler {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<ApprovableHandler>;
  return (
    typeof candidate.bizType === 'string' &&
    candidate.bizType !== '' &&
    typeof candidate.onApproved === 'function' &&
    typeof candidate.onRejected === 'function'
  );
}
