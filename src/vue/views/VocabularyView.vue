<script setup>
import { defineAsyncComponent, onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SkillPageHeader from '../components/SkillPageHeader.vue';
import SetList from '../skills/vocabulary/SetList.vue';
import SubjectSelect from '../skills/vocabulary/SubjectSelect.vue';
import { stopWordAudio } from '../skills/vocabulary/speech.js';
import { useVocabularyStore } from '../skills/vocabulary/store.js';
import '../skills/vocabulary/vocabulary.css';

const store = useVocabularyStore();
const router = useRouter();
const DailyReminder = defineAsyncComponent(() => import('../skills/vocabulary/DailyReminder.vue'));
const LearningCard = defineAsyncComponent(() => import('../skills/vocabulary/LearningCard.vue'));
const NineGrid = defineAsyncComponent(() => import('../skills/vocabulary/NineGrid.vue'));
const WordDetail = defineAsyncComponent(() => import('../skills/vocabulary/WordDetail.vue'));
onMounted(() => store.initialize());
onBeforeUnmount(stopWordAudio);
const goHome = () => router.push({ name: 'home' });
</script>

<template>
  <main class="vocabulary-view skill-workspace">
    <SkillPageHeader
      v-if="store.loading || store.error || store.page === 'subject-select'"
      title="Vocabulary Practice"
      subtitle="Build TOEFL vocabulary and strengthen recall with spaced review."
      back-label="Home"
      @back="goHome"
    >
      <template v-if="!store.loading && !store.error" #actions>
        <div class="vocab-mode-toggle" role="group" aria-label="Study mode">
          <button
            type="button"
            :class="{ active: store.mode === 'random' }"
            :aria-pressed="store.mode === 'random'"
            @click="store.setMode('random')"
          >
            Sets
          </button>
          <button
            type="button"
            :class="{ active: store.mode === 'root' }"
            :aria-pressed="store.mode === 'root'"
            @click="store.setMode('root')"
          >
            Word Parts
          </button>
        </div>
      </template>
    </SkillPageHeader>
    <div v-if="store.loading" class="skill-loading">Loading vocabulary…</div>
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
