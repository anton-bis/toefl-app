<script setup>
import { defineAsyncComponent, onBeforeUnmount, onErrorCaptured, onMounted, ref } from 'vue';

const fatalError = ref('');
const electronEnabled = Boolean(window.electronAPI);
const UpdateNotice = defineAsyncComponent(() => import('./components/UpdateNotice.vue'));
let updates;
let disposed = false;

const userDataModule = () => import('./platform/userData.js');

async function handleExport(event) {
  try {
    const { exportUserData } = await userDataModule();
    await window.electronAPI?.writeUserData(
      event.detail.filePath,
      await exportUserData()
    );
    window.alert('用户数据导出成功。');
  } catch (error) {
    window.alert(`导出失败：${error?.message || '未知错误'}`);
  }
}

async function handleImport(event) {
  try {
    const { importUserData } = await userDataModule();
    const payload = await window.electronAPI?.readUserData(event.detail.filePath);
    await importUserData(payload);
    window.alert('用户数据导入成功，应用将重新加载。');
    window.location.reload();
  } catch (error) {
    window.alert(`导入失败：${error?.message || '未知错误'}`);
  }
}

onMounted(async () => {
  if (!electronEnabled) return;
  const { useUpdatesStore } = await import('./stores/updates.js');
  if (disposed) return;
  updates = useUpdatesStore();
  updates.initialize();
  window.addEventListener('electron-export-data', handleExport);
  window.addEventListener('electron-import-data', handleImport);
});
onBeforeUnmount(() => {
  disposed = true;
  updates?.dispose();
  window.removeEventListener('electron-export-data', handleExport);
  window.removeEventListener('electron-import-data', handleImport);
});

onErrorCaptured(error => {
  fatalError.value = error?.message || '应用加载失败';
  return false;
});
</script>

<template>
  <main v-if="fatalError" class="fatal-error" role="alert">
    <i class="fas fa-circle-exclamation"></i>
    <h1>系统错误</h1>
    <p>{{ fatalError }}</p>
    <button type="button" @click="location.reload()">重试</button>
  </main>
  <RouterView v-else />
  <UpdateNotice v-if="electronEnabled" />
</template>
