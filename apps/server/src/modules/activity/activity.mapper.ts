/** 活动行 → 对外 VO。 */
import {
  ActivityStatus,
  ACTIVITY_STATUS_LABEL,
  type ActivityCategoryVo,
  type ActivityVo,
} from '@club/shared';

export interface ActivityRow {
  id: bigint;
  title: string;
  summary: string | null;
  content: string | null;
  location: string | null;
  coverUrl: string | null;
  categoryId: bigint | null;
  termId: bigint | null;
  startTime: Date;
  endTime: Date;
  signupStart: Date | null;
  signupEnd: Date | null;
  capacity: number;
  minMembers: number;
  needAudit: boolean;
  organizerMemberId: bigint | null;
  contactInfo: string | null;
  checkinType: number;
  checkinStart: Date | null;
  checkinEnd: Date | null;
  points: number;
  volunteerHours: { toString(): string };
  budgetAmount: { toString(): string };
  actualAmount: { toString(): string };
  status: number;
  approvalInstanceId: bigint | null;
  summaryReport: string | null;
  createdAt: Date;
  category: { id: bigint; name: string } | null;
  organizer: { id: bigint; user: { realName: string } } | null;
}

export interface ActivityCounts {
  approvedCount: number;
  pendingCount: number;
  checkedInCount: number;
}

export function toActivityVo(row: ActivityRow, counts: ActivityCounts): ActivityVo {
  return {
    id: row.id.toString(),
    title: row.title,
    summary: row.summary,
    content: row.content,
    location: row.location,
    coverUrl: row.coverUrl,
    categoryId: row.categoryId?.toString() ?? null,
    categoryName: row.category?.name ?? null,
    termId: row.termId?.toString() ?? null,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    signupStart: row.signupStart?.toISOString() ?? null,
    signupEnd: row.signupEnd?.toISOString() ?? null,
    capacity: row.capacity,
    minMembers: row.minMembers,
    needAudit: row.needAudit,
    organizerMemberId: row.organizerMemberId?.toString() ?? null,
    organizerName: row.organizer?.user.realName ?? null,
    contactInfo: row.contactInfo,
    checkinType: row.checkinType,
    checkinStart: row.checkinStart?.toISOString() ?? null,
    checkinEnd: row.checkinEnd?.toISOString() ?? null,
    points: row.points,
    volunteerHours: row.volunteerHours.toString(),
    budgetAmount: row.budgetAmount.toString(),
    actualAmount: row.actualAmount.toString(),
    status: row.status,
    statusLabel: ACTIVITY_STATUS_LABEL[row.status as ActivityStatus] ?? String(row.status),
    approvalInstanceId: row.approvalInstanceId?.toString() ?? null,
    summaryReport: row.summaryReport,
    approvedCount: counts.approvedCount,
    pendingCount: counts.pendingCount,
    checkedInCount: counts.checkedInCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toActivityCategoryVo(row: {
  id: bigint;
  name: string;
  color: string | null;
  sort: number;
  status: number;
  _count: { activities: number };
}): ActivityCategoryVo {
  return {
    id: row.id.toString(),
    name: row.name,
    color: row.color,
    sort: row.sort,
    status: row.status,
    activityCount: row._count.activities,
  };
}
