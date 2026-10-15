import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import { createPinia } from 'pinia';
import App from './App.vue';

createApp(App).use(createPinia()).use(ElementPlus, { locale: zhCn }).mount('#app');
