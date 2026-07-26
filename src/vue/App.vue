<script setup>
import {
  computed,
  defineAsyncComponent,
  inject,
  onBeforeUnmount,
  onErrorCaptured,
  onMounted,
  ref,
  watch
} from 'vue';
import ContentStartup from './components/ContentStartup.vue';
import { flushDataStorage, suspendDataStorage } from './platform/storageLifecycle.js';
import { useCatalogStore } from './stores/catalog.js';
import { useUpdatesStore } from './stores/updates.js';

const fatalError = ref('');
const storageReady = inject('storageReady');
const electronEnabled = Boolean(window.electronAPI);
const UpdateNotice = defineAsyncComponent(() => import('./components/UpdateNotice.vue'));
const updates = useUpdatesStore();
const catalog = useCatalogStore();
const catalogError = ref('');
const catalogLoading = ref(false);
let disposed = false;
let stopDataFlush;
let catalogRefreshPromise;

async function refreshCatalog() {
  if (!updates.contentReady) return false;
  if (catalogRefreshPromise) return catalogRefreshPromise;
  catalogError.value = '';
  catalogLoading.value = true;
  catalogRefreshPromise = (async () => {
    try {
      catalog.invalidate();
      await catalog.refreshCatalog();
      return true;
    } catch (error) {
      catalogError.value = error?.message || 'The question catalog could not be loaded.';
      return false;
    } finally {
      catalogLoading.value = false;
      catalogRefreshPromise = undefined;
    }
  })();
  return catalogRefreshPromise;
}

async function retryStartup() {
  catalogError.value = '';
  if (!storageReady.value) return;
  if (!updates.contentReady || updates.contentStatus === 'error') await updates.retryContent();
  if (updates.contentReady) await refreshCatalog();
}

const startupStatus = computed(() => {
  if (!storageReady.value) return 'storage';
  if (catalogError.value) return 'error';
  if (!updates.contentReady) {
    if (updates.contentStatus === 'error') return 'error';
    if (updates.contentStatus === 'downloading') {
      return updates.contentProgress >= 100 ? 'preparing' : 'downloading';
    }
    return 'checking';
  }
  if (!catalog.catalogLoaded || catalogLoading.value) return 'catalog';
  return 'ready';
});
const startupError = computed(() => catalogError.value || updates.contentError);

async function handleDataFlush(request) {
  const id = typeof request === 'object' ? request.id : request;
  try {
    await flushDataStorage();
    if (request?.suspend) suspendDataStorage();
    window.electronAPI?.data.flushed({ id, ok: true });
  } catch (error) {
    window.electronAPI?.data.flushed({
      id,
      ok: false,
      error: error?.message || 'Could not save the latest changes.'
    });
  }
}

onMounted(async () => {
  if (electronEnabled) {
    stopDataFlush = window.electronAPI.data.onFlush(handleDataFlush);
    await updates.initialize();
  }
  if (!disposed && updates.contentReady) await refreshCatalog();
});
watch(() => updates.contentActivation, refreshCatalog);
onBeforeUnmount(() => {
  disposed = true;
  updates.dispose();
  stopDataFlush?.();
});

onErrorCaptured(error => {
  fatalError.value = error?.message || 'The app could not start.';
  return false;
});
</script>

<template>
  <main v-if="fatalError" class="fatal-error" role="alert">
    <i class="fas fa-circle-exclamation" />
    <h1>Something Went Wrong</h1>
    <p>{{ fatalError }}</p>
    <button type="button" @click="location.reload()">Try Again</button>
  </main>
  <ContentStartup
    v-else-if="startupStatus !== 'ready'"
    :status="startupStatus"
    :progress="updates.contentProgress"
    :error="startupError"
    @retry="retryStartup"
  />
  <RouterView v-else />
  <UpdateNotice v-if="electronEnabled" />
</template>
