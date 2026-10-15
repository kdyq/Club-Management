/** 界面状态：侧栏折叠、页面标题。不放业务数据。 */
import { ref } from 'vue';
import { defineStore } from 'pinia';

const COLLAPSE_KEY = 'club:sidebar-collapsed';

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1');

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem(COLLAPSE_KEY, sidebarCollapsed.value ? '1' : '0');
  }

  return { sidebarCollapsed, toggleSidebar };
});
