<script setup>
import AcademicPassage from './AcademicPassage.vue';
import CompleteWords from './CompleteWords.vue';
import DailyPassage from './DailyPassage.vue';

defineProps({
  page: { type: Object, required: true },
  task: { type: Object, required: true },
  question: { type: Object, default: null },
  answers: { type: Object, default: () => ({}) },
  locked: { type: [Boolean, Object, Array], default: false }
});
const emit = defineEmits(['answer']);
</script>

<template>
  <main class="reading-page main-content exam-content-pane" :data-page-id="page.id">
    <CompleteWords
      v-if="task.type === 'complete-words'"
      :task="task"
      :answers="answers"
      :locked="locked"
      @answer="(id, value) => emit('answer', id, value)"
    />
    <AcademicPassage
      v-else-if="task.type === 'academic-passage'"
      :task="task"
      :question="question"
      :answers="answers"
      :locked="locked"
      @answer="(id, value) => emit('answer', id, value)"
    />
    <DailyPassage
      v-else
      :task="task"
      :question="question"
      :answers="answers"
      :locked="locked"
      @answer="(id, value) => emit('answer', id, value)"
    />
  </main>
</template>

<style src="./reading.css"></style>
