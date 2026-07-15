<script setup>
import { computed, ref, watch } from 'vue';
import { examQuestions, isAnswered, questionPageId } from './model.js';
import { resolveQuestionAsset } from '../../platform/contentRepository.js';

const props = defineProps({
  open: Boolean,
  document: { type: Object, default: () => ({}) },
  answers: { type: Object, default: () => ({}) },
  marks: { type: Object, default: () => ({}) },
  page: { type: Object, default: () => ({}) },
  section: { type: String, default: '' },
  task: { type: Object, default: null },
  question: { type: Object, default: null },
  sourcePath: { type: String, default: '' }
});
const emit = defineEmits(['close', 'select', 'mark-all', 'clear-marks']);
const selectedId = ref('');
const questions = computed(() => examQuestions(props.document));
const answeredCount = computed(
  () => questions.value.filter(question => isAnswered(props.answers[question.id])).length
);
const markedCount = computed(
  () => questions.value.filter(question => props.marks[question.id]).length
);
const progress = computed(() =>
  questions.value.length ? Math.round((answeredCount.value / questions.value.length) * 100) : 0
);
const responseText = computed(() =>
  props.question ? String(props.answers[props.question.id] || '') : ''
);
const responseWords = computed(() =>
  responseText.value.trim() ? responseText.value.trim().split(/\s+/u).length : 0
);
const transcript = computed(
  () => props.question?.transcript || props.task?.transcript || props.question?.prompt || ''
);
const reviewAudio = computed(() => {
  const filename = props.question?.media?.file || props.task?.media?.file;
  return resolveQuestionAsset(props.sourcePath, filename);
});

watch(
  () => [props.open, props.page?.id],
  ([open]) => {
    if (open)
      selectedId.value = props.page?.questionId || props.page?.id || questions.value[0]?.id || '';
  }
);

function jump() {
  const question = questions.value.find(item => item.id === selectedId.value);
  if (question) emit('select', questionPageId(question), question);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="exam-overlay" @click.self="$emit('close')">
      <aside class="review-drawer" role="dialog" aria-modal="true" aria-label="Review Questions">
        <header class="review-drawer__header">
          <h3><i class="fas fa-list-check" aria-hidden="true" /> Review Questions</h3>
          <button class="exam-icon-button" type="button" aria-label="Close" @click="$emit('close')">
            <i class="fas fa-times" />
          </button>
        </header>
        <div class="review-stats">
          <span
            ><b>{{ questions.length }}</b> Total</span
          >
          <span
            ><b class="is-answered">{{ answeredCount }}</b> Answered</span
          >
          <span
            ><b class="is-marked">{{ markedCount }}</b> Marked</span
          >
          <span
            ><b>{{ progress }}%</b> Progress</span
          >
        </div>
        <section v-if="['listening', 'speaking'].includes(section)" class="review-context">
          <p>{{ transcript }}</p>
          <audio v-if="reviewAudio" :src="reviewAudio" controls />
        </section>
        <section
          v-else-if="section === 'writing' && question?.type !== 'build-sentence'"
          class="review-context"
        >
          <strong>Your Response</strong>
          <p class="review-written-response">{{ responseText || 'No response provided.' }}</p>
          <small>{{ responseWords }} words · {{ responseText.length }} characters</small>
        </section>
        <div class="review-list" role="listbox">
          <button
            v-for="(question, index) in questions"
            :key="question.id"
            class="review-question"
            :class="{
              selected: selectedId === question.id,
              answered: isAnswered(answers[question.id]),
              marked: marks[question.id]
            }"
            type="button"
            @click="selectedId = question.id"
            @dblclick="jump"
          >
            <span class="review-question__number">{{ index + 1 }}</span>
            <span class="review-question__label">{{
              question.title || question.prompt || `Question ${index + 1}`
            }}</span>
            <i v-if="marks[question.id]" class="fas fa-flag" aria-label="Marked" />
          </button>
        </div>
        <footer class="review-drawer__actions">
          <button
            class="exam-secondary-button"
            type="button"
            @click="
              $emit(
                'mark-all',
                questions.map(question => question.id)
              )
            "
          >
            Mark All
          </button>
          <button
            class="exam-secondary-button"
            type="button"
            @click="
              $emit(
                'clear-marks',
                questions.map(question => question.id)
              )
            "
          >
            Clear Marks
          </button>
          <button class="exam-primary-button" type="button" :disabled="!selectedId" @click="jump">
            Jump to Question
          </button>
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
