<script setup>
import { computed, ref } from 'vue';
import { DIFFICULTIES, DIFFICULTY_CONFIG } from './logic.js';

const props = defineProps({
  history: { type: Array, required: true },
  best: { type: Object, required: true }
});
defineEmits(['back']);
const selected = ref('beginner');
const records = computed(() =>
  props.history.filter(record => record.difficulty === selected.value)
);
const formatTime = seconds =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const chart = computed(() => {
  if (records.value.length < 2) return null;
  const values = records.value.map(record => record.netWpm);
  const high = Math.max(...values) + 5;
  const low = Math.max(0, Math.min(...values) - 5);
  const range = Math.max(1, high - low);
  const points = values.map((value, index) => ({
    x: 44 + (index / (values.length - 1)) * 440,
    y: 20 + (1 - (value - low) / range) * 152,
    value
  }));
  return { high, low, points, polyline: points.map(point => `${point.x},${point.y}`).join(' ') };
});
</script>

<template>
  <div class="typing-progress">
    <div class="typing-progress-header">
      <button class="typing-back-btn" type="button" @click="$emit('back')">← Back</button>
    </div>
    <div class="typing-progress-tabs">
      <button
        v-for="difficulty in DIFFICULTIES"
        :key="difficulty"
        type="button"
        class="typing-progress-tab"
        :class="{ active: selected === difficulty }"
        :style="{ '--tab-color': DIFFICULTY_CONFIG[difficulty].color }"
        @click="selected = difficulty"
      >
        <span
          class="typing-progress-tab-dot"
          :style="{ background: DIFFICULTY_CONFIG[difficulty].color }"
        ></span>
        <span class="typing-progress-tab-label">{{ DIFFICULTY_CONFIG[difficulty].label }}</span>
        <span class="typing-progress-tab-stats"
          ><span class="typing-progress-tab-stat typing-progress-tab-stat-main"
            >{{ best[difficulty]?.bestNetWpm?.toFixed(1) || '--' }} WPM</span
          ><span class="typing-progress-tab-stat"
            >{{ best[difficulty]?.bestAccuracy?.toFixed(1) || '--' }}%</span
          ><span class="typing-progress-tab-stat"
            >{{ best[difficulty]?.historyCount || 0 }} practices</span
          ></span
        >
      </button>
    </div>
    <div class="typing-progress-chart">
      <template v-if="chart">
        <div class="typing-progress-chart-title">Net WPM Trend</div>
        <svg viewBox="0 0 500 200" class="typing-chart-svg" role="img" aria-label="Net WPM trend">
          <line
            v-for="line in 4"
            :key="line"
            x1="44"
            :y1="20 + ((line - 1) / 3) * 152"
            x2="484"
            :y2="20 + ((line - 1) / 3) * 152"
            stroke="#e5e5e7"
            stroke-dasharray="4,4"
          />
          <polyline
            :points="chart.polyline"
            fill="none"
            stroke="#008080"
            stroke-width="2"
            stroke-linejoin="round"
          />
          <circle
            v-for="point in chart.points"
            :key="`${point.x}-${point.y}`"
            :cx="point.x"
            :cy="point.y"
            r="4.5"
            fill="#fff"
            stroke="#008080"
            stroke-width="2"
          />
        </svg>
      </template>
      <div v-else class="typing-progress-empty">
        {{
          records.length
            ? 'Complete one more practice to see your progress chart.'
            : 'No data yet. Complete a practice to see your progress.'
        }}
      </div>
    </div>
    <div class="typing-progress-table">
      <div v-if="!records.length" class="typing-progress-empty">No records yet</div>
      <template v-else>
        <div class="typing-progress-table-title">Recent History</div>
        <table class="typing-history-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>WPM</th>
              <th>Accuracy</th>
              <th>Time</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in [...records].reverse()" :key="record.completedAt">
              <td class="typing-history-title">{{ record.title }}</td>
              <td>{{ record.netWpm.toFixed(1) }}</td>
              <td>{{ record.accuracy.toFixed(1) }}%</td>
              <td>{{ formatTime(record.timeSpent) }}</td>
              <td class="typing-history-date">{{ record.completedAt.slice(0, 10) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>
