<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue';
import SetList from '../skills/vocabulary/SetList.vue';
import SubjectSelect from '../skills/vocabulary/SubjectSelect.vue';
import { stopWordAudio } from '../skills/vocabulary/speech.js';
import { useVocabularyStore } from '../skills/vocabulary/store.js';
import '../skills/vocabulary/vocabulary.css';

const store = useVocabularyStore();
const DailyReminder = defineAsyncComponent(() => import('../skills/vocabulary/DailyReminder.vue'));
const LearningCard = defineAsyncComponent(() => import('../skills/vocabulary/LearningCard.vue'));
const NineGrid = defineAsyncComponent(() => import('../skills/vocabulary/NineGrid.vue'));
const WordDetail = defineAsyncComponent(() => import('../skills/vocabulary/WordDetail.vue'));
onMounted(() => store.initialize());
onBeforeUnmount(stopWordAudio);
</script>

<template>
  <main class="vocabulary-view">
    <div v-if="store.loading" class="skill-loading">正在加载单词数据…</div>
    <div v-else-if="store.error" class="skill-error">{{ store.error }}</div>
    <template v-else>
      <SubjectSelect v-if="store.page === 'subject-select'" :store="store" />
      <SetList v-else-if="store.page === 'set-list'" :store="store" />
      <NineGrid v-else-if="store.page === 'nine-grid'" :store="store" />
      <LearningCard
        v-else-if="['card-learning', 'audio-learning', 'review'].includes(store.page)"
        :store="store"
      />
      <DailyReminder v-if="store.showReminder" :store="store" />
      <WordDetail v-if="store.detailWord" :word="store.detailWord" @close="store.closeDetail" />
    </template>
  </main>
</template>
