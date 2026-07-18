<script setup>
import SkillPageHeader from '../../components/SkillPageHeader.vue';

defineProps({ store: { type: Object, required: true } });

const categoryIcon = {
  prefix: 'fa-bookmark',
  suffix: 'fa-cut',
  root: 'fa-layer-group',
  other: 'fa-ellipsis-h'
};
</script>

<template>
  <div>
    <SkillPageHeader
      :title="`${store.subjectLabel} · ${store.mode === 'root' ? 'Word Parts' : 'Sets'}`"
      eyebrow="Vocabulary"
      back-label="Back"
      compact
      @back="store.backFromSetList"
    >
      <template #actions>
        <button
          v-if="store.globalDueCount"
          class="skill-primary-button"
          type="button"
          @click="store.startGlobalReview"
        >
          Review {{ store.globalDueCount }} due
        </button>
      </template>
    </SkillPageHeader>
    <div class="vocab-set-grid skill-content" :class="{ 'root-grid': store.mode === 'root' }">
      <template v-if="store.mode === 'root' && store.rootCategory">
        <template v-for="(group, index) in store.rootGroups" :key="group.title || group.label">
          <div v-if="group.type === 'separator'" class="root-separator">{{ group.label }}</div>
          <button
            v-else
            class="root-group-card skill-card"
            type="button"
            @click="store.selectRootItem(index)"
          >
            <span class="root-group-title">{{ group.title }}</span>
            <span class="root-group-count">{{ group.words.length }} words</span>
          </button>
        </template>
      </template>
      <template v-else-if="store.mode === 'root'">
        <button
          v-for="(category, index) in store.sets"
          :key="category.id"
          class="root-category-card skill-card"
          type="button"
          @click="store.selectRootItem(index)"
        >
          <span class="root-cat-icon"><i class="fas" :class="categoryIcon[category.id]"></i></span>
          <span class="root-cat-title">{{ category.title }}</span>
          <span class="root-cat-count">{{
            category.groupCount ? `${category.groupCount} groups` : ''
          }}</span>
          <span class="root-cat-word-count">{{ category.wordCount }} words</span>
        </button>
      </template>
      <button
        v-for="(set, index) in store.mode === 'random' ? store.sets : []"
        :key="set.id"
        class="vocab-set-card skill-card"
        :class="{ completed: set.status === 'completed' }"
        type="button"
        @click="store.selectSet(index)"
      >
        <span class="set-card-name">Set {{ set.id }}</span>
        <span class="set-card-count">{{ set.wordCount }} words</span>
        <span class="set-card-icon">{{
          set.status === 'completed' ? 'Completed' : 'Start →'
        }}</span>
      </button>
    </div>
  </div>
</template>
