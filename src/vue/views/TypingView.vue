<script setup>
import { defineAsyncComponent, onMounted } from 'vue';
import ArticleList from '../skills/typing/ArticleList.vue';
import { useTypingStore } from '../skills/typing/store.js';
import '../skills/typing/typing.css';

const store = useTypingStore();
const TypingHistory = defineAsyncComponent(() => import('../skills/typing/TypingHistory.vue'));
const TypingPractice = defineAsyncComponent(() => import('../skills/typing/TypingPractice.vue'));
const TypingResult = defineAsyncComponent(() => import('../skills/typing/TypingResult.vue'));
onMounted(() => store.initialize());
</script>

<template>
  <main class="typing-view">
    <div v-if="store.loading" class="skill-loading">Loading typing articles…</div>
    <div v-else-if="store.error" class="skill-error">{{ store.error }}</div>
    <template v-else-if="store.page === 'list'">
      <div class="typing-panel-header">
        <div class="typing-panel-header-row">
          <div class="typing-panel-header-titles">
            <h1 class="typing-panel-title">English Typing Practice</h1>
            <p class="typing-panel-subtitle">
              Choose an article, time your typing, and improve your speed and accuracy. Typing like
              a pro ~
            </p>
          </div>
          <button class="typing-history-link" type="button" @click="store.page = 'progress'">
            History →
          </button>
        </div>
      </div>
      <ArticleList
        :articles="store.articles"
        :collapsed="store.collapsed"
        @select="store.startArticle"
        @toggle="store.toggleDifficulty"
      />
    </template>
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
