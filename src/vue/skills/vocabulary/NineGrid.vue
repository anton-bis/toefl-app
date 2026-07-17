<script setup>
import { computed } from 'vue';
import SkillPageHeader from '../../components/SkillPageHeader.vue';
const props = defineProps({ store: { type: Object, required: true } });
const pages = computed(() => {
  const result = [];
  for (let i = 0; i < props.store.words.length; i += 9)
    result.push(props.store.words.slice(i, i + 9));
  return result;
});
const marked = computed(
  () => props.store.words.filter(word => word.gridStatus === 'unknown').length
);
</script>

<template>
  <SkillPageHeader
    :title="`${store.subjectLabel} · Set ${store.setId}`"
    eyebrow="Quick Check"
    back-label="Back to Sets"
    compact
    @back="store.goToSetList"
  >
    <template #actions>
      <span class="grid-page">{{ store.nineGridPage + 1 }}/{{ pages.length }}</span>
    </template>
  </SkillPageHeader>
  <div class="vocab-nine-grid skill-content">
    <div class="grid-container">
      <button
        v-for="word in pages[store.nineGridPage] || []"
        :key="word.id"
        class="grid-cell skill-card"
        :class="{ 'grid-cell-unknown': word.gridStatus === 'unknown' }"
        type="button"
        @click="store.toggleGridWord(word.id)"
        @dblclick="store.openDetail(word)"
      >
        <span class="grid-word">{{ word.word }}</span>
      </button>
    </div>
    <div class="grid-footer">
      <span class="grid-counter">{{ marked }} marked</span>
      <div class="grid-nav">
        <button
          v-if="store.nineGridPage"
          class="grid-nav-btn"
          type="button"
          @click="store.setGridPage(store.nineGridPage - 1)"
        >
          ‹</button
        ><button
          v-if="store.nineGridPage < pages.length - 1"
          class="grid-nav-btn"
          type="button"
          @click="store.setGridPage(store.nineGridPage + 1)"
        >
          ›
        </button>
      </div>
    </div>
    <button class="grid-assemble-btn" type="button" @click="store.assembleGrid">
      {{ marked ? 'Study Selected' : 'Study This Set' }} →
    </button>
  </div>
</template>
