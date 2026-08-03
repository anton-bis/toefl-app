<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { recordingRepository } from '../../platform/dataRepository.js';
import { resolveQuestionAsset } from '../../platform/contentRepository.js';
import { questionPageId } from '../shared/model.js';
import { useExamStore } from '../../stores/exam.js';

const props = defineProps({
  document: { type: Object, required: true },
  tasks: { type: Array, required: true },
  answers: { type: Object, required: true }
});
defineEmits(['select-question']);

const exam = useExamStore();
const attemptId = computed(() => exam.activeSession?.clientAttemptId || props.document.id);
const urls = ref({});
const states = ref({});
let generation = 0;
let disposed = false;

const promptAudio = question => resolveQuestionAsset(props.document, question.media?.file);
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
    <section v-for="group in tasks" :key="group.id" class="results-detail-card">
      <header>
        <strong>{{ group.title }}</strong
        ><span>{{ group.questions.length }} questions</span>
      </header>
      <div class="speaking-results-list">
        <article v-for="question in group.questions" :key="question.id">
          <button type="button" @click="$emit('select-question', questionPageId(question))">
            Question {{ question.number }}
          </button>
          <p>{{ question.transcript || question.prompt || '(No transcript available)' }}</p>
          <audio
            v-if="promptAudio(question)"
            :src="promptAudio(question)"
            preload="none"
            controls
          />
          <label v-if="urls[question.id]">
            Your Response
            <audio :src="urls[question.id]" preload="none" controls />
          </label>
          <span v-else-if="!hasRecording(question.id) || states[question.id] === 'missing'">
            No recording submitted
          </span>
          <button
            v-else
            type="button"
            :disabled="states[question.id] === 'loading'"
            @click="loadRecording(question.id)"
          >
            {{ states[question.id] === 'loading' ? 'Loading response…' : 'Load your response' }}
          </button>
        </article>
      </div>
    </section>
  </div>
</template>
