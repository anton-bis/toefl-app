<script setup>
import { computed, ref } from 'vue';
import { examQuestions, isCorrectAnswer, questionPageId } from './model.js';
import ExamDialog from './ExamDialog.vue';
import ObjectiveResults from '../results/ObjectiveResults.vue';
import SpeakingResults from '../results/SpeakingResults.vue';
import WritingResults from '../results/WritingResults.vue';

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
const helpOpen = ref(false);
const restartOpen = ref(false);
function questionCorrect(question) {
  const answer = props.session.answers?.[question.id];
  return isCorrectAnswer(answer, question);
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
      <ObjectiveResults
        v-if="['reading', 'listening'].includes(section)"
        :section="section"
        :groups="moduleGroups"
        :answers="session.answers"
        @select-question="$emit('select-question', $event)"
      />
      <WritingResults
        v-else-if="section === 'writing'"
        :tasks="moduleGroups[0]?.tasks || []"
        :answers="session.answers"
        @select-question="$emit('select-question', $event)"
      />
      <SpeakingResults
        v-else
        :document="document"
        :tasks="moduleGroups[0]?.tasks || []"
        :answers="session.answers"
        @select-question="$emit('select-question', $event)"
      />
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
