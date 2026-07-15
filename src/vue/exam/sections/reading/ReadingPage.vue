<script setup>
import AcademicPassage from './AcademicPassage.vue';
import CompleteWords from './CompleteWords.vue';
import DailyPassage from './DailyPassage.vue';

defineProps({
  document: { type: Object, required: true },
  page: { type: Object, required: true },
  task: { type: Object, required: true },
  question: { type: Object, default: null },
  answers: { type: Object, default: () => ({}) },
  marks: { type: [Object, Array], default: () => ({}) },
  checked: { type: [Boolean, Object, Array], default: false },
  volume: { type: Number, default: 0.8 }
});
const emit = defineEmits(['answer', 'media-state']);
</script>

<template>
  <main
    class="reading-page main-content"
    :class="{ 'reading-page--academic': task.type === 'academic-passage' }"
    :data-page-id="page.id"
  >
    <CompleteWords
      v-if="task.type === 'complete-words'"
      :task="task"
      :answers="answers"
      :checked="checked"
      @answer="(id, value) => emit('answer', id, value)"
    />
    <AcademicPassage
      v-else-if="task.type === 'academic-passage'"
      :task="task"
      :question="question"
      :answers="answers"
      :checked="checked"
      @answer="(id, value) => emit('answer', id, value)"
    />
    <DailyPassage
      v-else
      :task="task"
      :question="question"
      :answers="answers"
      :checked="checked"
      @answer="(id, value) => emit('answer', id, value)"
    />
  </main>
</template>

<style src="./reading.css"></style>
