<script setup>
import { SUBJECT_LABELS, SUBJECTS } from './logic.js';

defineProps({ store: { type: Object, required: true } });

const icons = {
  reading: 'fa-book-open',
  listening: 'fa-volume-up',
  speaking: 'fa-microphone',
  writing: 'fa-pencil-alt'
};
</script>

<template>
  <div class="vocab-subject-grid skill-content">
    <button
      v-for="subject in SUBJECTS"
      :key="subject"
      class="vocab-subject-card skill-card"
      type="button"
      @click="store.selectSubject(subject)"
    >
      <span class="subject-card-icon"><i class="fas" :class="icons[subject]"></i></span>
      <span class="subject-card-label">{{ SUBJECT_LABELS[subject] }}</span>
      <span class="subject-card-count">
        {{ store.mode === 'root' ? 'Word Parts' : `${store.setCounts[subject] || 0} sets` }}
      </span>
    </button>
  </div>
</template>
