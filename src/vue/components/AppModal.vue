<script setup>
defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  wide: Boolean
});

defineEmits(['close']);
</script>

<template>
  <div class="modal-overlay" role="presentation" @mousedown.self="$emit('close')">
    <section
      class="modal-card"
      :class="{ wide }"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <header class="modal-header">
        <h3><i v-if="icon" :class="icon"></i> {{ title }}</h3>
        <button class="modal-close" type="button" aria-label="关闭" @click="$emit('close')">
          <i class="fas fa-times"></i>
        </button>
      </header>
      <div class="modal-body"><slot /></div>
      <footer v-if="$slots.footer" class="modal-footer"><slot name="footer" /></footer>
    </section>
  </div>
</template>
