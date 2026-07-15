<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
  width: { type: String, default: '520px' }
});
defineEmits(['close']);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="exam-overlay" role="presentation" @click.self="$emit('close')">
      <section
        class="exam-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        :style="{ '--dialog-width': width }"
      >
        <header class="exam-dialog__header">
          <h3><i v-if="icon" :class="icon" aria-hidden="true" /> {{ title }}</h3>
          <button class="exam-icon-button" type="button" aria-label="Close" @click="$emit('close')">
            <i class="fas fa-times" aria-hidden="true" />
          </button>
        </header>
        <div class="exam-dialog__body"><slot /></div>
        <footer v-if="$slots.actions" class="exam-dialog__actions"><slot name="actions" /></footer>
      </section>
    </div>
  </Teleport>
</template>
