<script setup>
import { computed } from 'vue';
import { playWord } from './speech.js';
const props = defineProps({ word: { type: Object, required: true } });
defineEmits(['close']);
const positions = computed(() =>
  (props.word.pos || []).map(pos => ({
    type: pos.type,
    translation: pos.translation || pos.chinese || pos.meaning || ''
  }))
);
const etymology = computed(() =>
  typeof props.word.etymology === 'string'
    ? { summary: props.word.etymology }
    : props.word.etymology || {}
);
const examples = computed(() =>
  [props.word.example, ...(props.word.altExamples || [])]
    .map((example, index) => ({
      en: example,
      cn: [props.word.example_cn, ...(props.word.altExamples_cn || [])][index]
    }))
    .filter(item => item.en)
);
</script>

<template>
  <Teleport to="body">
    <div class="vocab-detail-overlay">
      <button
        class="detail-overlay-backdrop"
        type="button"
        aria-label="Close"
        @click="$emit('close')"
      ></button>
      <div class="detail-overlay-card">
        <div class="detail-card-header">
          <button class="detail-close-btn" type="button" @click="$emit('close')">×</button>
        </div>
        <div class="detail-word">{{ word.word }}</div>
        <div class="detail-pronunciation">
          <span class="detail-ipa">US {{ word.pronunciation?.us || '' }}</span
          ><button class="detail-speak-btn" type="button" @click="playWord(word.word, 'us')">
            🔊</button
          ><span class="detail-ipa">UK {{ word.pronunciation?.uk || '' }}</span
          ><button class="detail-speak-btn" type="button" @click="playWord(word.word, 'uk')">
            🔊
          </button>
        </div>
        <template v-if="positions.length"
          ><div class="detail-separator"></div>
          <div class="detail-pos">
            <div v-for="pos in positions" :key="pos.type + pos.translation" class="detail-pos-item">
              <span class="pos-type">{{ pos.type }}.</span> {{ pos.translation }}
            </div>
          </div></template
        >
        <template v-if="word.inflections && Object.values(word.inflections).some(Boolean)"
          ><div class="detail-separator"></div>
          <div class="detail-inflections">
            <h4>Word Forms</h4>
            <div
              v-for="(value, key) in word.inflections"
              v-show="value"
              :key="key"
              class="inflection-item"
            >
              <span class="inflection-label">{{ key }}</span> {{ value }}
            </div>
          </div></template
        >
        <template v-if="Object.values(etymology).some(Boolean)"
          ><div class="detail-separator"></div>
          <div class="detail-etymology">
            <h4>Word Parts</h4>
            <div
              v-for="key in ['prefix', 'root', 'suffix']"
              v-show="etymology[key]"
              :key="key"
              class="etymology-item"
            >
              <span class="etymo-form">{{
                typeof etymology[key] === 'string' ? etymology[key] : etymology[key]?.form
              }}</span>
              <span class="etymo-type"
                >[{{ { prefix: 'Prefix', root: 'Root', suffix: 'Suffix' }[key] }}]</span
              >
              <span class="etymo-meaning">{{ etymology[key]?.meaning || '' }}</span>
            </div>
            <div class="etymology-summary">{{ etymology.summary || etymology.summary_cn }}</div>
          </div></template
        >
        <template v-if="examples.length"
          ><div class="detail-separator"></div>
          <div class="detail-example">
            <h4>Examples</h4>
            <template v-for="item in examples" :key="item.en"
              ><p class="detail-example-en">{{ item.en }}</p>
              <p v-if="item.cn" class="detail-example-cn">{{ item.cn }}</p></template
            ><span v-if="word.source" class="detail-source">{{ word.source }}</span>
          </div></template
        >
      </div>
    </div>
  </Teleport>
</template>
