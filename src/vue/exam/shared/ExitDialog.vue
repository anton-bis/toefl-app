<script setup>
import ExamDialog from './ExamDialog.vue';
defineProps({ open: Boolean });
defineEmits(['close', 'save', 'clear']);
</script>

<template>
  <ExamDialog :open="open" title="Exit Test" icon="fas fa-sign-out-alt" @close="$emit('close')">
    <p>Your progress has been saved.<br />Would you like to keep it or clear all data?</p>
    <template #actions>
      <button class="exam-danger-button" type="button" @click="$emit('clear')">
        Clear &amp; Exit
      </button>
      <button class="exam-primary-button" type="button" @click="$emit('save')">
        Save &amp; Exit
      </button>
    </template>
  </ExamDialog>
</template>
