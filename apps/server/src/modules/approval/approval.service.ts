/**
 * 审批引擎（开发文档 7.6 节）。
 *
 * 业务模块只需两步：approvalService.submit(...) 提交，然后把业务状态推进到「待审批」
 * 并记下 instanceId。审批通过或驳回后由这里**回调**业务模块的 ApprovableHandler。
 *
 * 节点支持或签 / 会签；超时动作（提醒、自动通过、自动驳回、转交）由定时任务驱动，
 * 本次实现顺序节点 + 或签 / 会签 + 驳回即终止，超时后续接入。
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  ApprovalInstanceStatus,
  ApprovalNodeMode,
  ApprovalTaskStatus,
  BizType,
  ErrorCode,
  type ApprovalInstanceVo,
  type ApprovalTaskVo,
  type PageResult,
  normalizePage,
  skipOf,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { APPROVE_MODE, APPROVER_TYPE, type SubmitApprovalInput } from './approval.constants.js';
import { ApprovalHandlerRegistry } from './approval-handler.registry.js';
import type { ApprovableInstance } from './types/approvable-handler.js';

interface FlowNode {
  id: bigint;
  seq: number;
  approverType: number;
  approverValue: string | null;
  approveMode: number;
  allowEmptySkip: boolean;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ApprovalHandlerRegistry,
  ) {}

  // ---------------------------------------------------------------------------
  // 提交
  // ---------------------------------------------------------------------------

  async submit(input: SubmitApprovalInput): Promise<{ id: bigint; status: number }> {
    const flow = await this.prisma.client.approvalFlow.findFirst({
      where: { clubId: input.clubId, bizType: input.bizType, status: 1 },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    if (flow === null) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        `没有为「${input.bizType}」配置可用的审批流程，请先在系统里配置`,
      );
    }

    const nodes = await this.nodesOf(flow.id);
    if (nodes.length === 0) {
      throw new BizException(ErrorCode.BUSINESS_RULE_VIOLATED, '该审批流程没有配置任何节点');
    }

    // 同一业务对象不允许有第二个在途实例
    const pending = await this.prisma.client.approvalInstance.findFirst({
      where: {
        bizType: input.bizType,
        bizId: input.bizId,
        status: ApprovalInstanceStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending !== null) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该对象已有在途审批，请勿重复提交');
    }

    const instance = await this.prisma.transaction(async (tx) => {
      const created = await tx.approvalInstance.create({
        data: {
          clubId: input.clubId,
          flowId: flow.id,
          bizType: input.bizType,
          bizId: input.bizId,
          applicantMemberId: input.applicantMemberId,
          currentSeq: nodes[0]?.seq ?? 1,
          status: ApprovalInstanceStatus.PENDING,
          // 标题与业务无关，存实例上即可，待办列表与详情都不必回查各业务表
          title: input.title,
          formDataJson: (input.formData ?? {}) as never,
        },
      });

      await this.createTasksForNode(
        tx,
        created.id,
        input.clubId,
        nodes[0] as FlowNode,
        input.applicantMemberId,
      );
      return created;
    });

    this.logger.log(
      `提交审批 ${input.bizType}#${input.bizId.toString()} → 实例 ${instance.id.toString()}`,
    );
    return { id: instance.id, status: instance.status };
  }

  // ---------------------------------------------------------------------------
  // 审批动作
  // ---------------------------------------------------------------------------

  async approve(
    me: MemberContext,
    taskId: bigint,
    opinion?: string,
    attachmentFileId?: bigint,
  ): Promise<{ finished: boolean; status: number }> {
    const task = await this.loadPendingTask(me, taskId);

    const result = await this.prisma.transaction(async (tx) => {
      await tx.approvalTask.update({
        where: { id: taskId },
        data: {
          status: ApprovalTaskStatus.AGREED,
          opinion: opinion ?? null,
          attachmentFileId: attachmentFileId ?? null,
          handledAt: new Date(),
        },
      });
      return this.advanceOrFinish(tx, task.instanceId, task.nodeId, task.nodeSeq, opinion ?? '同意');
    });

    if (result.finished) {
      await this.notifyHandler(task.instanceId, result.status, opinion ?? '同意');
    }
    return { finished: result.finished, status: result.status };
  }

  async reject(
    me: MemberContext,
    taskId: bigint,
    opinion: string,
  ): Promise<{ finished: boolean; status: number }> {
    if (opinion.trim() === '') {
      throw new BizException(ErrorCode.PARAM_INVALID, '驳回必须填写审批意见');
    }
    const task = await this.loadPendingTask(me, taskId);

    await this.prisma.transaction(async (tx) => {
      await tx.approvalTask.update({
        where: { id: taskId },
        data: {
          status: ApprovalTaskStatus.REFUSED,
          opinion,
          handledAt: new Date(),
        },
      });
      // 任一节点驳回即整单终止
      await tx.approvalInstance.update({
        where: { id: task.instanceId },
        data: {
          status: ApprovalInstanceStatus.REJECTED,
          finishAt: new Date(),
        },
      });
      // 其余待办一并作废，避免待办列表里留着一堆点不动的任务
      await tx.approvalTask.updateMany({
        where: { instanceId: task.instanceId, status: ApprovalTaskStatus.PENDING },
        data: { status: ApprovalTaskStatus.TIMEOUT, handledAt: new Date() },
      });
    });

    await this.notifyHandler(task.instanceId, ApprovalInstanceStatus.REJECTED, opinion);
    return { finished: true, status: ApprovalInstanceStatus.REJECTED };
  }

  /** 撤销：只有申请人本人可以撤销在途的申请 */
  async revoke(me: MemberContext, instanceId: bigint): Promise<void> {
    const instance = await this.prisma.client.approvalInstance.findFirst({
      where: { id: instanceId, clubId: me.clubId },
      select: { id: true, applicantMemberId: true, status: true },
    });
    if (instance === null) throw new BizException(ErrorCode.NOT_FOUND, '审批实例不存在');
    if (instance.applicantMemberId !== me.memberId) {
      throw new BizException(ErrorCode.FORBIDDEN, '只能撤销自己提交的申请');
    }
    if (instance.status !== ApprovalInstanceStatus.PENDING) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该申请已经结束，无法撤销');
    }

    await this.prisma.transaction(async (tx) => {
      await tx.approvalInstance.update({
        where: { id: instanceId },
        data: { status: ApprovalInstanceStatus.REVOKED, finishAt: new Date() },
      });
      await tx.approvalTask.updateMany({
        where: { instanceId, status: ApprovalTaskStatus.PENDING },
        data: { status: ApprovalTaskStatus.TIMEOUT, handledAt: new Date() },
      });
    });

    await this.notifyHandler(instanceId, ApprovalInstanceStatus.REVOKED, '申请人撤销');
  }

  // ---------------------------------------------------------------------------
  // 查询
  // ---------------------------------------------------------------------------

  /** 我的待办 */
  async myTasks(
    me: MemberContext,
    query: { page?: number; pageSize?: number; status?: number },
  ): Promise<PageResult<ApprovalTaskVo>> {
    const { page, pageSize } = normalizePage(query);
    const where = {
      approverMemberId: me.memberId,
      ...(query.status === undefined ? { status: ApprovalTaskStatus.PENDING } : { status: query.status }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.client.approvalTask.count({ where }),
      this.prisma.client.approvalTask.findMany({
        where,
        orderBy: [{ status: 'asc' }, { id: 'desc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          approver: { select: { id: true, user: { select: { realName: true } } } },
          instance: {
            select: {
              title: true,
              bizType: true,
              applicant: { select: { id: true, user: { select: { realName: true } } } },
            },
          },
        },
      }),
    ]);

    return { list: rows.map((row) => toTaskVo(row, row.instance)), total, page, pageSize };
  }

  /** 我提交的申请 */
  async myApplications(
    me: MemberContext,
    query: { page?: number; pageSize?: number; status?: number },
  ): Promise<PageResult<ApprovalInstanceVo>> {
    const { page, pageSize } = normalizePage(query);
    const where = {
      clubId: me.clubId,
      applicantMemberId: me.memberId,
      ...(query.status === undefined ? {} : { status: query.status }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.client.approvalInstance.count({ where }),
      this.prisma.client.approvalInstance.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          applicant: { select: { id: true, user: { select: { realName: true } } } },
          flow: { select: { name: true } },
        },
      }),
    ]);

    const instanceIds = rows.map((row) => row.id);
    const tasks =
      instanceIds.length === 0
        ? []
        : await this.prisma.client.approvalTask.findMany({
            where: { instanceId: { in: instanceIds } },
            include: {
              approver: { select: { id: true, user: { select: { realName: true } } } },
            },
            orderBy: [{ seq: 'asc' }, { id: 'asc' }],
          });

    return {
      list: rows.map((row) =>
        toInstanceVo(
          row as InstanceRow,
          tasks
            .filter((task) => task.instanceId === row.id)
            .map((task) => toTaskVo(task, { title: row.title, bizType: row.bizType })),
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  async detail(me: MemberContext, instanceId: bigint): Promise<ApprovalInstanceVo> {
    const row = await this.prisma.client.approvalInstance.findFirst({
      where: { id: instanceId, clubId: me.clubId },
      include: {
        applicant: { select: { id: true, user: { select: { realName: true } } } },
        flow: { select: { name: true } },
      },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '审批实例不存在');

    const tasks = await this.prisma.client.approvalTask.findMany({
      where: { instanceId },
      include: {
        approver: { select: { id: true, user: { select: { realName: true } } } },
      },
      orderBy: [{ seq: 'asc' }, { id: 'asc' }],
    });

    return toInstanceVo(
      row as InstanceRow,
      tasks.map((task) => toTaskVo(task, { title: row.title, bizType: row.bizType })),
    );
  }

  // ---------------------------------------------------------------------------
  // 引擎内部
  // ---------------------------------------------------------------------------

  private async nodesOf(flowId: bigint): Promise<FlowNode[]> {
    const rows = await this.prisma.client.approvalNode.findMany({
      where: { flowId },
      orderBy: { seq: 'asc' },
      select: {
        id: true,
        seq: true,
        approverType: true,
        approverValue: true,
        approveMode: true,
        allowEmptySkip: true,
      },
    });
    return rows as FlowNode[];
  }

  /** 解析节点审批人。解析不到人时：允许跳过就跳过，否则报错并说清是哪个节点。 */
  private async resolveApprovers(
    clubId: bigint,
    node: FlowNode,
    applicantMemberId: bigint,
  ): Promise<bigint[]> {
    switch (node.approverType) {
      case APPROVER_TYPE.MEMBER: {
        if (node.approverValue === null) return [];
        return [BigInt(node.approverValue)];
      }
      case APPROVER_TYPE.ROLE: {
        if (node.approverValue === null) return [];
        const rows = await this.prisma.client.memberRole.findMany({
          where: {
            roleId: BigInt(node.approverValue),
            member: { deletedAt: 0n, status: 1 },
          },
          select: { memberId: true },
        });
        return rows.map((row) => row.memberId);
      }
      case APPROVER_TYPE.DEPT_LEADER: {
        const applicant = await this.prisma.client.member.findFirst({
          where: { id: applicantMemberId },
          select: { deptId: true },
        });
        if (applicant?.deptId === null || applicant?.deptId === undefined) return [];
        const dept = await this.prisma.client.department.findFirst({
          where: { id: applicant.deptId },
          select: { leaderMemberId: true },
        });
        return dept?.leaderMemberId === null || dept?.leaderMemberId === undefined
          ? []
          : [dept.leaderMemberId];
      }
      case APPROVER_TYPE.SUPERIOR: {
        // 本项目里「上级」取社长：职务序号最小且在册的核心成员
        const rows = await this.prisma.client.member.findMany({
          where: { clubId, status: 1, deletedAt: 0n },
          orderBy: { position: 'asc' },
          take: 1,
          select: { id: true },
        });
        return rows.map((row) => row.id);
      }
      default:
        return [];
    }
  }

  private async createTasksForNode(
    tx: Parameters<Parameters<PrismaService['transaction']>[0]>[0],
    instanceId: bigint,
    clubId: bigint,
    node: FlowNode,
    applicantMemberId: bigint,
  ): Promise<void> {
    const approvers = await this.resolveApprovers(clubId, node, applicantMemberId);
    if (approvers.length === 0) {
      if (node.allowEmptySkip) return;
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        `审批节点（第 ${node.seq} 步）没有解析到审批人，请联系管理员检查流程配置`,
      );
    }

    await tx.approvalTask.createMany({
      data: approvers.map((approverMemberId) => ({
        instanceId,
        nodeId: node.id,
        seq: node.seq,
        approverMemberId,
        status: ApprovalTaskStatus.PENDING,
      })),
    });
  }

  /**
   * 某个节点处理完一条任务后，判断该节点是否完成、是否需要推进到下一节点或整单通过。
   * 或签：一条同意即可；会签：本节点所有任务都同意才算完成。
   */
  private async advanceOrFinish(
    tx: Parameters<Parameters<PrismaService['transaction']>[0]>[0],
    instanceId: bigint,
    nodeId: bigint,
    nodeSeq: number,
    opinion: string,
  ): Promise<{ finished: boolean; status: number }> {
    const instance = await tx.approvalInstance.findFirstOrThrow({
      where: { id: instanceId },
      select: {
        id: true,
        clubId: true,
        flowId: true,
        currentSeq: true,
        applicantMemberId: true,
        status: true,
      },
    });
    if (instance.status !== ApprovalInstanceStatus.PENDING) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该审批已经结束');
    }

    const node = await tx.approvalNode.findFirstOrThrow({
      where: { id: nodeId },
      select: { approveMode: true, seq: true },
    });

    if (node.approveMode === APPROVE_MODE.ALL) {
      const remaining = await tx.approvalTask.count({
        where: { instanceId, nodeId, status: ApprovalTaskStatus.PENDING },
      });
      if (remaining > 0) {
        // 会签还没凑齐，停留在本节点
        return { finished: false, status: ApprovalInstanceStatus.PENDING };
      }
    }

    const nodes = await tx.approvalNode.findMany({
      where: { flowId: instance.flowId, seq: { gt: nodeSeq } },
      orderBy: { seq: 'asc' },
    });

    const next = nodes[0];
    if (next === undefined) {
      await tx.approvalInstance.update({
        where: { id: instanceId },
        data: { status: ApprovalInstanceStatus.APPROVED, finishAt: new Date() },
      });
      // 走完流程后把本节点里未被处理的并列任务（或签的其余人）标记为超时，
      // 否则它们会一直挂在别人的待办里
      await tx.approvalTask.updateMany({
        where: { instanceId, nodeId, status: ApprovalTaskStatus.PENDING },
        data: { status: ApprovalTaskStatus.TIMEOUT, handledAt: new Date() },
      });
      return { finished: true, status: ApprovalInstanceStatus.APPROVED };
    }

    await tx.approvalTask.updateMany({
      where: { instanceId, nodeId, status: ApprovalTaskStatus.PENDING },
      data: { status: ApprovalTaskStatus.TIMEOUT, handledAt: new Date() },
    });
    await tx.approvalInstance.update({
      where: { id: instanceId },
      data: { currentSeq: next.seq },
    });
    await this.createTasksForNode(
      tx,
      instanceId,
      instance.clubId,
      next as FlowNode,
      instance.applicantMemberId,
    );

    void opinion;
    return { finished: false, status: ApprovalInstanceStatus.PENDING };
  }

  private async loadPendingTask(
    me: MemberContext,
    taskId: bigint,
  ): Promise<{ instanceId: bigint; nodeId: bigint; nodeSeq: number }> {
    const task = await this.prisma.client.approvalTask.findFirst({
      where: { id: taskId, approverMemberId: me.memberId },
      include: { node: { select: { seq: true } } },
    });
    if (task === null) {
      throw new BizException(ErrorCode.NOT_FOUND, '待办不存在，或它不是分配给你的');
    }
    if (task.status !== ApprovalTaskStatus.PENDING) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该待办已经处理过了');
    }
    return { instanceId: task.instanceId, nodeId: task.nodeId, nodeSeq: task.node.seq };
  }

  /** 审批结束（通过 / 驳回 / 撤销）后回调业务模块 */
  private async notifyHandler(
    instanceId: bigint,
    status: number,
    opinion: string,
  ): Promise<void> {
    const instance = await this.prisma.client.approvalInstance.findFirst({
      where: { id: instanceId },
    });
    if (instance === null) return;

    const handler = this.registry.get(instance.bizType);
    if (handler === undefined) {
      this.logger.warn(
        `审批 ${instance.bizType}#${instance.bizId.toString()} 已结束，但没有对应的业务处理器，业务状态不会推进`,
      );
      return;
    }

    const payload: ApprovableInstance = {
      id: instance.id,
      clubId: instance.clubId,
      bizType: instance.bizType,
      bizId: instance.bizId,
      applicantMemberId: instance.applicantMemberId,
      formDataJson: instance.formDataJson,
    };

    try {
      if (status === ApprovalInstanceStatus.APPROVED) {
        await handler.onApproved(payload);
      } else if (status === ApprovalInstanceStatus.REJECTED) {
        await handler.onRejected(payload, opinion);
      }
    } catch (error) {
      // 回调失败不能把审批结果回滚掉——审批已经生效，业务侧问题另行修复
      this.logger.error(
        `回调业务处理器失败（${instance.bizType}#${instance.bizId.toString()}）：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

// -----------------------------------------------------------------------------
// 映射
// -----------------------------------------------------------------------------

interface InstanceRow {
  id: bigint;
  bizType: string;
  bizId: bigint;
  title: string;
  status: number;
  currentSeq: number;
  submitAt: Date;
  finishAt: Date | null;
  formDataJson: unknown;
  applicant: { id: bigint; user: { realName: string } };
  flow: { name: string };
}

interface TaskRow {
  id: bigint;
  instanceId: bigint;
  seq: number;
  status: number;
  opinion: string | null;
  handledAt: Date | null;
  createdAt: Date;
  approver: { id: bigint; user: { realName: string } };
}

type TaskVoWithTitle = ApprovalTaskVo & { title: string; bizType: string };

function toTaskVo(row: TaskRow, instance: { title: string; bizType: string }): TaskVoWithTitle {
  return {
    instanceId: row.instanceId.toString(),
    id: row.id.toString(),
    seq: row.seq,
    approverMemberId: row.approver.id.toString(),
    approverName: row.approver.user.realName,
    status: row.status,
    opinion: row.opinion,
    handledAt: row.handledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    title: instance.title,
    bizType: instance.bizType,
  };
}

function toInstanceVo(row: InstanceRow, tasks: TaskVoWithTitle[]): ApprovalInstanceVo & { title: string } {
  return {
    id: row.id.toString(),
    title: row.title,
    bizType: row.bizType,
    bizId: row.bizId.toString(),
    flowName: row.flow.name,
    applicantMemberId: row.applicant.id.toString(),
    applicantName: row.applicant.user.realName,
    status: row.status,
    currentSeq: row.currentSeq,
    submitAt: row.submitAt.toISOString(),
    finishAt: row.finishAt?.toISOString() ?? null,
    formData: (row.formDataJson ?? null) as Record<string, unknown> | null,
    tasks,
  };
}

// 保持在模块顶部的业务类型引用，避免未使用告警
export type { BizType, ApprovalNodeMode };
