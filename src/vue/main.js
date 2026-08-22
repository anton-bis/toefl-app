import { createApp, ref } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import { initializeDataStorage } from './platform/storageLifecycle.js';
import './styles/roboto.css';
import './styles/base.css';
import './styles/icons.css';
import './styles/skills.css';

const pinia = createPinia();
const app = createApp(App);
const storageReady = ref(false);
app.use(pinia);
app.use(router);
app.provide('storageReady', storageReady);
app.mount('#vue-app');

try {
  window.electronAPI?.data?.ready?.();
  await initializeDataStorage();
  storageReady.value = true;
} catch (error) {
  app.unmount();
  const root = document.querySelector('#vue-app');
  if (root) {
    const message = document.createElement('main');
    message.className = 'fatal-error';
    message.setAttribute('role', 'alert');
    const title = document.createElement('h1');
    title.textContent = 'Unable to Initialize User Data';
    const detail = document.createElement('p');
    detail.textContent = error?.message || 'Local data storage is unavailable in this environment.';
    message.append(title, detail);
    root.replaceChildren(message);
  }
}
