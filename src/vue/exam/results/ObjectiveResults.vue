<script setup>
import { computed } from 'vue';
import { isAnswered, isCorrectAnswer, questionPageId } from '../shared/model.js';

const props = defineProps({
  section: { type: String, required: true },
  groups: { type: Array, required: true },
  answers: { type: Object, required: true }
});
defineEmits(['select-question']);

const scoredGroups = computed(() =>
  props.groups.map(group => ({
    ...group,
    correctCount: group.questions.filter(question =>
      isCorrectAnswer(props.answers[question.id], question)
    ).length
  }))
);

function stateFor(question, answers) {
  const answer = answers[question.id];
  if (isCorrectAnswer(answer, question)) return 'correct';
  return isAnswered(answer) ? 'incorrect' : 'unanswered';
}
</script>

<template>
  <div class="results-legend">
    <span><i class="correct" /> Correct</span><span><i class="incorrect" /> Incorrect</span
    ><span><i class="unanswered" /> Unanswered</span>
  </div>
  <div class="results-module-list">
    <section v-for="group in scoredGroups" :key="group.id" class="results-module">
      <h2>
        <i :class="section === 'reading' ? 'fas fa-book' : 'fas fa-volume-up'" />
        {{ group.title }}
        <small>{{ group.correctCount }} / {{ group.questions.length }} correct</small>
      </h2>
      <div class="module-progress-track">
        <span
          :style="{
            width: `${group.questions.length ? (group.correctCount / group.questions.length) * 100 : 0}%`
          }"
        />
      </div>
      <div class="results-grid">
        <button
          v-for="(question, index) in group.questions"
          :key="question.id"
          type="button"
          :class="stateFor(question, answers)"
          @click="$emit('select-question', questionPageId(question))"
        >
          {{ index + 1 }}
        </button>
      </div>
    </section>
  </div>
</template>
