<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { selectedAnswer } from '../../shared/choice.js';
import { fillTokens } from './helpers.js';

const props = defineProps({
  task: { type: Object, required: true },
  answers: { type: Object, default: () => ({}) },
  locked: { type: [Boolean, Object, Array], default: false }
});
const emit = defineEmits(['answer']);
const inputs = ref({});
const tokens = computed(() =>
  fillTokens(props.task.passage || props.task.questions?.[0]?.prompt, props.task.questions || [])
);
function isLocked(questionId) {
  if (props.locked === true) return true;
  if (Array.isArray(props.locked)) return props.locked.includes(questionId);
  return Boolean(props.locked?.[questionId]);
}

function stateFor(question) {
  return isLocked(question.id) ? 'locked' : '';
}

function syncAnswers() {
  for (const token of tokens.value.filter(item => item.type === 'blank' && item.question)) {
    const saved = String(selectedAnswer(props.answers, token.question.id));
    const suffix = saved.toLowerCase().startsWith(token.prefix.toLowerCase())
      ? saved.slice(token.prefix.length)
      : saved;
    inputs.value[token.question.id] = Array.from(
      { length: token.length },
      (_, index) => suffix[index] || ''
    );
  }
}
watch([tokens, () => props.answers], syncAnswers, { immediate: true, deep: true });

async function update(token, index, event) {
  const value = event.target.value.replace(/[^a-z]/gi, '').slice(-1);
  inputs.value[token.question.id][index] = value;
  event.target.value = value;
  emit('answer', token.question.id, token.prefix + inputs.value[token.question.id].join(''));
  if (value) {
    await nextTick();
    event.target.nextElementSibling?.focus();
  }
}

function onKeydown(token, index, event) {
  if (event.key === 'Backspace' && !inputs.value[token.question.id][index])
    event.target.previousElementSibling?.focus();
  if (event.key === 'ArrowLeft') event.target.previousElementSibling?.focus();
  if (event.key === 'ArrowRight') event.target.nextElementSibling?.focus();
}

function paste(token, event) {
  event.preventDefault();
  const letters = event.clipboardData
    .getData('text')
    .replace(/[^a-z]/gi, '')
    .slice(0, token.length)
    .split('');
  inputs.value[token.question.id] = Array.from(
    { length: token.length },
    (_, index) => letters[index] || ''
  );
  emit('answer', token.question.id, token.prefix + inputs.value[token.question.id].join(''));
}
</script>

<template>
  <section id="question-module" class="complete-words-page">
    <p class="question-instruction">Fill in the missing letters</p>
    <div
      class="question-paragraph exam-scroll-region"
      aria-label="Fill in the missing letters passage"
      tabindex="0"
    >
      <template v-for="(token, tokenIndex) in tokens" :key="tokenIndex">
        <span v-if="token.type === 'text'">{{ token.text }}</span>
        <span
          v-else-if="token.question"
          class="word-fill-container"
          :class="stateFor(token.question)"
        >
          <span class="word-prefix">{{ token.prefix }}</span>
          <span class="letter-box-container">
            <input
              v-for="(_, index) in inputs[token.question.id]"
              :key="index"
              :value="inputs[token.question.id][index]"
              class="letter-box"
              maxlength="1"
              :disabled="isLocked(token.question.id)"
              :aria-label="`Question ${token.question.number}, letter ${index + 1}`"
              @input="update(token, index, $event)"
              @keydown="onKeydown(token, index, $event)"
              @paste="paste(token, $event)"
            />
          </span>
          <span class="fill-question-number">{{ token.question.number }}</span>
        </span>
      </template>
    </div>
  </section>
</template>
