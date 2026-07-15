<script setup>
import { computed } from 'vue';
import ChoiceList from '../../shared/ChoiceList.vue';
import { checkedQuestion, selectedAnswer } from '../../shared/choice.js';
import { academicMode, insertionSentence, paragraphSentences } from './helpers.js';

const props = defineProps({
  task: { type: Object, required: true },
  question: { type: Object, required: true },
  answers: { type: Object, default: () => ({}) },
  checked: { type: [Boolean, Object, Array], default: false }
});
const emit = defineEmits(['answer']);
const mode = computed(() => academicMode(props.question));
const title = computed(() => props.task.title.split(/[–—-]\s*/).at(-1));
const sentences = computed(() => paragraphSentences(props.task.passage, props.question.prompt));
const inserted = computed(() => insertionSentence(props.question.prompt));
const paragraphs = computed(() =>
  String(props.task.passage || '')
    .split(/\n\s*\n/)
    .filter(Boolean)
);
const pointParagraph = computed(() =>
  Number(props.question.prompt.match(/paragraph\s+(\d+)/i)?.[1] || 0)
);
const vocab = computed(
  () => props.question.prompt.match(/The (?:word|phrase)\s+["“']([^"”']+)/i)?.[1] || ''
);

function sentenceClass(sentence) {
  const selected = selectedAnswer(props.answers, props.question.id) === sentence;
  if (!checkedQuestion(props.checked, props.question.id)) return selected ? 'selected' : '';
  if (sentence === props.question.answer) return 'correct locked';
  return selected ? 'incorrect locked' : 'locked';
}

function highlightedParts(paragraph) {
  if (!vocab.value) return [paragraph];
  const escaped = vocab.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return paragraph.split(new RegExp(`(${escaped})`, 'gi'));
}
</script>

<template>
  <section id="question-module" class="academic-reading-page">
    <div class="passage-title-area">
      <h2 class="passage-title">{{ title }}</h2>
    </div>
    <div class="two-column-layout">
      <div class="left-column">
        <article class="academic-passage-container" aria-label="Academic passage" tabindex="0">
          <p v-for="(paragraph, index) in paragraphs" :key="index" class="academic-passage-content">
            <template v-if="mode === 'point-sentence' && pointParagraph === index + 1">
              <button
                v-for="sentence in sentences"
                :key="sentence"
                type="button"
                class="passage-sentence-hl"
                :class="sentenceClass(sentence)"
                @click="emit('answer', question.id, sentence)"
              >
                {{ sentence }}
              </button>
            </template>
            <template v-else-if="mode === 'insert-sentence'">
              <template
                v-for="(part, partIndex) in paragraph.split(/([([][A-D][)\]])/)"
                :key="partIndex"
              >
                <button
                  v-if="/^[([][A-D][)\]]$/.test(part)"
                  type="button"
                  class="insertion-marker"
                  :class="{ selected: selectedAnswer(answers, question.id) === part[1] }"
                  @click="emit('answer', question.id, part[1])"
                >
                  {{ part }}
                </button>
                <span v-else>{{ part }}</span>
              </template>
            </template>
            <template v-else>
              <template v-for="(part, partIndex) in highlightedParts(paragraph)" :key="partIndex">
                <mark v-if="vocab && part.toLowerCase() === vocab.toLowerCase()">{{ part }}</mark
                ><span v-else>{{ part }}</span>
              </template>
            </template>
          </p>
        </article>
      </div>
      <div
        class="right-column"
        role="region"
        aria-label="Question and answer choices"
        tabindex="0"
      >
        <div class="question-container-apple">
          <div class="question-text-apple">{{ question.prompt }}</div>
          <div v-if="inserted" class="insertion-sentence">{{ inserted }}</div>
          <div v-if="mode === 'point-sentence'" class="sentence-options-container">
            <button
              v-for="(sentence, index) in sentences"
              :key="sentence"
              type="button"
              class="sentence-option-row"
              :class="sentenceClass(sentence)"
              @click="emit('answer', question.id, sentence)"
            >
              <span class="sentence-number">{{ index + 1 }}</span
              ><span>{{ sentence }}</span>
            </button>
          </div>
          <ChoiceList
            v-else
            :question="question"
            :answers="answers"
            :checked="checked"
            @answer="(id, value) => emit('answer', id, value)"
          />
        </div>
      </div>
    </div>
  </section>
</template>
