<script setup>
import { computed } from 'vue';
import { introDirections } from './directions.js';
const props = defineProps({
  document: { type: Object, required: true },
  page: { type: Object, required: true },
  task: { type: Object, default: null }
});
defineEmits(['begin', 'help', 'volume']);
const directions = computed(() => introDirections(props.document.section, props.page, props.task));
</script>

<template>
  <div class="exam-page">
    <header class="exam-header">
      <div class="exam-header__brand"><strong>toefl ibt</strong></div>
      <nav class="exam-header__actions">
        <button
          class="exam-nav-button exam-nav-button--dark"
          type="button"
          @click="$emit('volume')"
        >
          Volume <i class="fas fa-volume-up" />
        </button>
        <button class="exam-nav-button exam-nav-button--dark" type="button" @click="$emit('help')">
          Help <i class="fas fa-question-circle" />
        </button>
        <button
          class="exam-nav-button exam-nav-button--light"
          type="button"
          @click="$emit('begin')"
        >
          Begin <i class="fas fa-arrow-right" />
        </button>
      </nav>
    </header>
    <main class="exam-introduction">
      <div class="exam-section-kicker">{{ document.section }}</div>
      <h1>{{ page.title || `Module ${page.moduleNumber || ''}` }}</h1>
      <div class="exam-title-underline" />
      <slot>
        <div v-if="page.instructions" class="exam-instructions">{{ page.instructions }}</div>
        <div v-else-if="directions.length" class="exam-instructions">
          <p v-for="line in directions" :key="line">{{ line }}</p>
        </div>
        <p v-else-if="page.description">{{ page.description }}</p>
      </slot>
    </main>
  </div>
</template>
