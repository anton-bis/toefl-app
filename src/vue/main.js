import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import { initializeDataStorage } from './platform/storageLifecycle.js';
import './styles/roboto.css';
import './styles/base.css';
import './styles/icons.css';

try {
  await initializeDataStorage();
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#vue-app');
} catch (error) {
  const root = document.querySelector('#vue-app');
  if (root) {
    const message = document.createElement('main');
    message.className = 'fatal-error';
    message.setAttribute('role', 'alert');
    const title = document.createElement('h1');
    title.textContent = '用户数据初始化失败';
    const detail = document.createElement('p');
    detail.textContent = error?.message || '当前环境无法使用本地数据存储';
    message.append(title, detail);
    root.replaceChildren(message);
  }
}
