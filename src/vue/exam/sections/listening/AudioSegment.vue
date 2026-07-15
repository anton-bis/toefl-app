<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { formatMediaTime, resolveMediaSource, segmentDuration } from './helpers.js';

const props = defineProps({
  document: { type: Object, required: true },
  media: { type: Object, default: null },
  volume: { type: Number, default: 0.8 },
  playOnce: { type: Boolean, default: true }
});
const emit = defineEmits(['media-state']);
const audio = ref(null);
const status = ref('idle');
const elapsed = ref(0);
const duration = ref(0);
const source = computed(() => resolveMediaSource(props.document, props.media));
const progress = computed(() =>
  duration.value ? Math.min(100, (elapsed.value / duration.value) * 100) : 0
);

watch(
  () => props.volume,
  value => {
    if (audio.value) audio.value.volume = Math.max(0, Math.min(1, value));
  },
  { immediate: true }
);
watch(source, () => reset(), { flush: 'post' });

function publish(next, extra = {}) {
  status.value = next;
  emit('media-state', {
    state: next,
    source: source.value,
    elapsed: elapsed.value,
    duration: duration.value,
    ...extra
  });
}

function reset() {
  if (!audio.value) return;
  audio.value.pause();
  elapsed.value = 0;
  duration.value = 0;
  status.value = 'idle';
  audio.value.load();
}

async function play() {
  if (!audio.value || !source.value || (props.playOnce && status.value === 'ended')) return;
  const start = Number(props.media?.start || 0);
  if (status.value === 'idle' || audio.value.currentTime < start) audio.value.currentTime = start;
  audio.value.volume = Math.max(0, Math.min(1, props.volume));
  try {
    await audio.value.play();
    publish('playing');
  } catch (error) {
    publish('error', { error });
  }
}

function loaded() {
  duration.value = segmentDuration(props.media, audio.value?.duration);
  elapsed.value = 0;
  publish('ready');
}

function timeupdate() {
  const start = Number(props.media?.start || 0);
  elapsed.value = Math.max(0, (audio.value?.currentTime || 0) - start);
  duration.value ||= segmentDuration(props.media, audio.value?.duration);
  const end = Number(props.media?.end);
  if (Number.isFinite(end) && audio.value.currentTime >= end) finish();
}

function finish() {
  if (!audio.value || status.value === 'ended') return;
  audio.value.pause();
  elapsed.value = duration.value;
  publish('ended');
}

function fail() {
  publish('error');
}

onBeforeUnmount(() => {
  if (!audio.value) return;
  audio.value.pause();
  audio.value.removeAttribute('src');
  audio.value.load();
  publish('stopped');
});
</script>

<template>
  <div class="audio-inline-player" :data-state="status">
    <button
      type="button"
      class="audio-play-btn"
      :class="{ played: status === 'ended' }"
      :disabled="!source || (playOnce && status === 'ended')"
      aria-label="Play audio"
      @click="play"
    >
      <i class="fas" :class="status === 'playing' ? 'fa-volume-up' : 'fa-play'"></i>
    </button>
    <div class="audio-progress-bar">
      <div class="audio-progress-fill" :style="{ width: `${progress}%` }"></div>
    </div>
    <div class="audio-time">{{ formatMediaTime(elapsed) }} / {{ formatMediaTime(duration) }}</div>
    <audio
      ref="audio"
      :src="source"
      preload="metadata"
      @loadedmetadata="loaded"
      @timeupdate="timeupdate"
      @ended="finish"
      @error="fail"
    ></audio>
  </div>
</template>
