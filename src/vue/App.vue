<script setup>
import {
  defineAsyncComponent,
  inject,
  onBeforeUnmount,
  onErrorCaptured,
  onMounted,
  ref
} from 'vue';
import { flushDataWrites, suspendDataWrites } from './platform/dataRepository.js';
import { flushLocalWrites, suspendLocalWrites } from './platform/localPersistence.js';

const fatalError = ref('');
const storageReady = inject('storageReady');
const electronEnabled = Boolean(window.electronAPI);
const UpdateNotice = defineAsyncComponent(() => import('./components/UpdateNotice.vue'));
let updates;
let disposed = false;
let stopDataFlush;

async function handleDataFlush(request) {
  const id = typeof request === 'object' ? request.id : request;
  try {
    await Promise.all([flushLocalWrites(), flushDataWrites()]);
    if (request?.suspend) {
      suspendLocalWrites();
      suspendDataWrites();
    }
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
  if (!electronEnabled) return;
  const { useUpdatesStore } = await import('./stores/updates.js');
  if (disposed) return;
  updates = useUpdatesStore();
  updates.initialize();
  stopDataFlush = window.electronAPI.data.onFlush(handleDataFlush);
});
onBeforeUnmount(() => {
  disposed = true;
  updates?.dispose();
  stopDataFlush?.();
});

onErrorCaptured(error => {
  fatalError.value = error?.message || 'The app could not start.';
  return false;
});
</script>

<template>
  <main
    v-if="fatalError"
    class="fatal-error"
    role="alert"
  >
    <i class="fas fa-circle-exclamation" />
    <h1>Something Went Wrong</h1>
    <p>{{ fatalError }}</p>
    <button
      type="button"
      @click="location.reload()"
    >
      Try Again
    </button>
  </main>
  <main
    v-else-if="!storageReady"
    class="exam-route-state"
    aria-live="polite"
  >
    <i class="fas fa-spinner fa-spin" /> Loading your practice data…
  </main>
  <RouterView v-else />
  <UpdateNotice v-if="electronEnabled" />
</template>
