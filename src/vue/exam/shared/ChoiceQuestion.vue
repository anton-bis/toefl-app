<script setup>
import ChoiceList from './ChoiceList.vue';

defineProps({
  question: { type: Object, required: true },
  answers: { type: Object, default: () => ({}) },
  locked: { type: [Boolean, Object, Array], default: false },
  showPrompt: { type: Boolean, default: true }
});
defineEmits(['answer']);
</script>

<template>
  <div class="question-container-apple">
    <div v-if="showPrompt" class="question-text-apple">{{ question.prompt }}</div>
    <slot />
    <ChoiceList
      :question="question"
      :answers="answers"
      :locked="locked"
      @answer="(id, value) => $emit('answer', id, value)"
    />
  </div>
</template>
