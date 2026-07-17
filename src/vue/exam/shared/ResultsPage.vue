<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { recordingRepository } from '../../platform/dataRepository.js';
import { resolveQuestionAsset } from '../../platform/contentRepository.js';
import { solveAnswerOrder } from '../sections/writing/writingLogic.js';
import { examQuestions, isAnswered, isCorrectAnswer, questionPageId } from './model.js';
import ExamDialog from './ExamDialog.vue';

const props = defineProps({
  document: { type: Object, required: true },
  page: { type: Object, default: () => ({}) },
  session: { type: Object, required: true },
  score: { type: Number, default: null },
  maxScore: { type: Number, default: null },
  reportPrevious: { type: Boolean, default: false },
  reportNext: { type: Boolean, default: false }
});
defineEmits(['select-question', 'restart', 'exit', 'report-previous', 'report-next']);
const section = computed(() => props.document.section);
const questions = computed(() => examQuestions(props.document));
const moduleGroups = computed(() =>
  (props.document.modules || []).map(module => ({
    ...module,
    questions: module.tasks.flatMap(task => task.questions)
  }))
);
const speakingUrls = ref({});
const helpOpen = ref(false);
const restartOpen = ref(false);
let recordingGeneration = 0;
let disposed = false;
function questionCorrect(question) {
  const answer = props.session.answers?.[question.id];
  return isCorrectAnswer(answer, question);
}
function wordCount(value) {
  const text = String(value || '').trim();
  return text ? text.split(/\s+/u).filter(Boolean).length : 0;
}
function sentenceAnswer(question) {
  const answer = props.session.answers?.[question.id];
  const slots = Array.isArray(answer) ? answer : answer?.slots;
  if (!Array.isArray(slots)) return 'No response provided.';
  return slots
    .map(index => question.candidates?.[index])
    .filter(Boolean)
    .join(' ');
}
function expectedSentence(question) {
  return solveAnswerOrder(question).join(' ');
}
function promptAudio(question) {
  return resolveQuestionAsset(props.document, question.media?.file);
}
const correct = computed(
  () => questions.value.filter(question => questionCorrect(question)).length
);
const scoredQuestions = computed(() =>
  section.value === 'writing'
    ? questions.value.filter(question => question.type === 'build-sentence')
    : questions.value
);
const scoredCorrect = computed(() => scoredQuestions.value.filter(questionCorrect).length);
const percentage = computed(() => {
  if (props.score != null && props.maxScore)
    return Math.round((props.score / props.maxScore) * 100);
  return scoredQuestions.value.length
    ? Math.round((scoredCorrect.value / scoredQuestions.value.length) * 100)
    : 0;
});
const sixPointScore = computed(() =>
  props.score != null && props.maxScore === 30 ? Math.round((props.score / 30) * 6 * 2) / 2 : null
);
const elapsed = computed(() => {
  if (!props.session.startedAt) return '--:--';
  const end = props.session.completedAt || props.session.updatedAt || Date.now();
  const total = Math.max(0, Math.floor((end - props.session.startedAt) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
});
const completionTitle = computed(() => {
  if (props.page.title) return props.page.title;
  const name = section.value.charAt(0).toUpperCase() + section.value.slice(1);
  return `${name} ${['reading', 'listening'].includes(section.value) ? 'Test' : 'Section'} Completed`;
});
const rubricText = computed(
  () =>
    `Scoring based on ${['reading', 'listening'].includes(section.value) ? 'official ' : ''}TOEFL iBT ${section.value.charAt(0).toUpperCase()}${section.value.slice(1)} section rubric`
);
const helpText = computed(() => {
  if (section.value === 'speaking')
    return 'Your responses are based on the TOEFL iBT Speaking section rubric.';
  if (section.value === 'writing') return 'Your scores are based on the TOEFL iBT Writing rubric.';
  const name = section.value.charAt(0).toUpperCase() + section.value.slice(1);
  return `1. Your scores are based on the official TOEFL iBT ${name} rubric.`;
});
const restartText = computed(() => {
  if (section.value === 'speaking')
    return 'Are you sure you want to restart? Your speaking responses will be cleared.';
  if (section.value === 'writing')
    return 'Are you sure you want to restart? Your writing responses will be cleared.';
  if (section.value === 'listening')
    return 'Are you sure you want to restart the listening test? This will clear all your answers and timer data.';
  return 'Are you sure you want to restart the test? This will clear all your answers and timer data.';
});
function releaseSpeakingUrls() {
  Object.values(speakingUrls.value).forEach(url => URL.revokeObjectURL(url));
  speakingUrls.value = {};
}

async function loadSpeakingRecordings() {
  const currentGeneration = ++recordingGeneration;
  releaseSpeakingUrls();
  if (section.value !== 'speaking') return;
  const records = await Promise.all(
    questions.value.map(async question => {
      try {
        return [question.id, await recordingRepository.load(props.document.id, question.id)];
      } catch {
        return [question.id, null];
      }
    })
  );
  if (disposed || currentGeneration !== recordingGeneration) return;
  speakingUrls.value = Object.fromEntries(
    records.filter(([, blob]) => blob).map(([id, blob]) => [id, URL.createObjectURL(blob)])
  );
}

watch(() => props.document.id, loadSpeakingRecordings, { immediate: true });
onBeforeUnmount(() => {
  disposed = true;
  recordingGeneration += 1;
  releaseSpeakingUrls();
});
</script>

<template>
  <div class="exam-page exam-results-page">
    <header class="exam-header">
      <div class="exam-header__brand"><strong>toefl ibt</strong></div>
      <nav class="exam-header__actions">
        <button
          class="exam-nav-button exam-nav-button--dark"
          type="button"
          @click="helpOpen = true"
        >
          <span>Help</span><i class="fas fa-question-circle" />
        </button>
        <button
          v-if="reportPrevious"
          class="exam-nav-button exam-nav-button--dark"
          type="button"
          @click="$emit('report-previous')"
        >
          <span>Back</span><i class="fas fa-arrow-left" />
        </button>
        <button
          v-if="reportNext"
          class="exam-nav-button exam-nav-button--light"
          type="button"
          @click="$emit('report-next')"
        >
          <span>Next</span><i class="fas fa-arrow-right" />
        </button>
        <button class="exam-nav-button exam-nav-button--dark" type="button" @click="$emit('exit')">
          <span>Home</span><i class="fas fa-home" />
        </button>
      </nav>
    </header>
    <main class="results-main">
      <div class="completion-banner">
        <i class="fas fa-check-circle" />
        <h1>{{ completionTitle }}</h1>
      </div>
      <div class="results-summary">
        <section v-if="section !== 'speaking'" class="results-card results-score">
          <div class="results-donut" :style="{ '--score': `${percentage * 3.6}deg` }">
            <div>
              <b>{{ score ?? scoredCorrect }}</b
              ><small>/ {{ maxScore ?? scoredQuestions.length }}</small>
              <em v-if="sixPointScore != null">{{ sixPointScore.toFixed(1) }} / 6</em>
            </div>
          </div>
          <span>{{
            section === 'writing'
              ? 'Build a Sentence'
              : `${section.charAt(0).toUpperCase()}${section.slice(1)} Score`
          }}</span>
        </section>
        <section
          class="results-card results-metrics"
          :class="{ 'results-metrics--single': ['writing', 'speaking'].includes(section) }"
        >
          <div v-if="['reading', 'listening'].includes(section)">
            <b>{{ correct }} / {{ questions.length }}</b
            ><span>{{ percentage }}% Accuracy</span>
          </div>
          <div>
            <b><i class="far fa-clock" /> {{ elapsed }}</b
            ><span>Time Used</span>
          </div>
        </section>
      </div>
      <div v-if="['reading', 'listening'].includes(section)" class="results-legend">
        <span><i class="correct" /> Correct</span><span><i class="incorrect" /> Incorrect</span
        ><span><i class="unanswered" /> Unanswered</span>
      </div>
      <div v-if="['reading', 'listening'].includes(section)" class="results-module-list">
        <section v-for="group in moduleGroups" :key="group.id" class="results-module">
          <h2>
            <i :class="section === 'reading' ? 'fas fa-book' : 'fas fa-volume-up'" />
            {{ group.title }}
            <small
              >{{ group.questions.filter(questionCorrect).length }} /
              {{ group.questions.length }} correct</small
            >
          </h2>
          <div class="module-progress-track">
            <span
              :style="{
                width: `${group.questions.length ? (group.questions.filter(questionCorrect).length / group.questions.length) * 100 : 0}%`
              }"
            />
          </div>
          <div class="results-grid">
            <button
              v-for="question in group.questions"
              :key="question.id"
              type="button"
              :class="{
                correct: questionCorrect(question),
                incorrect: isAnswered(session.answers?.[question.id]) && !questionCorrect(question),
                unanswered: !isAnswered(session.answers?.[question.id])
              }"
              @click="$emit('select-question', questionPageId(question))"
            >
              {{ question.number }}
            </button>
          </div>
        </section>
      </div>
      <div v-else-if="section === 'writing'" class="results-section-list">
        <section
          v-for="group in moduleGroups[0]?.tasks || []"
          :key="group.id"
          class="results-detail-card"
        >
          <header>
            <strong>{{
              group.type === 'academic-discussion' ? 'Academic Discussion' : group.title
            }}</strong>
            <span v-if="group.type === 'build-sentence'">
              {{ group.questions.filter(questionCorrect).length }} /
              {{ group.questions.length }} correct
            </span>
            <span v-else>{{ wordCount(session.answers?.[group.questions[0]?.id]) }} words</span>
          </header>
          <div v-if="group.type === 'build-sentence'" class="results-grid">
            <button
              v-for="question in group.questions"
              :key="question.id"
              type="button"
              :class="
                questionCorrect(question)
                  ? 'correct'
                  : isAnswered(session.answers?.[question.id])
                    ? 'incorrect'
                    : 'unanswered'
              "
              @click="$emit('select-question', questionPageId(question))"
            >
              {{ question.number }}
            </button>
          </div>
          <div v-if="group.type === 'build-sentence'" class="writing-answer-details">
            <article v-for="question in group.questions" :key="`${question.id}-detail`">
              <strong>Question {{ question.number }}</strong>
              <span :class="questionCorrect(question) ? 'is-correct' : 'is-incorrect'">
                {{
                  isAnswered(session.answers?.[question.id])
                    ? sentenceAnswer(question)
                    : expectedSentence(question)
                }}
              </span>
              <span v-if="isAnswered(session.answers?.[question.id]) && !questionCorrect(question)">
                (→ {{ expectedSentence(question) }})
              </span>
            </article>
          </div>
          <div v-else class="results-written-response">
            {{ session.answers?.[group.questions[0]?.id] || 'No response provided.' }}
          </div>
        </section>
      </div>
      <div v-else class="results-section-list">
        <section
          v-for="group in moduleGroups[0]?.tasks || []"
          :key="group.id"
          class="results-detail-card"
        >
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
              <audio v-if="promptAudio(question)" :src="promptAudio(question)" controls />
              <label v-if="speakingUrls[question.id]">
                Your Response
                <audio :src="speakingUrls[question.id]" controls />
              </label>
              <span v-else>No recording submitted</span>
            </article>
          </div>
        </section>
      </div>
      <div class="results-actions">
        <button
          v-if="questions.length"
          class="exam-primary-button"
          type="button"
          @click="$emit('select-question', questionPageId(questions[0]))"
        >
          <i class="fas fa-chart-bar" /> Review Answers
        </button>
        <button class="exam-secondary-button" type="button" @click="restartOpen = true">
          <i class="fas fa-redo" /> Restart Test
        </button>
      </div>
      <p class="results-footer">{{ rubricText }}</p>
    </main>
    <ExamDialog
      :open="helpOpen"
      title="Help"
      icon="fas fa-question-circle"
      @close="helpOpen = false"
    >
      <p>{{ helpText }}</p>
    </ExamDialog>
    <ExamDialog
      :open="restartOpen"
      title="Restart Test"
      icon="fas fa-redo"
      @close="restartOpen = false"
    >
      <p>{{ restartText }}</p>
      <template #actions>
        <button class="exam-secondary-button" type="button" @click="restartOpen = false">
          Cancel
        </button>
        <button
          class="exam-primary-button"
          type="button"
          @click="
            restartOpen = false;
            $emit('restart');
          "
        >
          Restart Test
        </button>
      </template>
    </ExamDialog>
  </div>
</template>
