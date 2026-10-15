/** 成员行 → 对外 VO。集中一处，避免各 Service 各写一份导致字段遗漏或敏感字段外泄。 */
import {
  MemberPosition,
  MEMBER_POSITION_LABEL,
  MemberStatus,
  MEMBER_STATUS_LABEL,
  type MemberVo,
} from '@club/shared';

export interface MemberRow {
  id: bigint;
  memberNo: string | null;
  position: number;
  status: number;
  isCore: boolean;
  totalPoints: number;
  joinDate: Date | null;
  deptId: bigint | null;
  dept: { id: bigint; name: string } | null;
  user: {
    realName: string;
    studentNo: string | null;
    gender: number;
    grade: string | null;
    major: string | null;
    className: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  roles: { role: { id: bigint; code: string; name: string } }[];
}

/** 对外不返回 passwordHash 等敏感字段（提交前自检清单第 3 条） */
export function toMemberVo(row: MemberRow): MemberVo {
  return {
    id: row.id.toString(),
    memberNo: row.memberNo,
    realName: row.user.realName,
    studentNo: row.user.studentNo,
    gender: row.user.gender,
    grade: row.user.grade,
    major: row.user.major,
    className: row.user.className,
    phone: row.user.phone,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl,
    deptId: row.deptId?.toString() ?? null,
    deptName: row.dept?.name ?? null,
    position: row.position,
    positionLabel: MEMBER_POSITION_LABEL[row.position as MemberPosition] ?? String(row.position),
    status: row.status,
    statusLabel: MEMBER_STATUS_LABEL[row.status as MemberStatus] ?? String(row.status),
    isCore: row.isCore,
    totalPoints: row.totalPoints,
    joinDate: row.joinDate?.toISOString().slice(0, 10) ?? null,
    roles: row.roles.map(({ role }) => ({
      id: role.id.toString(),
      code: role.code,
      name: role.name,
    })),
  };
}
