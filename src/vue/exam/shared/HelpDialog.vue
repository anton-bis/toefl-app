<script setup>
import { computed } from 'vue';
import ExamDialog from './ExamDialog.vue';
import { helpCopy } from './directions.js';
const props = defineProps({
  open: Boolean,
  title: { type: String, default: 'Help' },
  section: { type: String, default: '' },
  page: { type: Object, default: () => ({}) },
  task: { type: Object, default: () => ({}) }
});
defineEmits(['close']);
const content = computed(() => helpCopy(props.section, props.page, props.task));
</script>

<template>
  <ExamDialog :open="open" :title="title" icon="fas fa-question-circle" @close="$emit('close')">
    <slot
      ><p class="exam-help-copy">{{ content }}</p></slot
    >
  </ExamDialog>
</template>

<style scoped>
.exam-help-copy {
  margin: 0;
  white-space: pre-line;
}
</style>
