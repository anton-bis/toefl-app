<script setup>
import { computed } from 'vue';
import { formatMinutesSeconds } from '../../utils/time.js';
import { computeMetrics } from './logic.js';

const props = defineProps({ result: { type: Object, required: true } });
defineEmits(['retry', 'back']);
const metrics = computed(() => computeMetrics(props.result));
const errors = [
  ['spacing', 'Spacing / 空格', '#FF9500'],
  ['capitalization', 'Capitalization / 大小写', '#007AFF'],
  ['spelling', 'Spelling / 拼写', '#FF3B30'],
  ['punctuation', 'Punctuation / 标点', '#AF52DE']
];
const maxError = computed(() => Math.max(1, ...Object.values(metrics.value.errors)));
</script>

<template>
  <div class="typing-result">
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
        <div class="typing-error-dist-title">Error Distribution / 错误分布</div>
        <div v-for="[key, label, color] in errors" :key="key" class="typing-error-row">
          <span class="typing-error-label">{{ label }}</span>
          <div class="typing-error-bar-wrap">
            <div
              class="typing-error-bar"
              :style="{ width: `${(metrics.errors[key] / maxError) * 100}%`, background: color }"
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
      <button
        class="typing-result-btn typing-result-btn-ghost"
        type="button"
        @click="$emit('back')"
      >
        ← Back to List
      </button>
    </div>
  </div>
</template>
