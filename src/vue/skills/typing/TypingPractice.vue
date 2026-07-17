<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import SkillPageHeader from '../../components/SkillPageHeader.vue';
import { formatMinutesSeconds } from '../../utils/time.js';
import { maxSecondsFor } from './logic.js';

const props = defineProps({ store: { type: Object, required: true } });
const emit = defineEmits(['back']);
const now = ref(Date.now());
let ticker;

const displayTime = computed(() => formatMinutesSeconds(props.store.remaining(now.value) / 1000));
const maxSeconds = computed(() => maxSecondsFor(props.store.article));

function onKeydown(event) {
  if (event.target?.closest?.('button, input, textarea, select, a, [contenteditable]')) return;
  if (
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    ['Shift', 'Tab', 'CapsLock', 'Escape'].includes(event.key)
  )
    return;
  if (event.key === 'Backspace' || event.key === 'Enter' || event.key.length === 1) {
    event.preventDefault();
    props.store.processKey(event.key, Date.now());
  }
}

function restart(event) {
  props.store.retry();
  event.currentTarget.blur();
}

function togglePause(event) {
  if (props.store.isPaused) {
    props.store.resume();
    event.currentTarget.blur();
  } else props.store.pause();
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  ticker = window.setInterval(() => {
    now.value = Date.now();
    if (maxSeconds.value && props.store.timeSpent(now.value) >= maxSeconds.value * 1000)
      props.store.complete(now.value);
  }, 1000);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  window.clearInterval(ticker);
  if (props.store.session && !props.store.isPaused) props.store.pause();
});
</script>

<template>
  <SkillPageHeader
    :title="store.article.title"
    eyebrow="Typing"
    back-label="All Passages"
    compact
    @back="emit('back')"
  >
    <template #actions>
      <div class="typing-header-controls">
        <button class="typing-control-btn typing-retry-btn" type="button" @click="restart">
          ↻ Restart
        </button>
        <button class="typing-control-btn typing-pause-btn" type="button" @click="togglePause">
          {{ store.isPaused ? '▶ Resume' : '⏸ Pause' }}
        </button>
        <span class="typing-timer">{{ displayTime }}</span>
      </div>
    </template>
  </SkillPageHeader>
  <div class="typing-area skill-content">
    <div class="typing-text-display" :class="{ paused: store.isPaused }">
      <span
        v-for="(char, index) in store.session.chars"
        :key="index"
        class="char"
        :class="[`char-${char.status}`, { 'char-current': index === store.currentIndex }]"
        >{{ char.expected }}</span
      >
    </div>
  </div>
</template>
