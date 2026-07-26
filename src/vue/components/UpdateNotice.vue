<script setup>
import { useUpdatesStore } from '../stores/updates.js';

const updates = useUpdatesStore();
</script>

<template>
  <aside v-if="updates.hasUpdate || updates.error" class="update-notice">
    <div>
      <strong v-if="updates.error">Update Failed</strong>
      <strong v-else>Version {{ updates.version }} Available</strong>
      <p v-if="updates.error">{{ updates.error }}</p>
      <p v-else-if="updates.status === 'downloading'">Downloading: {{ updates.progress }}%</p>
      <p v-else-if="updates.description">{{ updates.description }}</p>
    </div>
    <button v-if="updates.status === 'available'" type="button" @click="updates.download">
      Download and Install
    </button>
    <button v-else-if="updates.status === 'downloaded'" type="button" @click="updates.install">
      Restart and Install
    </button>
  </aside>
</template>

<style scoped>
.update-notice {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 900;
  width: min(390px, calc(100vw - 44px));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.16);
}
.update-notice p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 13px;
}
.update-notice button {
  border: 0;
  border-radius: 7px;
  background: var(--teal);
  color: #fff;
  padding: 9px 12px;
  white-space: nowrap;
}
</style>
