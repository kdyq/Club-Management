/**
 * 权限判断组合式函数（开发文档 8.4 节）。
 * 只做体验优化，真正的拦截在后端——这一点不因前端写得再细而改变。
 */
import { computed } from 'vue';
import { useUserStore } from '@/stores/user';

export function usePermission() {
  const user = useUserStore();

  return {
    hasPerm: user.hasPerm,
    hasAllPerm: user.hasAllPerm,
    /** 当前用户的角色编码 */
    roleCodes: computed(() => user.roles.map((role) => role.code)),
    maxDataScope: computed(() => user.maxDataScope),
    canSeeWholeClub: computed(() => user.canSeeWholeClub),
    canSeeDept: computed(() => user.canSeeDept),
    isSelf: user.isSelf,
  };
}
