<script setup>
import { computed } from 'vue';
import ExamDialog from './ExamDialog.vue';
import {
  correctAnswerFor,
  examQuestions,
  isAnswered,
  isCorrectAnswer,
  questionPageId
} from './model.js';

const props = defineProps({
  open: Boolean,
  document: { type: Object, default: () => ({}) },
  answers: { type: Object, default: () => ({}) },
  revealAnswers: { type: Boolean, default: true }
});
defineEmits(['close', 'retry', 'select']);
const questions = computed(() => examQuestions(props.document));
const rows = computed(() =>
  questions.value.map((question, index) => ({
    question,
    number: index + 1,
    answer: props.answers[question.id],
    answered: isAnswered(props.answers[question.id]),
    correct: isCorrectAnswer(props.answers[question.id], question),
    expected: correctAnswerFor(question)
  }))
);
const correct = computed(() => rows.value.filter(row => row.correct).length);
const incorrect = computed(() => rows.value.length - correct.value);
const accuracy = computed(() =>
  rows.value.length ? Math.round((correct.value / rows.value.length) * 100) : 0
);
function answerText(row) {
  if (row.question.type !== 'build-sentence') return row.answer;
  const slots = Array.isArray(row.answer) ? row.answer : row.answer?.slots;
  if (!Array.isArray(slots)) return '(empty)';
  return slots
    .map(index => row.question.candidates?.[index])
    .filter(Boolean)
    .join(' ');
}
</script>

<template>
  <ExamDialog
    :open="open"
    title="Answers Check"
    icon="fas fa-clipboard-check"
    width="720px"
    @close="$emit('close')"
  >
    <div class="check-stats">
      <span
        ><small>Total Questions:</small><b>{{ rows.length }}</b></span
      >
      <span
        ><small>Correct:</small><b class="is-correct">{{ correct }}</b></span
      >
      <span
        ><small>Incorrect:</small><b class="is-incorrect">{{ incorrect }}</b></span
      >
      <span
        ><small>Accuracy:</small><b>{{ accuracy }}%</b></span
      >
    </div>
    <h4>Question Details:</h4>
    <div class="check-list">
      <button
        v-for="row in rows"
        :key="row.question.id"
        type="button"
        @click="$emit('select', questionPageId(row.question), row.question)"
      >
        <span
          class="check-number"
          :class="row.correct ? 'correct' : row.answered ? 'wrong' : 'empty'"
          >{{ row.number }}</span
        >
        <span>
          <b>{{ row.question.title || `Question ${row.number}` }}</b>
          <small>Your answer: {{ row.answered ? answerText(row) : '(empty)' }}</small>
          <small>{{
            !row.answered ? 'Not answered' : row.correct ? 'Correct' : 'Incorrect'
          }}</small>
          <small v-if="revealAnswers && !row.correct">Correct: {{ row.expected ?? '' }}</small>
        </span>
      </button>
    </div>
    <template #actions>
      <button class="exam-warning-button" type="button" @click="$emit('retry')">
        <i class="fas fa-redo" /> Retry
      </button>
      <button class="exam-secondary-button" type="button" @click="$emit('close')">Close</button>
    </template>
  </ExamDialog>
</template>
