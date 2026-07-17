<script setup>
import { computed } from 'vue';
import SkillPageHeader from '../../components/SkillPageHeader.vue';
import { formatMinutesSeconds } from '../../utils/time.js';
import { computeMetrics } from './logic.js';

const props = defineProps({ result: { type: Object, required: true } });
defineEmits(['retry', 'back']);
const metrics = computed(() => computeMetrics(props.result));
const errors = [
  ['spacing', 'Spacing'],
  ['capitalization', 'Capitalization'],
  ['spelling', 'Spelling'],
  ['punctuation', 'Punctuation']
];
const maxError = computed(() => Math.max(1, ...Object.values(metrics.value.errors)));
</script>

<template>
  <SkillPageHeader
    title="Practice Complete"
    :subtitle="result.article.title"
    eyebrow="Typing"
    back-label="All Passages"
    compact
    @back="$emit('back')"
  />
  <div class="typing-result skill-content">
    <div class="typing-result-article">{{ result.article.title }}</div>
    <div class="typing-result-sub">
      {{ result.article.difficulty[0].toUpperCase() + result.article.difficulty.slice(1) }} ·
      {{ result.article.wordCount }} words
    </div>
    <div class="typing-result-metrics">
      <div class="typing-metrics-cards">
        <div class="typing-metric-card">
          <div class="typing-metric-value">{{ metrics.rawWpm.toFixed(1) }}</div>
          <div class="typing-metric-label">Raw WPM</div>
        </div>
        <div class="typing-metric-card">
          <div class="typing-metric-value">{{ metrics.accuracy.toFixed(1) }}%</div>
          <div class="typing-metric-label">Accuracy</div>
        </div>
        <div class="typing-metric-card">
          <div class="typing-metric-value">
            {{ formatMinutesSeconds(result.timeSpent / 1000) }}
          </div>
          <div class="typing-metric-label">Time</div>
        </div>
      </div>
      <div class="typing-metrics-net">
        <div class="typing-metrics-net-label">Net WPM</div>
        <div class="typing-metrics-net-value">{{ metrics.netWpm.toFixed(1) }}</div>
      </div>
    </div>
    <div class="typing-error-dist">
      <div v-if="!metrics.incorrectCount" class="typing-error-none">No errors — perfect!</div>
      <template v-else>
        <div class="typing-error-dist-title">Errors</div>
        <div v-for="[key, label] in errors" :key="key" class="typing-error-row">
          <span class="typing-error-label">{{ label }}</span>
          <div class="typing-error-bar-wrap">
            <div
              class="typing-error-bar"
              :class="`typing-error-bar--${key}`"
              :style="{ width: `${(metrics.errors[key] / maxError) * 100}%` }"
            ></div>
          </div>
          <span class="typing-error-count">{{ metrics.errors[key] }}</span>
        </div>
        <div class="typing-error-total">
          Total: {{ metrics.incorrectCount }} error{{ metrics.incorrectCount === 1 ? '' : 's' }}
        </div>
      </template>
    </div>
    <div class="typing-result-actions">
      <button
        class="typing-result-btn typing-result-btn-primary"
        type="button"
        @click="$emit('retry')"
      >
        ↻ Try Again
      </button>
    </div>
  </div>
</template>
