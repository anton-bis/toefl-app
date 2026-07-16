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
    await window.electronAPI?.writeUserData(event.detail.filePath, await exportUserData());
    window.alert('Your data has been exported.');
  } catch (error) {
    window.alert(`Export failed: ${error?.message || 'Unknown error'}`);
  }
}

async function handleImport(event) {
  try {
    const { importUserData } = await userDataModule();
    const payload = await window.electronAPI?.readUserData(event.detail.filePath);
    await importUserData(payload);
    window.alert('Your data has been imported. The app will now restart.');
    window.location.reload();
  } catch (error) {
    window.alert(`Import failed: ${error?.message || 'Unknown error'}`);
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
  fatalError.value = error?.message || 'The app could not start.';
  return false;
});
</script>

<template>
  <main v-if="fatalError" class="fatal-error" role="alert">
    <i class="fas fa-circle-exclamation"></i>
    <h1>Something Went Wrong</h1>
    <p>{{ fatalError }}</p>
    <button type="button" @click="location.reload()">Try Again</button>
  </main>
  <RouterView v-else />
  <UpdateNotice v-if="electronEnabled" />
</template>
