<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import SkillPageHeader from '../../components/SkillPageHeader.vue';
import { makeOptions, wordMeaning } from './logic.js';
import { playWord, stopWordAudio } from './speech.js';

const props = defineProps({ store: { type: Object, required: true } });
const answered = ref(false);
const selected = ref('');
const spelling = ref('');
const sentenceIndex = ref(0);
const word = computed(() => props.store.currentWord);
const quizType = computed(() => props.store.currentQuizType || 'lookup-zh');
const headerTitle = computed(() => {
  if (props.store.page === 'review') return `Review · ${props.store.subjectLabel}`;
  if (props.store.mode === 'root')
    return `${props.store.subjectLabel} · ${props.store.rootGroupTitle || 'Word Parts'}`;
  return `${props.store.subjectLabel} · Set ${props.store.setId}`;
});
const options = ref([]);
const examples = computed(() =>
  [word.value?.example, ...(word.value?.altExamples || [])].filter(Boolean)
);
const currentSentence = computed(
  () => examples.value[sentenceIndex.value % Math.max(1, examples.value.length)] || ''
);
const sentenceParts = computed(() => {
  const target = word.value?.word || '';
  const match = currentSentence.value.match(
    new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  );
  return match
    ? [
      currentSentence.value.slice(0, match.index),
      currentSentence.value.slice(match.index + match[0].length)
    ]
    : ['', currentSentence.value];
});

function prepare() {
  answered.value = false;
  selected.value = '';
  spelling.value = '';
  sentenceIndex.value = 0;
  if (!word.value) {
    options.value = [];
    return;
  }
  const mode = quizType.value === 'lookup-zh' || quizType.value === 'audio-zh' ? 'meaning' : 'word';
  options.value = makeOptions(
    word.value,
    props.store.queue,
    props.store.wordData[props.store.subject] || [],
    mode
  );
  if (quizType.value === 'spell')
    nextTick(() => document.querySelector('.spell-input-inline')?.focus());
}
watch(() => [word.value?.id, quizType.value], prepare, { immediate: true });

function answer(option) {
  if (answered.value) return;
  selected.value = option.id;
  answered.value = true;
}
function submitSpelling() {
  if (!answered.value) answered.value = true;
}
const spellingCorrect = computed(
  () => spelling.value.trim().toLowerCase() === word.value?.word?.toLowerCase()
);
watch(spellingCorrect, correct => {
  if (correct && spelling.value) submitSpelling();
});
onBeforeUnmount(stopWordAudio);
</script>

<template>
  <SkillPageHeader
    v-if="word"
    :title="headerTitle"
    eyebrow="Vocabulary"
    back-label="Back to List"
    compact
    @back="store.backFromLearning"
  >
    <template #actions>
      <span class="learn-progress">{{ store.currentIndex + 1 }}/{{ store.queueLength }}</span>
    </template>
  </SkillPageHeader>
  <div v-if="word" :class="quizType === 'audio-zh' ? 'vocab-audio-learn' : 'vocab-card-learning'">
    <div v-if="quizType === 'audio-zh'" class="audio-play-area">
      <button
        class="audio-play-btn"
        type="button"
        @click="playWord(word.word, store.preferredAccent)"
      >
        ▶
      </button>
      <div class="audio-word-label">Play the word</div>
      <div class="accent-switch">
        <button
          type="button"
          :class="{ active: store.preferredAccent === 'us' }"
          @click="store.setAccent('us')"
        >
          US</button
        ><button
          type="button"
          :class="{ active: store.preferredAccent === 'uk' }"
          @click="store.setAccent('uk')"
        >
          UK
        </button>
      </div>
    </div>

    <div class="vocab-card">
      <template v-if="quizType === 'lookup-zh'">
        <div class="card-word-display">
          {{ word.word }}
        </div>
        <div v-if="word.pronunciation?.us" class="card-pronunciation">
          <span class="card-ipa">{{ word.pronunciation.us }}</span>
        </div>
      </template>
      <template v-else-if="quizType === 'lookup-en'">
        <div class="card-hint">
          <span class="card-pos">{{ word.pos?.[0]?.type }}</span
          ><span class="card-meaning">{{ wordMeaning(word) }}</span>
        </div>
      </template>
      <template v-if="quizType !== 'spell'">
        <div :class="quizType === 'audio-zh' ? 'audio-options' : 'card-options'">
          <button
            v-for="option in options"
            :key="option.id"
            type="button"
            :class="[
              quizType === 'audio-zh' ? 'audio-option' : 'card-option',
              {
                correct: answered && option.correct,
                wrong: answered && selected === option.id && !option.correct
              }
            ]"
            :disabled="answered"
            @click="answer(option)"
          >
            {{ option.text }}
          </button>
        </div>
      </template>
      <template v-else>
        <div class="spell-hints">
          <span class="spell-pos">{{ word.pos?.[0]?.type }}.</span
          ><span class="spell-meaning">{{ wordMeaning(word) }}</span
          ><button
            v-if="examples.length > 1"
            class="spell-sentence-toggle"
            type="button"
            @click="sentenceIndex = (sentenceIndex + 1) % examples.length"
          >
            Next Example
          </button>
        </div>
        <div class="spell-sentence">
          <span>{{ sentenceParts[0] }}</span
          ><input
            v-model="spelling"
            class="spell-input-inline"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :disabled="answered"
            :style="{ width: `${Math.max(word.word.length + 3, 5)}ch` }"
            @keyup.enter="submitSpelling"
          /><span>{{ sentenceParts[1] }}</span>
        </div>
        <button v-if="!answered" class="spell-confirm-btn" type="button" @click="submitSpelling">
          Check
        </button>
        <div v-else-if="!spellingCorrect" class="spell-result">
          <div class="spell-answer-label">Answer</div>
          <div class="spell-answer-letters">
            <span
              v-for="(letter, index) in word.word"
              :key="index"
              class="spell-letter"
              :class="
                spelling[index]?.toLowerCase() === letter.toLowerCase()
                  ? 'spell-letter-ok'
                  : 'spell-letter-bad'
              "
              >{{ letter }}</span
            >
          </div>
        </div>
      </template>

      <div v-if="answered" class="card-evaluation">
        <div class="eval-actions">
          <button class="eval-btn eval-btn-forgot" type="button" @click="store.evaluate(1)">
            Again</button
          ><button class="eval-btn eval-btn-hazy" type="button" @click="store.evaluate(3)">
            Hard</button
          ><button class="eval-btn eval-btn-known" type="button" @click="store.evaluate(5)">
            Got It
          </button>
        </div>
        <button class="eval-detail-btn" type="button" @click="store.openDetail(word)">
          Details
        </button>
      </div>
    </div>
  </div>
</template>
