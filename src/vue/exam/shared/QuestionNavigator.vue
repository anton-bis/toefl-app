<script setup>
import { computed } from 'vue';
import { examQuestions, isAnswered, questionPageId } from './model.js';

const props = defineProps({
  open: Boolean,
  document: { type: Object, default: () => ({}) },
  answers: { type: Object, default: () => ({}) },
  marks: { type: Object, default: () => ({}) },
  pageId: { type: String, default: '' }
});
defineEmits(['close', 'select', 'toggle-mark']);

const questions = computed(() => examQuestions(props.document));
const answeredCount = computed(
  () => questions.value.filter(question => isAnswered(props.answers[question.id])).length
);
const markedCount = computed(
  () => questions.value.filter(question => props.marks[question.id]).length
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="exam-overlay" @click.self="$emit('close')">
      <aside class="question-navigator" role="dialog" aria-modal="true" aria-label="Questions">
        <header class="question-navigator__header">
          <h3><i class="fas fa-list-check" aria-hidden="true" /> Questions</h3>
          <button class="exam-icon-button" type="button" aria-label="Close" @click="$emit('close')">
            <i class="fas fa-times" />
          </button>
        </header>
        <div class="question-navigator__stats">
          <span
            ><b class="is-answered">{{ answeredCount }} / {{ questions.length }}</b
            >Answered</span
          >
          <span
            ><b class="is-marked">{{ markedCount }}</b
            >Marked</span
          >
        </div>
        <div class="question-navigator__list">
          <div
            v-for="(question, index) in questions"
            :key="question.id"
            class="question-navigator__item"
            :class="{
              current: questionPageId(question) === pageId,
              answered: isAnswered(answers[question.id]),
              marked: marks[question.id]
            }"
          >
            <button
              class="question-navigator__question"
              type="button"
              @click="$emit('select', questionPageId(question))"
            >
              <span class="question-navigator__number">{{ index + 1 }}</span>
              <span class="question-navigator__label">{{
                question.title || question.prompt || `Question ${index + 1}`
              }}</span>
              <small>{{ isAnswered(answers[question.id]) ? 'Answered' : 'Unanswered' }}</small>
            </button>
            <button
              class="question-navigator__mark"
              type="button"
              :class="{ active: marks[question.id] }"
              :aria-label="marks[question.id] ? 'Remove mark' : 'Mark question'"
              :title="marks[question.id] ? 'Remove mark' : 'Mark question'"
              @click="$emit('toggle-mark', question.id)"
            >
              <i :class="marks[question.id] ? 'fas fa-bookmark' : 'far fa-bookmark'" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
