<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import SkillPageHeader from '../../components/SkillPageHeader.vue';
import { formatMinutesSeconds } from '../../utils/time.js';
import { maxSecondsFor } from './logic.js';
import TypingCharacterChunk from './TypingCharacterChunk.vue';

const props = defineProps({ store: { type: Object, required: true } });
const emit = defineEmits(['back']);
const now = ref(Date.now());
let ticker;

const displayTime = computed(() => formatMinutesSeconds(props.store.remaining(now.value) / 1000));
const maxSeconds = computed(() => maxSecondsFor(props.store.article));
const characterChunks = computed(() => {
  const chars = props.store.session?.chars || [];
  const chunks = [];
  for (let start = 0; start < chars.length; start += 64) {
    chunks.push({ start, chars: chars.slice(start, start + 64) });
  }
  return chunks;
});

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

function stopTicker() {
  window.clearInterval(ticker);
  ticker = undefined;
}

function tick() {
  now.value = Date.now();
  if (maxSeconds.value && props.store.timeSpent(now.value) >= maxSeconds.value * 1000)
    props.store.complete(now.value);
}

function startTicker() {
  stopTicker();
  tick();
  if (!document.hidden) ticker = window.setInterval(tick, 1000);
}

function handleVisibilityChange() {
  if (document.hidden) stopTicker();
  else startTicker();
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  startTicker();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  stopTicker();
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
        <button
          class="typing-control-btn typing-retry-btn"
          type="button"
          @click="restart"
        >
          ↻ Restart
        </button>
        <button
          class="typing-control-btn typing-pause-btn"
          type="button"
          @click="togglePause"
        >
          {{ store.isPaused ? '▶ Resume' : '⏸ Pause' }}
        </button>
        <span class="typing-timer">{{ displayTime }}</span>
      </div>
    </template>
  </SkillPageHeader>
  <div class="typing-area skill-content">
    <div
      class="typing-text-display"
      :class="{ paused: store.isPaused }"
    >
      <TypingCharacterChunk
        v-for="chunk in characterChunks"
        :key="chunk.start"
        :chars="chunk.chars"
        :start="chunk.start"
        :current-index="
          chunk.start <= store.currentIndex && store.currentIndex < chunk.start + chunk.chars.length
            ? store.currentIndex
            : -1
        "
      />
    </div>
  </div>
</template>
