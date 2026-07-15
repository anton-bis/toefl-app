<script setup>
defineProps({ store: { type: Object, required: true } });
const categoryIcon = { prefix: '🔗', suffix: '⛓', root: '🌳', other: '•••' };
</script>

<template>
  <div>
    <div class="vocab-setlist-header">
      <button class="vocab-back-btn" type="button" @click="store.backFromSetList">← 返回</button>
      <h2 class="vocab-setlist-title">
        {{ store.subjectLabel }} · {{ store.mode === 'root' ? '词根词缀' : '乱序 Set' }}
      </h2>
      <button
        v-if="store.globalDueCount"
        class="global-review-btn"
        type="button"
        @click="store.startGlobalReview"
      >
        开始复习(共{{ store.globalDueCount }}个待复习单词)
      </button>
    </div>
    <div class="vocab-set-grid" :class="{ 'root-grid': store.mode === 'root' }">
      <template v-if="store.mode === 'root' && store.rootCategory">
        <template v-for="(group, index) in store.rootGroups" :key="group.title || group.label">
          <div v-if="group.type === 'separator'" class="root-separator">{{ group.label }}</div>
          <button v-else class="root-group-card" type="button" @click="store.selectRootItem(index)">
            <span class="root-group-title">{{ group.title }}</span
            ><span class="root-group-count">{{ group.words.length }} 词</span>
          </button>
        </template>
      </template>
      <template v-else-if="store.mode === 'root'">
        <button
          v-for="(category, index) in store.sets"
          :key="category.id"
          class="root-category-card"
          type="button"
          @click="store.selectRootItem(index)"
        >
          <span class="root-cat-icon">{{ categoryIcon[category.id] }}</span
          ><span class="root-cat-title">{{ category.title }}</span
          ><span class="root-cat-count">{{
            category.groupCount ? `${category.groupCount} 组` : ''
          }}</span
          ><span class="root-cat-word-count">{{ category.wordCount }} 词</span>
        </button>
      </template>
      <button
        v-for="(set, index) in store.mode === 'random' ? store.sets : []"
        :key="set.id"
        class="vocab-set-card"
        :class="{ completed: set.status === 'completed' }"
        type="button"
        @click="store.selectSet(index)"
      >
        <span class="set-card-name">Set {{ set.id }}</span
        ><span class="set-card-count">{{ set.wordCount }} 词</span
        ><span class="set-card-icon">{{ set.status === 'completed' ? '✓' : '›' }}</span>
      </button>
    </div>
  </div>
</template>
