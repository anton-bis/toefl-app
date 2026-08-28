<script setup>
import { computed } from 'vue';
import ChoiceQuestion from '../../shared/ChoiceQuestion.vue';
import { instructionFor, parseDailyPassage, parseTextChain } from './helpers.js';
import Highlighted from './Highlighted.vue';

const props = defineProps({
  task: { type: Object, required: true },
  question: { type: Object, required: true },
  answers: { type: Object, default: () => ({}) },
  locked: { type: [Boolean, Object, Array], default: false }
});
const emit = defineEmits(['answer']);
const content = computed(() => parseDailyPassage(props.task.passage, props.task.type));
const messages = computed(() => parseTextChain(props.task.passage));
const labelLines = computed(() =>
  String(content.value.body || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
);
const receiptLines = labelLines;
const vocab = computed(() => {
  const prompt = props.question?.prompt || '';
  const direct = prompt.match(/The (?:word|phrase)\s+["“']([^"”']+)/i)?.[1] || '';
  return direct || prompt.match(/["“']([^"”']+)["”']/)?.[1] || '';
});
</script>

<template>
  <section id="question-module" class="daily-reading-page">
    <p class="question-instruction">{{ instructionFor(task.type) }}</p>
    <div class="two-column-layout">
      <div
        class="left-column exam-scroll-region"
        role="region"
        aria-label="Reading passage"
        tabindex="0"
      >
        <article v-if="task.type === 'email'" class="daily-passage-card apple-email-container">
          <header class="email-header-apple">
            <div v-if="content.to"><span class="meta-label">To:</span> {{ content.to }}</div>
            <div v-if="content.from"><span class="meta-label">From:</span> {{ content.from }}</div>
            <div v-if="content.date"><span class="meta-label">Date:</span> {{ content.date }}</div>
            <div v-if="content.subject">
              <span class="meta-label">Subject:</span> {{ content.subject }}
            </div>
          </header>
          <div class="email-body-apple"><Highlighted :text="content.body" :term="vocab" /></div>
          <footer v-if="content.signature" class="email-signature-apple">
            {{ content.signature }}
          </footer>
        </article>

        <article
          v-else-if="task.type === 'text-chain'"
          class="daily-passage-card apple-textchain-container"
        >
          <div class="phone-status-bar"><strong>9:41</strong><span>● ● ●</span></div>
          <div class="textchain-messages-area">
            <div
              v-for="(message, index) in messages"
              :key="index"
              class="message-bubble"
              :class="index % 2 ? 'sent' : 'received'"
            >
              <div class="message-header">
                <strong>{{ message.sender }}</strong
                ><span>{{ message.time }}</span>
              </div>
              <div class="message-text"><Highlighted :text="message.text" :term="vocab" /></div>
            </div>
          </div>
        </article>

        <article
          v-else-if="task.type === 'social-media'"
          class="daily-passage-card apple-social-container"
        >
          <div class="phone-status-bar"><strong>9:41</strong><span>● ● ●</span></div>
          <header class="social-profile">
            <span class="profile-avatar">{{ (content.username || 'U')[0] }}</span
            ><strong>{{ content.username }}</strong>
          </header>
          <div class="social-media-content"><Highlighted :text="content.body" :term="vocab" /></div>
        </article>

        <article v-else-if="task.type === 'label'" class="daily-passage-card apple-label-container">
          <header class="label-header">
            <h2>{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle" class="label-subtitle">{{ content.subtitle }}</p>
          </header>
          <div class="label-content">
            <p v-for="(line, index) in labelLines" :key="index" class="label-line">
              <Highlighted :text="line" :term="vocab" />
            </p>
          </div>
        </article>

        <article
          v-else-if="task.type === 'receipt'"
          class="daily-passage-card apple-receipt-container"
        >
          <header class="receipt-header">
            <h2>{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle" class="receipt-subtitle">{{ content.subtitle }}</p>
          </header>
          <div class="receipt-content">
            <p v-for="(line, index) in receiptLines" :key="index" class="receipt-line">
              <Highlighted :text="line" :term="vocab" />
            </p>
          </div>
        </article>

        <article
          v-else-if="['advertisement', 'notice', 'announcement', 'poster'].includes(task.type)"
          class="daily-passage-card apple-noticeboard-container"
          :class="task.type"
        >
          <header class="noticeboard-header">
            <h2>{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle">{{ content.subtitle }}</p>
          </header>
          <div class="notice-content"><Highlighted :text="content.body" :term="vocab" /></div>
        </article>

        <article
          v-else-if="task.type === 'instructions'"
          class="daily-passage-card apple-instructions-container"
        >
          <header class="instructions-header">
            <h2>{{ content.title || task.title }}</h2>
          </header>
          <div class="instructions-content">
            <p v-for="(line, index) in labelLines" :key="index" class="instructions-line">
              <Highlighted :text="line" :term="vocab" />
            </p>
          </div>
        </article>

        <article v-else-if="task.type === 'form'" class="daily-passage-card apple-form-container">
          <header class="form-header">
            <h2>{{ content.title || task.title }}</h2>
          </header>
          <div class="form-content">
            <p v-for="(line, index) in labelLines" :key="index" class="form-line">
              <Highlighted :text="line" :term="vocab" />
            </p>
          </div>
        </article>

        <article v-else class="daily-passage-card apple-noticeboard-container">
          <header class="noticeboard-header">
            <h2>{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle">{{ content.subtitle }}</p>
          </header>
          <div class="notice-content"><Highlighted :text="content.body" :term="vocab" /></div>
        </article>
      </div>
      <div
        :key="question.id"
        class="right-column exam-scroll-region"
        role="region"
        aria-label="Question and answer choices"
        tabindex="0"
      >
        <ChoiceQuestion
          :question="question"
          :answers="answers"
          :locked="locked"
          @answer="(id, value) => emit('answer', id, value)"
        />
      </div>
    </div>
  </section>
</template>
