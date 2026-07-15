<script setup>
import { SUBJECT_LABELS } from './logic.js';
defineProps({ store: { type: Object, required: true } });
</script>

<template>
  <div class="reminder-overlay">
    <div class="reminder-card">
      <div class="reminder-title">每日单词提醒</div>
      <div class="reminder-section-label">今日新词</div>
      <div class="reminder-list">
        <div v-for="item in store.pendingReminder" :key="item.subject" class="reminder-item">
          <span class="reminder-icon">📖</span
          ><span class="reminder-subject">{{ SUBJECT_LABELS[item.subject] }}</span
          ><span class="reminder-set">Set {{ item.setId }}</span>
        </div>
      </div>
      <template v-if="store.todayReviewCount"
        ><div class="reminder-section-label">今日待复习</div>
        <div class="reminder-review-info">共 {{ store.todayReviewCount }} 个单词需要复习</div>
        <div class="reminder-review-hint">进入各科目 Set 列表查看待复习单词</div></template
      >
      <div class="reminder-actions">
        <button class="reminder-btn primary" type="button" @click="store.startReminder">
          开始背诵</button
        ><button class="reminder-btn ghost" type="button" @click="store.dismissReminder">
          今日不提醒
        </button>
      </div>
    </div>
  </div>
</template>
