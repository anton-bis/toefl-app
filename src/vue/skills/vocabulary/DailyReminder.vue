<script setup>
import { SUBJECT_LABELS } from './logic.js';
defineProps({ store: { type: Object, required: true } });
</script>

<template>
  <div class="reminder-overlay">
    <div class="reminder-card">
      <div class="reminder-title">Today's Vocabulary</div>
      <div class="reminder-section-label">New Words</div>
      <div class="reminder-list">
        <div v-for="item in store.pendingReminder" :key="item.subject" class="reminder-item">
          <span class="reminder-icon">📖</span
          ><span class="reminder-subject">{{ SUBJECT_LABELS[item.subject] }}</span
          ><span class="reminder-set">Set {{ item.setId }}</span>
        </div>
      </div>
      <template v-if="store.todayReviewCount"
        ><div class="reminder-section-label">Due for Review</div>
        <div class="reminder-review-info">{{ store.todayReviewCount }} words ready to review</div>
        <div class="reminder-review-hint">Open a subject to review them.</div></template
      >
      <div class="reminder-actions">
        <button class="reminder-btn primary" type="button" @click="store.startReminder">
          Start</button
        ><button class="reminder-btn ghost" type="button" @click="store.dismissReminder">
          Not Today
        </button>
      </div>
    </div>
  </div>
</template>
