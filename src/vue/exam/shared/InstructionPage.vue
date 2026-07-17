<script setup>
import { computed } from 'vue';
import { introDirections, startDirections } from './directions.js';

const props = defineProps({
  document: { type: Object, required: true },
  page: { type: Object, required: true },
  task: { type: Object, default: null }
});
defineEmits(['begin', 'help', 'volume']);

const isStart = computed(() => props.page.type === 'start');
const startCopy = computed(() => startDirections(props.document.section));
const introCopy = computed(() => introDirections(props.document.section, props.page, props.task));
const title = computed(() => {
  if (!isStart.value) return props.page.title || `Module ${props.page.moduleNumber || ''}`;
  const section = String(props.document.section || '');
  return props.page.title || `${section.charAt(0).toUpperCase()}${section.slice(1)} Section`;
});
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
          <span>Volume</span><i class="fas fa-volume-up" />
        </button>
        <button class="exam-nav-button exam-nav-button--dark" type="button" @click="$emit('help')">
          <span>Help</span><i class="fas fa-question-circle" />
        </button>
        <button
          class="exam-nav-button exam-nav-button--light"
          type="button"
          @click="$emit('begin')"
        >
          <span>Begin</span><i class="fas fa-arrow-right" />
        </button>
      </nav>
    </header>
    <main class="exam-introduction">
      <div class="exam-section-kicker">{{ document.section }}</div>
      <h1>{{ title }}</h1>
      <div class="exam-title-underline" />
      <template v-if="isStart">
        <p v-if="page.description || document.description || startCopy.description">
          {{ page.description || document.description || startCopy.description }}
        </p>
        <div v-if="page.instructions" class="exam-instructions">{{ page.instructions }}</div>
        <table v-if="startCopy.tasks?.length" class="exam-directions-table">
          <thead>
            <tr>
              <th>Type of Task</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in startCopy.tasks" :key="item[0]">
              <td>{{ item[0] }}</td>
              <td>{{ item[1] }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="startCopy.note" class="exam-direction-note">{{ startCopy.note }}</p>
      </template>
      <template v-else>
        <div v-if="page.instructions" class="exam-instructions">{{ page.instructions }}</div>
        <div v-else-if="introCopy.length" class="exam-instructions">
          <p v-for="line in introCopy" :key="line">{{ line }}</p>
        </div>
        <p v-else-if="page.description">{{ page.description }}</p>
      </template>
    </main>
  </div>
</template>
