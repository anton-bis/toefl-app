<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { recordingRepository } from '../../platform/dataRepository.js';
import { useExamStore } from '../../stores/exam.js';
import AudioSegment from '../sections/listening/AudioSegment.vue';

const props = defineProps({
  document: { type: Object, required: true },
  tasks: { type: Array, required: true },
  answers: { type: Object, required: true },
  volume: { type: Number, default: 0.8 }
});

const exam = useExamStore();
const attemptId = computed(() => exam.activeSession?.clientAttemptId || props.document.id);
const urls = ref({});
const states = ref({});
let generation = 0;
let disposed = false;

const hasRecording = questionId => Boolean(props.answers[questionId]?.recordingKey);

function releaseUrls() {
  Object.values(urls.value).forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  });
  urls.value = {};
}

function resetRecordings() {
  generation += 1;
  states.value = {};
  releaseUrls();
}

async function loadRecording(questionId) {
  const currentGeneration = generation;
  states.value = { ...states.value, [questionId]: 'loading' };
  const playbackUrl = recordingRepository.playbackUrl?.(attemptId.value, questionId);
  if (playbackUrl) {
    urls.value = { ...urls.value, [questionId]: playbackUrl };
    states.value = { ...states.value, [questionId]: 'ready' };
    return;
  }
  let blob = null;
  try {
    blob = await recordingRepository.load(attemptId.value, questionId);
  } catch {
    // Missing and unreadable responses have the same result presentation.
  }
  if (disposed || currentGeneration !== generation) return;
  if (blob) urls.value = { ...urls.value, [questionId]: URL.createObjectURL(blob) };
  states.value = { ...states.value, [questionId]: blob ? 'ready' : 'missing' };
}

watch(() => props.document.id, resetRecordings, { immediate: true });
onBeforeUnmount(() => {
  disposed = true;
  generation += 1;
  releaseUrls();
});
</script>

<template>
  <div class="results-section-list">
    <section v-for="group in tasks" :key="group.id" class="results-detail-card results-task">
      <header>
        <strong>{{ group.title }}</strong>
      </header>
      <div class="speaking-results-list">
        <details v-for="question in group.questions" :key="question.id" class="answer-review-card">
          <summary>
            <span class="answer-review-card__number">Question {{ question.number }}</span>
            <span class="answer-review-card__prompt">
              {{ question.transcript || question.prompt || 'No transcript available' }}
            </span>
          </summary>
          <div class="answer-review-card__body">
            <div v-if="question.media?.file" class="answer-review-card__media">
              <AudioSegment
                :document="document"
                :media="question.media"
                :volume="volume"
                :play-once="false"
              />
            </div>
            <label v-if="urls[question.id]" class="speaking-response-playback">
              Your Response
              <audio :src="urls[question.id]" preload="none" controls />
            </label>
            <span v-else-if="!hasRecording(question.id) || states[question.id] === 'missing'">
              No recording submitted
            </span>
            <button
              v-else
              type="button"
              class="exam-secondary-button speaking-load-response"
              :disabled="states[question.id] === 'loading'"
              @click="loadRecording(question.id)"
            >
              {{ states[question.id] === 'loading' ? 'Loading response…' : 'Load your response' }}
            </button>
          </div>
        </details>
      </div>
    </section>
  </div>
</template>
