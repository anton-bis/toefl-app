<script setup>
import { isAnswered, isCorrectAnswer, questionPageId } from '../shared/model.js';
import { solveAnswerOrder } from '../sections/writing/writingLogic.js';

defineProps({
  tasks: { type: Array, required: true },
  answers: { type: Object, required: true }
});
defineEmits(['select-question']);

function correct(question, answers) {
  return isCorrectAnswer(answers[question.id], question);
}

function wordCount(value) {
  const text = String(value || '').trim();
  return text ? text.split(/\s+/u).filter(Boolean).length : 0;
}

function sentenceAnswer(question, answers) {
  const answer = answers[question.id];
  const slots = Array.isArray(answer) ? answer : answer?.slots;
  if (!Array.isArray(slots)) return 'No response provided.';
  return slots
    .map(index => question.candidates?.[index])
    .filter(Boolean)
    .join(' ');
}

const expectedSentence = question => solveAnswerOrder(question).join(' ');
</script>

<template>
  <div class="results-section-list">
    <section v-for="group in tasks" :key="group.id" class="results-detail-card">
      <header>
        <strong>{{
          group.type === 'academic-discussion' ? 'Academic Discussion' : group.title
        }}</strong>
        <span v-if="group.type === 'build-sentence'">
          {{ group.questions.filter(question => correct(question, answers)).length }} /
          {{ group.questions.length }} correct
        </span>
        <span v-else>{{ wordCount(answers[group.questions[0]?.id]) }} words</span>
      </header>
      <div v-if="group.type === 'build-sentence'" class="results-grid">
        <button
          v-for="question in group.questions"
          :key="question.id"
          type="button"
          :class="
            correct(question, answers)
              ? 'correct'
              : isAnswered(answers[question.id])
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
          <span :class="correct(question, answers) ? 'is-correct' : 'is-incorrect'">
            {{
              isAnswered(answers[question.id])
                ? sentenceAnswer(question, answers)
                : expectedSentence(question)
            }}
          </span>
          <span v-if="isAnswered(answers[question.id]) && !correct(question, answers)">
            (→ {{ expectedSentence(question) }})
          </span>
        </article>
      </div>
      <div v-else class="results-written-response">
        {{ answers[group.questions[0]?.id] || 'No response provided.' }}
      </div>
    </section>
  </div>
</template>
