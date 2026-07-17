<script setup>
import { optionState } from './choice.js';

defineProps({
  question: { type: Object, required: true },
  answers: { type: [Object, String], default: () => ({}) },
  checked: { type: [Boolean, Object, Array], default: false },
  locked: { type: [Boolean, Object, Array], default: false }
});
const emit = defineEmits(['answer']);
</script>

<template>
  <div
    class="options-container-apple"
    role="radiogroup"
    :aria-label="question.prompt || question.transcript"
  >
    <button
      v-for="option in question.options"
      :key="option.id"
      type="button"
      class="option-item-apple"
      :class="optionState(question, answers, checked, locked, option.id)"
      :disabled="optionState(question, answers, checked, locked, option.id).includes('locked')"
      :data-option="option.id"
      @click="emit('answer', question.id, option.id)"
    >
      <span class="option-letter-apple">{{ option.label || option.id }}</span>
      <span class="option-text-apple">{{ option.text }}</span>
    </button>
  </div>
</template>
