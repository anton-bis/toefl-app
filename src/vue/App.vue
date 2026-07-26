<script setup>
import {
  defineAsyncComponent,
  inject,
  onBeforeUnmount,
  onErrorCaptured,
  onMounted,
  ref,
  watch
} from 'vue';
import { flushDataStorage, suspendDataStorage } from './platform/storageLifecycle.js';
import { useCatalogStore } from './stores/catalog.js';
import { useUpdatesStore } from './stores/updates.js';

const fatalError = ref('');
const storageReady = inject('storageReady');
const electronEnabled = Boolean(window.electronAPI);
const UpdateNotice = defineAsyncComponent(() => import('./components/UpdateNotice.vue'));
const updates = useUpdatesStore();
const catalog = useCatalogStore();
let disposed = false;
let stopDataFlush;

async function refreshCatalog() {
  if (!updates.contentReady) return;
  try {
    catalog.invalidate();
    await catalog.refreshCatalog();
  } catch (error) {
    fatalError.value = error?.message || 'The question catalog could not be loaded.';
  }
}

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
  <main v-else-if="!storageReady" class="exam-route-state" aria-live="polite">
    <i class="fas fa-spinner fa-spin" /> Loading your practice data…
  </main>
  <main v-else-if="!updates.contentReady" class="exam-route-state" aria-live="polite">
    <template v-if="updates.contentStatus === 'error'">
      <i class="fas fa-circle-exclamation" />
      <p>{{ updates.contentError || 'The question bank could not be downloaded.' }}</p>
      <button type="button" @click="updates.retryContent">Try Again</button>
    </template>
    <template v-else>
      <i class="fas fa-spinner fa-spin" />
      <p>
        {{
          updates.contentStatus === 'downloading'
            ? 'Downloading question bank'
            : 'Checking question bank'
        }}
        <template v-if="updates.contentStatus === 'downloading'">
          {{ updates.contentProgress }}%</template
        >
      </p>
    </template>
  </main>
  <RouterView v-else-if="catalog.catalogLoaded" />
  <main v-else class="exam-route-state" aria-live="polite">
    <i class="fas fa-spinner fa-spin" /> Loading the question catalog…
  </main>
  <UpdateNotice v-if="electronEnabled" />
</template>
