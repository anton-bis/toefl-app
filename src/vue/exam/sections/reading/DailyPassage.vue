<script setup>
import { computed } from 'vue';
import ChoiceQuestion from '../../shared/ChoiceQuestion.vue';
import { instructionFor, parseDailyPassage, parseTextChain } from './helpers.js';
import Highlighted from './Highlighted.vue';
import { resolveQuestionAsset } from '../../../platform/contentRepository.js';

const props = defineProps({
  task: { type: Object, required: true },
  question: { type: Object, required: true },
  document: { type: Object, default: null },
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

// For a content-card web page (no URL), split body into labelled paragraphs.
// A paragraph matching "Label: rest" renders the label in bold.
const webPageSegments = computed(() => {
  const raw = String(content.value.body || '');
  if (!raw) return [];
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const label = line.match(/^(.+?):\s*(.*)$/);
      return label && label[2] !== undefined
        ? { label: label[1].trim(), text: label[2], isLabel: true }
        : { text: line, isLabel: false };
    });
});
// Insert the chart just before the first bold label paragraph (e.g. after the
// introductory text and before "Light Sleep:"); otherwise show it at the end.
const chartInsertIndex = computed(() => {
  const index = webPageSegments.value.findIndex(segment => segment.isLabel);
  return index >= 0 ? index : -1;
});
const webChartUrl = computed(() => {
  const file = content.value.chartImage;
  return file ? resolveQuestionAsset(props.document, file) : '';
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
          v-else-if="task.type === 'sign'"
          class="daily-passage-card apple-sign-container"
        >
          <span class="sign-icon" aria-hidden="true"><i class="fas fa-circle-exclamation" /></span>
          <div class="sign-board">
            <h2 class="sign-title">{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle" class="sign-subtitle">{{ content.subtitle }}</p>
            <div class="sign-content"><Highlighted :text="content.body" :term="vocab" /></div>
          </div>
        </article>

        <article
          v-else-if="task.type === 'announcement'"
          class="daily-passage-card apple-announcement-container"
        >
          <div class="announcement-bar">
            <i class="fas fa-volume-up" aria-hidden="true" />
            <span>Announcement</span>
          </div>
          <div class="announcement-body">
            <h2 class="announcement-title">{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle" class="announcement-subtitle">{{ content.subtitle }}</p>
            <div class="announcement-content">
              <Highlighted :text="content.body" :term="vocab" />
            </div>
          </div>
        </article>

        <article
          v-else-if="task.type === 'notice'"
          class="daily-passage-card apple-notice-container"
        >
          <div class="notice-sidebar" aria-hidden="true">
            <i class="fas fa-inbox" />
          </div>
          <div class="notice-panel">
            <h2 class="notice-title">{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle" class="notice-subtitle">{{ content.subtitle }}</p>
            <div class="notice-body"><Highlighted :text="content.body" :term="vocab" /></div>
          </div>
        </article>

        <article
          v-else-if="task.type === 'advertisement'"
          class="daily-passage-card apple-advertisement-container"
        >
          <header class="advertisement-header">
            <h2 class="advertisement-title">{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle" class="advertisement-subtitle">{{ content.subtitle }}</p>
          </header>
          <div class="advertisement-content">
            <Highlighted :text="content.body" :term="vocab" />
          </div>
        </article>

        <article
          v-else-if="task.type === 'poster'"
          class="daily-passage-card apple-poster-container"
        >
          <header class="poster-header">
            <span class="poster-badge" aria-hidden="true"><i class="fas fa-scroll" /></span>
            <h2 class="poster-title">{{ content.title || task.title }}</h2>
            <p v-if="content.subtitle" class="poster-subtitle">{{ content.subtitle }}</p>
          </header>
          <div class="poster-content"><Highlighted :text="content.body" :term="vocab" /></div>
        </article>

        <article
          v-else-if="task.type === 'review'"
          class="daily-passage-card apple-review-container"
        >
          <header class="review-header">
            <span class="review-stars" aria-hidden="true">
              <i v-for="n in 5" :key="n" class="fas fa-star" />
            </span>
            <h2 class="review-title">{{ content.title || task.title }}</h2>
          </header>
          <div class="review-content"><Highlighted :text="content.body" :term="vocab" /></div>
        </article>

        <article
          v-else-if="task.type === 'web-page' && content.url"
          class="daily-passage-card apple-webpage-container"
        >
          <div class="webpage-toolbar" aria-hidden="true">
            <span class="webpage-nav-btn"><i class="fas fa-arrow-left" /></span>
            <span class="webpage-nav-btn"><i class="fas fa-rotate-right" /></span>
            <span class="webpage-url">{{ content.url }}</span>
            <span class="webpage-nav-icons">
              <i class="fas fa-user-circle" /><i class="fas fa-ellipsis-h" />
            </span>
          </div>
          <div class="webpage-body">
            <h2 class="webpage-title">{{ content.title }}</h2>
            <div class="webpage-content">
              <Highlighted :text="content.body" :term="vocab" />
            </div>
          </div>
        </article>

        <article
          v-else-if="task.type === 'web-page'"
          class="daily-passage-card apple-pagecard-container"
        >
          <div class="pagecard-body">
            <h2 class="pagecard-title">{{ content.title }}</h2>
            <template v-for="(segment, index) in webPageSegments" :key="index">
              <figure v-if="webChartUrl && index === chartInsertIndex" class="pagecard-chart">
                <img :src="webChartUrl" alt="Chart" />
              </figure>
              <p v-if="segment.isLabel" class="pagecard-label">
                <strong>{{ segment.label }}</strong
                >{{ segment.text ? `: ${segment.text}` : '' }}
              </p>
              <p v-else class="pagecard-paragraph">
                <Highlighted :text="segment.text" :term="vocab" />
              </p>
            </template>
            <figure v-if="webChartUrl && chartInsertIndex < 0" class="pagecard-chart">
              <img :src="webChartUrl" alt="Chart" />
            </figure>
          </div>
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
