<script setup>
import { computed } from 'vue';
import { startDirections } from './directions.js';
const props = defineProps({
  document: { type: Object, required: true },
  page: { type: Object, default: () => ({}) }
});
defineEmits(['begin', 'help', 'volume']);
const sectionName = computed(() => {
  const section = String(props.document.section || '');
  return props.page.title || `${section.charAt(0).toUpperCase()}${section.slice(1)} Section`;
});
const directions = computed(() => startDirections(props.document.section));
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
      <h1>{{ sectionName }}</h1>
      <div class="exam-title-underline" />
      <slot>
        <p v-if="page.description || document.description || directions.description">
          {{ page.description || document.description || directions.description }}
        </p>
        <div v-if="page.instructions" class="exam-instructions">{{ page.instructions }}</div>
        <table v-if="directions.tasks?.length" class="exam-directions-table">
          <thead>
            <tr>
              <th>Type of Task</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in directions.tasks" :key="item[0]">
              <td>{{ item[0] }}</td>
              <td>{{ item[1] }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="directions.note" class="exam-direction-note">{{ directions.note }}</p>
      </slot>
    </main>
  </div>
</template>
