<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { resolveQuestionAsset } from '../../../platform/contentRepository.js';
import { formatMinutesSeconds } from '../../../utils/time.js';
import { normalizeVolume } from '../../../utils/volume.js';
import { segmentDuration } from './helpers.js';

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
const source = computed(() => resolveQuestionAsset(props.document, props.media?.file));
const progress = computed(() =>
  duration.value ? Math.min(100, (elapsed.value / duration.value) * 100) : 0
);

function applyVolume(value) {
  if (audio.value) audio.value.volume = normalizeVolume(value);
}

watch(() => props.volume, applyVolume, { immediate: true });
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
  const end = Number(props.media?.end);
  if (status.value === 'playing') {
    audio.value.pause();
    publish('paused');
    return;
  }
  if (
    status.value === 'idle' ||
    status.value === 'ended' ||
    audio.value.currentTime < start ||
    (Number.isFinite(end) && audio.value.currentTime >= end)
  ) {
    audio.value.currentTime = start;
    elapsed.value = 0;
  }
  applyVolume(props.volume);
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
  const element = audio.value;
  if (!element) return;
  const start = Number(props.media?.start || 0);
  elapsed.value = Math.max(0, element.currentTime - start);
  duration.value ||= segmentDuration(props.media, element.duration);
  const end = Number(props.media?.end);
  if (Number.isFinite(end) && element.currentTime >= end) finish();
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
      :class="{ played: playOnce && status === 'ended' }"
      :disabled="!source || (playOnce && status === 'ended')"
      :aria-label="status === 'playing' ? 'Pause audio' : 'Play audio'"
      @click="play"
    >
      <i class="fas" :class="status === 'playing' ? 'fa-pause' : 'fa-play'"></i>
    </button>
    <div class="audio-progress-bar">
      <div class="audio-progress-fill" :style="{ width: `${progress}%` }"></div>
    </div>
    <div class="audio-time">
      {{ formatMinutesSeconds(elapsed) }} / {{ formatMinutesSeconds(duration) }}
    </div>
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
