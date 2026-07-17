<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  eyebrow: { type: String, default: 'Practice' },
  backLabel: { type: String, default: 'Back' },
  compact: { type: Boolean, default: false }
});

defineEmits(['back']);
</script>

<template>
  <header class="skill-page-header" :class="{ 'skill-page-header--compact': compact }">
    <div class="skill-page-header__inner">
      <div class="skill-page-header__bar">
        <button class="skill-back-button" type="button" @click="$emit('back')">
          <span aria-hidden="true">←</span>
          <span>{{ backLabel }}</span>
        </button>
        <div v-if="$slots.actions" class="skill-page-header__actions">
          <slot name="actions" />
        </div>
      </div>
      <div class="skill-page-header__heading">
        <span v-if="eyebrow" class="skill-page-header__eyebrow">{{ eyebrow }}</span>
        <h1 class="skill-page-header__title">{{ title }}</h1>
        <p v-if="subtitle" class="skill-page-header__subtitle">{{ subtitle }}</p>
      </div>
    </div>
  </header>
</template>
