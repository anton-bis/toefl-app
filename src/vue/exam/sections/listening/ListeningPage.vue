<script setup>
import { computed } from 'vue';
import { resolveQuestionAsset } from '../../../platform/contentRepository.js';
import AudioSegment from './AudioSegment.vue';
import ChoiceQuestion from '../../shared/ChoiceQuestion.vue';

const props = defineProps({
  document: { type: Object, required: true },
  page: { type: Object, required: true },
  task: { type: Object, required: true },
  question: { type: Object, default: null },
  answers: { type: Object, default: () => ({}) },
  checked: { type: [Boolean, Object, Array], default: false },
  locked: { type: [Boolean, Object, Array], default: false },
  volume: { type: Number, default: 0.8 }
});
const emit = defineEmits(['answer', 'media-state']);
const isStimulus = computed(
  () =>
    ['stimulus', 'scenario'].includes(props.page.type) ||
    (!props.question && props.task.type !== 'listen-response')
);
const media = computed(() => props.question?.media || props.task.media);
const imageUrl = computed(() =>
  resolveQuestionAsset(props.document, props.question?.image || props.task?.image || props.page?.scenario?.image)
);
const title = computed(() =>
  props.task.title.replace(/\s*[–-]\s*Questions?\s+\d+[–-]\d+.*$/i, '').trim()
);
</script>

<template>
  <main class="listening-page main-content exam-content-pane" :data-page-id="page.id">
    <section
      v-if="isStimulus"
      class="listening-stimulus exam-scroll-region"
      aria-label="Listening stimulus"
      tabindex="0"
    >
      <div class="passage-title-area">
        <h2 class="passage-title">{{ title }}</h2>
      </div>
      <div class="listening-surface listening-stimulus-card">
        <div class="speaker-area">
          <img v-if="imageUrl" :src="imageUrl" alt="Stimulus Image" class="listening-visual-image" />
          <div v-else class="speaker-placeholder"><i class="fas fa-user"></i><span>♟</span></div>
          <div class="speaker-label">Speaker</div>
        </div>
        <AudioSegment
          :document="document"
          :media="task.media"
          :volume="volume"
          @media-state="emit('media-state', $event)"
        />
      </div>
    </section>

    <section
      v-else-if="task.type === 'listen-response'"
      class="listen-response-layout two-column-layout"
    >
      <div class="left-column listening-visual-panel">
        <img v-if="imageUrl" :src="imageUrl" alt="Question Visual" class="listening-visual-image" />
        <div v-else class="speaker-placeholder"><i class="fas fa-user"></i><span>♟</span></div>
        <div class="speaker-label">Speaker</div>
        <AudioSegment
          :document="document"
          :media="media"
          :volume="volume"
          @media-state="emit('media-state', $event)"
        />
      </div>
      <div
        class="right-column exam-scroll-region"
        role="region"
        aria-label="Question and answer choices"
        tabindex="0"
      >
        <ChoiceQuestion
          :question="question"
          :answers="answers"
          :checked="checked"
          :locked="locked"
          :show-prompt="false"
          @answer="(id, value) => emit('answer', id, value)"
        />
      </div>
    </section>

    <section v-else class="listening-question-layout two-column-layout">
      <div class="left-column listening-visual-panel">
        <img v-if="imageUrl" :src="imageUrl" alt="Question Visual" class="listening-visual-image" />
        <div v-else class="speaker-placeholder"><i class="fas fa-user"></i><span>♟</span></div>
        <div class="speaker-label">Speaker</div>
      </div>
      <div
        class="right-column exam-scroll-region"
        role="region"
        aria-label="Question and answer choices"
        tabindex="0"
      >
        <ChoiceQuestion
          :question="question"
          :answers="answers"
          :checked="checked"
          :locked="locked"
          @answer="(id, value) => emit('answer', id, value)"
        />
      </div>
    </section>
  </main>
</template>

<style src="./listening.css"></style>
