import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { createPinia } from 'pinia';
import App from './App.vue';

// 顺序要紧：先令牌，再 Element Plus 主题（它读令牌对应的色值），最后全局基础样式
import './styles/tokens.css';
import './styles/element.scss';
import './styles/index.scss';

createApp(App).use(createPinia()).use(ElementPlus, { locale: zhCn }).mount('#app');
