<script setup>
import { SUBJECT_LABELS, SUBJECTS } from './logic.js';
defineProps({ store: { type: Object, required: true } });
const icons = { reading: '📖', listening: '🎧', speaking: '🎙', writing: '✎' };
</script>

<template>
  <div>
    <div class="vocab-panel-header">
      <div class="vocab-header-row">
        <div class="vocab-header-titles">
          <h1 class="vocab-panel-title">真题单词背诵</h1>
          <p class="vocab-panel-subtitle">从真题中提取的核心词汇，配合科学记忆曲线定期复习</p>
        </div>
        <button
          class="vocab-mode-toggle"
          type="button"
          @click="store.setMode(store.mode === 'random' ? 'root' : 'random')"
        >
          <span class="toggle-track"
            ><span class="toggle-knob" :class="store.mode === 'random' ? 'left' : 'right'"></span
            ><span class="toggle-label-left">乱序</span
            ><span class="toggle-label-right">词根</span></span
          >
        </button>
      </div>
    </div>
    <div class="vocab-subject-grid">
      <button
        v-for="subject in SUBJECTS"
        :key="subject"
        class="vocab-subject-card"
        type="button"
        @click="store.selectSubject(subject)"
      >
        <span class="subject-card-icon">{{ icons[subject] }}</span
        ><span class="subject-card-label">{{ SUBJECT_LABELS[subject] }}</span
        ><span class="subject-card-count">{{
          store.mode === 'root' ? '词根词缀' : `${store.setCounts[subject] || 0} Set`
        }}</span>
      </button>
    </div>
  </div>
</template>
