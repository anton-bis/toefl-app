<script setup>
defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: Number, default: 0.8 }
});
defineEmits(['update:modelValue', 'close']);
</script>

<template>
  <div v-if="open" class="exam-volume" @click.stop>
    <i class="fas fa-volume-up" aria-hidden="true" />
    <input
      type="range"
      min="0"
      max="100"
      :value="Math.round(modelValue * 100)"
      aria-label="Volume"
      @input="$emit('update:modelValue', Number($event.target.value) / 100)"
    />
    <span>{{ Math.round(modelValue * 100) }}%</span>
    <button
      class="exam-icon-button"
      type="button"
      aria-label="Close volume"
      @click="$emit('close')"
    >
      <i class="fas fa-times" aria-hidden="true" />
    </button>
  </div>
</template>
