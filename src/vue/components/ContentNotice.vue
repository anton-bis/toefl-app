<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUpdatesStore } from '../stores/updates.js';

const route = useRoute();
const updates = useUpdatesStore();
const visible = computed(() => updates.contentNoticeVisible && route.name !== 'exam');
</script>

<template>
  <aside v-if="visible" class="content-notice" role="status" aria-live="polite">
    <i class="fas fa-circle-check" aria-hidden="true" />
    <span class="content-notice__message">{{ updates.contentNoticeMessage }}</span>
    <button
      class="content-notice__dismiss"
      type="button"
      aria-label="Dismiss question bank notification"
      @click="updates.dismissContentNotice"
    >
      <i class="fas fa-times" aria-hidden="true" />
    </button>
  </aside>
</template>

<style scoped>
.content-notice {
  position: fixed;
  top: 18px;
  left: 50%;
  z-index: 950;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 10px 10px 10px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
  transform: translateX(-50%);
}
.content-notice > .fa-circle-check {
  flex: none;
  color: var(--teal);
  font-size: 16px;
}
.content-notice__message {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.content-notice__dismiss {
  width: 28px;
  height: 28px;
  display: grid;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.content-notice__dismiss:hover {
  background: var(--teal-light);
  color: var(--text);
}
.content-notice__dismiss:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .content-notice {
    border-radius: 12px;
  }

  .content-notice__message {
    white-space: normal;
  }
}
</style>
