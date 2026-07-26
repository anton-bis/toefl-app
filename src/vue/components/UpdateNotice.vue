<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUpdatesStore } from '../stores/updates.js';

const route = useRoute();
const updates = useUpdatesStore();
const visible = computed(() => updates.showUpdate && route.name !== 'exam');
const title = computed(() => {
  if (updates.status === 'checking') return 'Checking for Updates';
  if (updates.status === 'up-to-date') return 'You’re Up to Date';
  if (updates.status === 'error') return 'Update Failed';
  if (updates.status === 'installing') return 'Preparing to Restart';
  return `Version ${updates.version} Available`;
});
const message = computed(() => {
  if (updates.status === 'available' && updates.installMode === 'manual') {
    return 'Download the installer, replace the app in Applications, then right-click it and choose Open.';
  }
  if (updates.status === 'downloading') return `Downloading: ${updates.progress}%`;
  if (updates.status === 'downloaded' && updates.installBlocked) {
    return 'Finish the current exam before restarting to install.';
  }
  if (updates.status === 'downloaded') return 'The update is ready to install.';
  if (updates.status === 'installing') return 'Saving your progress before installation…';
  if (updates.status === 'up-to-date') return 'This is the latest available version.';
  return updates.error || updates.description;
});
</script>

<template>
  <aside v-if="visible" class="update-notice" role="status" aria-live="polite">
    <button
      class="dismiss"
      type="button"
      aria-label="Dismiss update notification"
      @click="updates.dismissUpdate"
    >
      ×
    </button>
    <div class="copy">
      <strong>{{ title }}</strong>
      <p v-if="message">{{ message }}</p>
    </div>
    <button
      v-if="updates.status === 'available'"
      class="action"
      type="button"
      @click="updates.downloadUpdate"
    >
      {{ updates.installMode === 'manual' ? 'Download macOS Installer' : 'Download Update' }}
    </button>
    <button
      v-else-if="updates.status === 'downloaded'"
      class="action"
      type="button"
      :disabled="updates.installBlocked"
      @click="updates.installUpdate"
    >
      {{ updates.installBlocked ? 'Finish Exam First' : 'Restart and Install' }}
    </button>
    <button
      v-else-if="updates.status === 'error'"
      class="action"
      type="button"
      @click="updates.retryUpdate"
    >
      Try Again
    </button>
  </aside>
</template>

<style scoped>
.update-notice {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 900;
  width: min(420px, calc(100vw - 44px));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 16px 42px 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.16);
}
.copy {
  min-width: 0;
}
.update-notice p {
  display: -webkit-box;
  margin: 4px 0 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.action,
.dismiss {
  border: 0;
  cursor: pointer;
}
.action {
  border-radius: 7px;
  background: var(--teal);
  color: #fff;
  padding: 9px 12px;
  white-space: nowrap;
}
.action:disabled {
  cursor: default;
  opacity: 0.55;
}
.dismiss {
  position: absolute;
  top: 8px;
  right: 10px;
  background: transparent;
  color: var(--muted);
  font-size: 22px;
  line-height: 1;
}
</style>
