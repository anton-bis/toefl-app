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
      <i class="fas fa-times" aria-hidden="true" />
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
  width: min(440px, calc(100vw - 44px));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 30px;
  align-items: center;
  gap: 12px;
  padding: 14px 14px 14px 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.16);
}
.copy {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
}
.copy strong {
  font-size: 15px;
  line-height: 1.35;
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
  min-height: 36px;
  grid-column: 2;
  grid-row: 1;
  padding: 0 14px;
  border-radius: 6px;
  background: var(--teal);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.action:hover:not(:disabled) {
  background: var(--teal-dark);
}
.action:disabled {
  cursor: default;
  opacity: 0.55;
}
.dismiss {
  width: 30px;
  height: 30px;
  display: grid;
  grid-column: 3;
  grid-row: 1;
  place-items: center;
  padding: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
}
.dismiss:hover {
  background: var(--teal-light);
  color: var(--text);
}
.action:focus-visible,
.dismiss:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .update-notice {
    grid-template-columns: minmax(0, 1fr) 30px;
  }

  .dismiss {
    grid-column: 2;
  }

  .action {
    width: 100%;
    grid-column: 1 / -1;
    grid-row: 2;
    justify-content: center;
  }
}
</style>
