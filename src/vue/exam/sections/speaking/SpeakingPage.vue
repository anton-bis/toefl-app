<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { resolveQuestionAsset } from '../../../platform/contentRepository.js';
import { formatHoursMinutesSeconds, formatMinutesSeconds } from '../../../utils/time.js';
import { normalizeVolume } from '../../../utils/volume.js';
import { useRecorder } from '../../composables/useRecorder.js';
import { examQuestions } from '../../shared/model.js';

const props = defineProps({
  document: { type: Object, required: true },
  page: { type: Object, required: true },
  task: { type: Object, default: null },
  question: { type: Object, default: null },
  volume: { type: Number, default: 0.8 },
  readOnly: { type: Boolean, default: false }
});
const emit = defineEmits(['answer', 'navigation-state']);
const recorder = useRecorder({ sessionId: computed(() => props.document.id) });
const audio = ref();
const audioPlayed = ref(false);
const audioProgress = ref(0);
const audioElapsed = ref(0);
const audioDuration = ref(0);
const remaining = ref(0);
const ringProgress = ref(0);
const phase = ref('listen');
let animationFrame;
let recordingDeadlineTimer;
let recordStartedAt = 0;
let activeQuestionId = '';
let resetGeneration = 0;

function responseDuration(question) {
  const explicit = Number(question?.responseTime);
  if (explicit > 0) return explicit;
  if (question?.type === 'interview') return 45;
  if (question?.number <= 2) return 8;
  if (question?.number <= 5) return 10;
  return 12;
}
const duration = computed(() => responseDuration(props.question));
const circumference = 2 * Math.PI * 34;
const ringOffset = computed(() => circumference * (1 - ringProgress.value));
const questionNumber = computed(() => props.question?.number || 0);
const questionTotal = computed(() => examQuestions(props.document).length);
const displayTime = computed(() => formatHoursMinutesSeconds(Math.ceil(remaining.value)));
const statusText = computed(() => {
  if (recorder.error.value) return microphoneError(recorder.error.value);
  if (recorder.status.value === 'requesting') return 'Requesting microphone...';
  if (recorder.status.value === 'recording') return 'Recording...';
  if (recorder.status.value === 'recorded') return 'Response recorded';
  return audioPlayed.value ? 'Recording...' : 'Click play to listen';
});
const imageUrl = computed(() => assetUrl(props.question?.image || props.page.scenario?.image));
const audioUrl = computed(() => assetUrl(props.question?.media?.file || props.task?.media?.file));

function assetUrl(filename) {
  return resolveQuestionAsset(props.document, filename);
}
function applyVolume(value) {
  if (audio.value) audio.value.volume = normalizeVolume(value);
}
function microphoneError(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError')
    return 'Microphone permission was denied';
  if (error?.name === 'NotFoundError') return 'No microphone was found';
  return error?.message || 'Microphone unavailable';
}
function segmentBounds() {
  const start = Number(props.question?.media?.start) || 0;
  const declaredEnd = Number(props.question?.media?.end);
  const end =
    Number.isFinite(declaredEnd) && declaredEnd > start
      ? declaredEnd
      : audio.value?.duration || start;
  return { start, end, duration: Math.max(0, end - start) };
}
function loadedAudio() {
  const bounds = segmentBounds();
  audioDuration.value = bounds.duration;
  audioElapsed.value = 0;
}
async function playPrompt() {
  if (!audio.value || audioPlayed.value || phase.value !== 'listen') return;
  const bounds = segmentBounds();
  audio.value.currentTime = bounds.start;
  applyVolume(props.volume);
  audioPlayed.value = true;
  try {
    await audio.value.play();
  } catch {
    audioPlayed.value = false;
    phase.value = 'listen';
  }
}
function audioTick() {
  if (!audio.value) return;
  const bounds = segmentBounds();
  audioElapsed.value = Math.max(0, audio.value.currentTime - bounds.start);
  audioDuration.value = bounds.duration;
  audioProgress.value = bounds.duration ? Math.min(1, audioElapsed.value / bounds.duration) : 0;
  if (bounds.end > bounds.start && audio.value.currentTime >= bounds.end) finishPrompt();
}
function finishPrompt() {
  if (!audio.value || phase.value !== 'listen') return;
  audio.value.pause();
  audioProgress.value = 1;
  startResponse();
}
async function startResponse() {
  if (!props.question || props.readOnly || recorder.status.value === 'recording') return;
  activeQuestionId = props.question.id;
  cancelAnimationFrame(animationFrame);
  phase.value = 'recording';
  remaining.value = duration.value;
  ringProgress.value = 0;
  const started = await recorder.start(props.question.id);
  if (!started) {
    phase.value = 'error';
    return;
  }
  recordStartedAt = performance.now();
  clearTimeout(recordingDeadlineTimer);
  recordingDeadlineTimer = window.setTimeout(finishResponse, duration.value * 1000);
  animationFrame = requestAnimationFrame(animateRecording);
}
function animateRecording(now) {
  const elapsed = Math.max(0, (now - recordStartedAt) / 1000);
  ringProgress.value = Math.min(1, elapsed / duration.value);
  remaining.value = Math.max(0, duration.value - elapsed);
  if (elapsed < duration.value && recorder.status.value === 'recording') {
    animationFrame = requestAnimationFrame(animateRecording);
  } else finishResponse();
}
function handleVisibilityChange() {
  cancelAnimationFrame(animationFrame);
  if (recorder.status.value !== 'recording') return;
  if (document.hidden) finishResponse();
  else animateRecording(performance.now());
}
async function finishResponse() {
  cancelAnimationFrame(animationFrame);
  clearTimeout(recordingDeadlineTimer);
  if (phase.value === 'recorded') return;
  const blob = await recorder.stop();
  remaining.value = 0;
  ringProgress.value = blob ? 1 : 0;
  phase.value = blob ? 'recorded' : recorder.error.value ? 'error' : 'listen';
  if (blob && activeQuestionId) {
    emit('answer', activeQuestionId, {
      recordingKey: `${props.document.id}:${activeQuestionId}`,
      mimeType: blob.type,
      size: blob.size,
      recordedAt: Date.now()
    });
  }
}
async function rerecord() {
  if (!props.question || props.readOnly) return;
  await recorder.clear(props.question.id);
  emit('answer', props.question.id, null);
  await startResponse();
}
function togglePlayback() {
  recorder.play();
}
async function resetQuestion() {
  const currentReset = ++resetGeneration;
  const requestedId = props.question?.id || '';
  cancelAnimationFrame(animationFrame);
  clearTimeout(recordingDeadlineTimer);
  recorder.stopPlayback();
  if (recorder.status.value === 'recording') await recorder.stop();
  audio.value?.pause();
  activeQuestionId = requestedId;
  audioPlayed.value = false;
  audioProgress.value = 0;
  audioElapsed.value = 0;
  audioDuration.value = 0;
  remaining.value = duration.value;
  ringProgress.value = 0;
  phase.value = 'listen';
  if (requestedId) {
    const stored = await recorder.load(requestedId);
    if (
      currentReset !== resetGeneration ||
      activeQuestionId !== requestedId ||
      props.question?.id !== requestedId
    )
      return;
    if (stored) {
      remaining.value = 0;
      ringProgress.value = 1;
      phase.value = 'recorded';
      emit('answer', requestedId, {
        recordingKey: `${props.document.id}:${requestedId}`,
        mimeType: stored.type,
        size: stored.size,
        recordedAt: Date.now()
      });
    }
  }
  await nextTick();
  applyVolume(props.volume);
}

watch(() => props.question?.id, resetQuestion, { immediate: true });
watch(
  () => recorder.status.value,
  status => emit('navigation-state', { busy: status === 'requesting' || status === 'recording' }),
  { immediate: true }
);
watch(() => props.volume, applyVolume);
onMounted(() => document.addEventListener('visibilitychange', handleVisibilityChange));
onBeforeUnmount(() => {
  resetGeneration += 1;
  cancelAnimationFrame(animationFrame);
  clearTimeout(recordingDeadlineTimer);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  audio.value?.pause();
});
</script>

<template>
  <section
    v-if="page.type === 'scenario'"
    class="scenario-page exam-content-pane exam-scroll-region"
  >
    <div class="section-label">Speaking</div>
    <h2>{{ page.scenario?.title || task?.scenario?.title }}</h2>
    <img v-if="imageUrl" :src="imageUrl" alt="Scenario Image" />
  </section>
  <section
    v-else-if="question"
    class="speaking-question exam-content-pane exam-scroll-region"
    data-testid="speaking-question"
  >
    <div class="question-progress">Question {{ questionNumber }} of {{ questionTotal }}</div>
    <h2>
      {{
        question.type === 'listen-repeat'
          ? 'Listen and repeat only once'
          : "Please answer the interviewer's questions"
      }}
    </h2>
    <div class="question-image-area">
      <img v-if="imageUrl" :src="imageUrl" :alt="`Question ${questionNumber} Image`" />
    </div>
    <audio
      ref="audio"
      :src="audioUrl"
      preload="metadata"
      @loadedmetadata="loadedAudio"
      @timeupdate="audioTick"
      @ended="finishPrompt"
    />
    <div class="audio-player">
      <button
        type="button"
        :disabled="audioPlayed"
        :class="{ played: audioPlayed }"
        aria-label="Play question audio"
        @click="playPrompt"
      >
        <i :class="audioPlayed ? 'fas fa-volume-up' : 'fas fa-play'" />
      </button>
      <div class="audio-track">
        <span :style="{ width: `${audioProgress * 100}%` }" />
      </div>
      <span>
        {{ formatMinutesSeconds(audioElapsed) }} / {{ formatMinutesSeconds(audioDuration) }}
      </span>
    </div>
    <div class="response-container">
      <div class="response-header">Response Time</div>
      <div class="response-body" :class="phase">
        <button
          v-if="recorder.status.value === 'recorded' && !readOnly"
          type="button"
          class="response-action"
          title="Re-record"
          @click="rerecord"
        >
          <i class="fas fa-rotate-right" />
        </button>
        <div class="ring-wrap">
          <svg viewBox="0 0 80 80">
            <circle class="ring-bg" cx="40" cy="40" r="34" />
            <circle
              class="ring-progress"
              cx="40"
              cy="40"
              r="34"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="ringOffset"
            />
          </svg>
          <i class="fas fa-microphone" />
        </div>
        <div>
          <div class="response-time" :class="{ urgent: remaining <= 3 && phase === 'recording' }">
            {{ displayTime }}
          </div>
          <div class="response-status" role="status">
            {{ statusText }}
          </div>
        </div>
        <button
          v-if="recorder.status.value === 'recorded'"
          type="button"
          class="response-action playback"
          title="Play recording"
          @click="togglePlayback"
        >
          <i :class="recorder.playing.value ? 'fas fa-pause' : 'fas fa-play'" />
        </button>
      </div>
    </div>
  </section>
  <section v-else class="speaking-intro">
    <h1>{{ task?.title || 'Speaking' }}</h1>
  </section>
</template>

<style scoped>
.scenario-page {
  max-width: 1000px;
  margin: auto;
  padding: 45px 30px;
  text-align: center;
}
.section-label {
  font-size: 16px;
  color: #666;
}
.scenario-page h2 {
  font-size: 28px;
  line-height: 1.4;
}
.scenario-page img {
  max-width: 100%;
  max-height: 430px;
  object-fit: contain;
  border-radius: 8px;
}
.speaking-question {
  max-width: 1200px;
  margin: auto;
  min-height: calc(100vh - 150px);
  display: flex;
  flex-direction: column;
  padding: 10px 30px 35px;
  box-sizing: border-box;
  color: #222;
}
.question-progress {
  font-size: 14px;
  color: #444;
}
.speaking-question > h2 {
  text-align: center;
  font-size: 30px;
  margin: 0 0 10px;
}
.question-image-area {
  flex: 1;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.question-image-area img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
.audio-player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #f0f4f4;
  border-radius: 8px;
  max-width: 400px;
  width: 100%;
  margin: 0 auto 10px;
  box-sizing: border-box;
}
.audio-player button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 0;
  background: #008080;
  color: #fff;
  cursor: pointer;
}
.audio-player button.played {
  background: #aaa;
}
.audio-track {
  height: 4px;
  flex: 1;
  background: #d0d0d0;
  border-radius: 2px;
  overflow: hidden;
}
.audio-track span {
  display: block;
  height: 100%;
  background: #008080;
}
.audio-player > span {
  font-size: 13px;
  color: #666;
  font-weight: 600;
  min-width: 90px;
  text-align: right;
}
.response-container {
  max-width: 420px;
  width: 100%;
  margin: 5px auto 0;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
.response-header {
  background: #555;
  color: #fff;
  text-align: center;
  padding: 14px 12px;
  font-size: 17px;
  font-weight: 600;
}
.response-body {
  background: #f8f8fa;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.response-body.recording {
  background: #fef5f5;
}
.response-body.recorded {
  background: #f0faf5;
}
.ring-wrap {
  position: relative;
  width: 48px;
  height: 48px;
}
.ring-wrap svg {
  width: 48px;
  height: 48px;
}
.ring-wrap > i {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #555;
}
.recording .ring-wrap > i {
  color: #c00;
}
.recorded .ring-wrap > i {
  color: #4caf50;
}
.ring-bg,
.ring-progress {
  fill: none;
  stroke-width: 4;
}
.ring-bg {
  stroke: #ddd;
}
.ring-progress {
  stroke: #4caf50;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}
.response-time {
  font:
    700 18px 'Courier New',
    monospace;
  text-align: center;
  min-width: 90px;
}
.response-time.urgent {
  color: #c00;
}
.response-status {
  font-size: 11px;
  color: #86868b;
  text-align: center;
  max-width: 180px;
}
.response-action {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 0;
  background: #e8e8ed;
  color: #555;
  cursor: pointer;
}
.response-action.playback {
  background: #008080;
  color: #fff;
}
.speaking-intro {
  text-align: center;
  padding: 80px 30px;
}
@media (max-width: 700px) {
  .speaking-question {
    padding-inline: 14px;
  }
  .speaking-question > h2 {
    font-size: 24px;
  }
}
@media (min-width: 801px) {
  .scenario-page {
    display: flex;
    flex-direction: column;
  }
  .scenario-page img {
    min-height: 0;
    flex: 1;
  }
  .question-image-area {
    min-height: 0;
  }
}
</style>
