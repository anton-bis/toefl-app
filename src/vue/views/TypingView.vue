<script setup>
import { defineAsyncComponent, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SkillPageHeader from '../components/SkillPageHeader.vue';
import ArticleList from '../skills/typing/ArticleList.vue';
import { useTypingStore } from '../skills/typing/store.js';
import '../skills/typing/typing.css';

const store = useTypingStore();
const router = useRouter();
const TypingHistory = defineAsyncComponent(() => import('../skills/typing/TypingHistory.vue'));
const TypingPractice = defineAsyncComponent(() => import('../skills/typing/TypingPractice.vue'));
const TypingResult = defineAsyncComponent(() => import('../skills/typing/TypingResult.vue'));
onMounted(() => store.initialize());
const goHome = () => router.push({ name: 'home' });
</script>

<template>
  <main class="typing-view skill-workspace">
    <SkillPageHeader
      v-if="store.loading || store.error || store.page === 'list'"
      title="Typing Practice"
      subtitle="Build speed and accuracy with focused passage practice."
      back-label="Home"
      @back="goHome"
    >
      <template v-if="!store.loading && !store.error" #actions>
        <button class="skill-text-button" type="button" @click="store.page = 'progress'">
          View Progress →
        </button>
      </template>
    </SkillPageHeader>
    <div v-if="store.loading" class="skill-loading">Loading practice…</div>
    <div v-else-if="store.error" class="skill-error">{{ store.error }}</div>
    <ArticleList
      v-else-if="store.page === 'list'"
      :articles="store.articles"
      :collapsed="store.collapsed"
      @select="store.startArticle"
      @toggle="store.toggleDifficulty"
    />
    <TypingPractice
      v-else-if="store.page === 'typing' && store.session"
      :store="store"
      @back="store.backToList"
    />
    <TypingResult
      v-else-if="store.page === 'result' && store.result"
      :result="store.result"
      @retry="store.retry"
      @back="store.backToList"
    />
    <TypingHistory
      v-else-if="store.page === 'progress'"
      :history="store.history"
      :best="store.best"
      @back="store.page = 'list'"
    />
  </main>
</template>
