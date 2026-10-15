/**
 * v-perm 指令：无权限时把元素从 DOM 里摘掉。
 *
 *   <el-button v-perm="'member:create'">新增成员</el-button>
 *   <el-button v-perm="['member:update', 'member:delete']">编辑</el-button>
 *
 * 传数组时任一命中即显示，与后端 RequireAnyPerm 的语义保持一致。
 * 再强调一次：这只是体验优化，接口该拦的仍然在后端拦。
 */
import type { Directive } from 'vue';
import { useUserStore } from '@/stores/user';

export const permDirective: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    const user = useUserStore();
    const value = binding.value;
    if (value === undefined || value === null) return;

    const codes = Array.isArray(value) ? value : [value];
    if (codes.length === 0) return;

    if (!user.hasPerm(codes)) {
      el.parentNode?.removeChild(el);
    }
  },
};
