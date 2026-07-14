<script setup>
import { useExamTimer } from '../composables/useExamTimer.js';

const props = defineProps({
  document: { type: Object, default: () => ({}) },
  page: { type: Object, default: () => ({}) },
  timer: { type: Object, default: null },
  questionNumber: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  questionLabel: { type: String, default: '' },
  urgentAt: { type: Number, default: 60 },
  canBack: { type: Boolean, default: false },
  canNext: { type: Boolean, default: true },
  showVolume: { type: Boolean, default: true },
  showBack: { type: Boolean, default: true },
  showReview: { type: Boolean, default: true },
  showCheck: { type: Boolean, default: true }
});
const emit = defineEmits([
  'exit',
  'volume',
  'help',
  'review',
  'check',
  'back',
  'next',
  'toggle-time',
  'expired'
]);

const { display: timeText, urgent } = useExamTimer(() => props.timer, {
  urgentAt: props.urgentAt,
  onExpired: () => emit('expired')
});
</script>

<template>
  <header class="exam-header">
    <div class="exam-header__brand">
      <strong>toefl ibt</strong>
      <button class="exam-nav-button exam-nav-button--dark" type="button" @click="$emit('exit')">
        <span>Exit</span><i class="fas fa-sign-out-alt" aria-hidden="true" />
      </button>
    </div>
    <nav class="exam-header__actions" aria-label="Exam actions">
      <button
        v-if="showVolume"
        class="exam-nav-button exam-nav-button--dark"
        type="button"
        @click="$emit('volume')"
      >
        <span>Volume</span><i class="fas fa-volume-up" aria-hidden="true" />
      </button>
      <button class="exam-nav-button exam-nav-button--dark" type="button" @click="$emit('help')">
        <span>Help</span><i class="fas fa-question-circle" aria-hidden="true" />
      </button>
      <button
        v-if="showReview"
        class="exam-nav-button exam-nav-button--dark"
        type="button"
        @click="$emit('review')"
      >
        <span>Review</span><i class="fas fa-flag" aria-hidden="true" />
      </button>
      <button
        v-if="showCheck"
        class="exam-nav-button exam-nav-button--dark"
        type="button"
        @click="$emit('check')"
      >
        <span>Check Answers</span><i class="fas fa-check-circle" aria-hidden="true" />
      </button>
      <button
        v-if="showBack"
        class="exam-nav-button exam-nav-button--dark"
        type="button"
        :disabled="!canBack"
        @click="$emit('back')"
      >
        <span>Back</span><i class="fas fa-arrow-left" aria-hidden="true" />
      </button>
      <button
        class="exam-nav-button exam-nav-button--light"
        type="button"
        :disabled="!canNext"
        @click="$emit('next')"
      >
        <span>Next</span><i class="fas fa-arrow-right" aria-hidden="true" />
      </button>
    </nav>
  </header>
  <div v-if="timer || questionNumber" class="exam-timer-row">
    <div class="exam-question-progress">
      <span v-if="questionLabel">{{ questionLabel }}</span>
      <span v-else-if="questionNumber">Question {{ questionNumber }} of {{ totalQuestions }}</span>
    </div>
    <div v-if="timer" class="exam-timer-controls">
      <span class="exam-timer" :class="{ urgent, hidden: timer.hidden }">{{ timeText }}</span>
      <button class="exam-time-toggle" type="button" @click="$emit('toggle-time')">
        <i :class="timer.hidden ? 'fas fa-eye' : 'fas fa-eye-slash'" aria-hidden="true" />
        {{ timer.hidden ? 'Show Time' : 'Hide Time' }}
      </button>
    </div>
  </div>
</template>
