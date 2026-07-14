<script setup>
import { DIFFICULTIES, DIFFICULTY_CONFIG, estimateLabel } from './logic.js';

defineProps({
  articles: { type: Array, required: true },
  collapsed: { type: Object, required: true }
});
defineEmits(['select', 'toggle']);
</script>

<template>
  <div class="typing-article-list">
    <section
      v-for="difficulty in DIFFICULTIES"
      :key="difficulty"
      class="typing-difficulty-section"
      :style="{ borderLeftColor: DIFFICULTY_CONFIG[difficulty].color }"
    >
      <template v-if="articles.some(article => article.difficulty === difficulty)">
        <button class="typing-section-header" type="button" @click="$emit('toggle', difficulty)">
          <span class="typing-collapse-icon">{{ collapsed[difficulty] ? '▶' : '▼' }}</span>
          <span class="typing-section-title">{{ DIFFICULTY_CONFIG[difficulty].label }}</span>
          <span
            class="typing-section-dot"
            :style="{ background: DIFFICULTY_CONFIG[difficulty].color }"
          ></span>
          <span class="typing-section-count">
            {{ articles.filter(article => article.difficulty === difficulty).length }} articles
          </span>
        </button>
        <div class="typing-section-body" :class="{ collapsed: collapsed[difficulty] }">
          <div class="typing-section-desc">{{ DIFFICULTY_CONFIG[difficulty].desc }}</div>
          <div class="typing-card-grid">
            <button
              v-for="article in articles.filter(item => item.difficulty === difficulty)"
              :key="article.id"
              type="button"
              class="typing-article-card"
              @click="$emit('select', article)"
            >
              <span class="typing-card-title">
                <span
                  class="typing-card-dot"
                  :style="{ background: DIFFICULTY_CONFIG[difficulty].color }"
                ></span>
                {{ article.title }}
              </span>
              <span class="typing-card-meta"
                >{{ article.wordCount }} words · ~{{ estimateLabel(article) }}</span
              >
            </button>
          </div>
        </div>
      </template>
    </section>
    <div v-if="!articles.length" class="typing-empty">
      <p>No articles available. Please add practice passages.</p>
    </div>
  </div>
</template>
