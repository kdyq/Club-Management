/**
 * 当前用户与权限。
 *
 * Pinia 里只放「跨页面共享」的东西（开发文档 8.2 节）：用户、权限、字典、主题、界面状态。
 * 列表数据、表单数据、筛选条件一律放组件内，不要进 store。
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { DataScope, type ProfileVo } from '@club/shared';
import { authApi, type LoginPayload } from '@/api/auth';
import { accessToken } from '@/api/auth-token';

export const useUserStore = defineStore('user', () => {
  const profile = ref<ProfileVo | null>(null);
  /** 是否已经尝试过恢复登录态。路由守卫靠它决定要不要先等一次 refresh */
  const ready = ref(false);

  const isLoggedIn = computed(() => profile.value !== null);
  const roles = computed(() => profile.value?.roles ?? []);
  const maxDataScope = computed<DataScope>(
    () => (profile.value?.maxDataScope as DataScope | undefined) ?? DataScope.SELF,
  );

  const permissionSet = computed(() => new Set(profile.value?.permissions ?? []));

  /** 传单个码或数组，数组时任一命中即通过（与后端 RequireAnyPerm 一致） */
  function hasPerm(code: string | string[]): boolean {
    const codes = Array.isArray(code) ? code : [code];
    if (codes.length === 0) return true;
    return codes.some((item) => permissionSet.value.has(item));
  }

  function hasAllPerm(codes: string[]): boolean {
    return codes.every((item) => permissionSet.value.has(item));
  }

  const canSeeWholeClub = computed(() => maxDataScope.value >= DataScope.CLUB);
  const canSeeDept = computed(() => maxDataScope.value >= DataScope.DEPT);

  /** 前端的数据范围判断只用于体验优化，真正的拦截在后端 */
  function isSelf(memberId: string | null | undefined): boolean {
    return memberId !== null && memberId !== undefined && profile.value?.memberId === memberId;
  }

  async function login(payload: LoginPayload): Promise<ProfileVo> {
    const vo = await authApi.login(payload);
    accessToken.set(vo.accessToken);
    profile.value = vo.profile;
    ready.value = true;
    return vo.profile;
  }

  /** 刷新页面后恢复登录态：access token 在内存里丢了，用 httpOnly Cookie 换回来 */
  async function restore(): Promise<boolean> {
    try {
      const vo = await authApi.refresh();
      accessToken.set(vo.accessToken);
      profile.value = vo.profile;
      return true;
    } catch {
      accessToken.set(null);
      profile.value = null;
      return false;
    } finally {
      ready.value = true;
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // 登出必须是无副作用的，服务端失败也要清掉本地状态
    }
    clear();
  }

  function clear(): void {
    accessToken.set(null);
    profile.value = null;
  }

  return {
    profile,
    ready,
    isLoggedIn,
    roles,
    maxDataScope,
    canSeeWholeClub,
    canSeeDept,
    hasPerm,
    hasAllPerm,
    isSelf,
    login,
    restore,
    logout,
    clear,
  };
});
