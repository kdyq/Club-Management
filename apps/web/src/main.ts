import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIcons from '@element-plus/icons-vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { setUnauthorizedHandler } from './api/auth-token';
import { permDirective } from './directives/perm';
import router from './router';
import { useUserStore } from './stores/user';

// 顺序要紧：先令牌，再 Element Plus 主题（它读令牌对应的色值），最后全局基础样式
import './styles/tokens.css';
import './styles/element.scss';
import './styles/index.scss';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.directive('perm', permDirective);

// 图标全局注册，模板里直接写 <User /> 而不用逐个 import
for (const [name, component] of Object.entries(ElementPlusIcons)) {
  app.component(name, component);
}

// 续期也失败时（refresh 过期或被拉黑）清掉登录态并回登录页，带上原地址以便登录后跳回
setUnauthorizedHandler(() => {
  const user = useUserStore(pinia);
  const current = router.currentRoute.value;
  user.clear();
  if (current.name !== 'login') {
    void router.replace({ name: 'login', query: { redirect: current.fullPath } });
  }
});

app.mount('#app');
