<script setup>
import { ref } from 'vue';
import { renderSentence, solveAnswerOrder } from '../sections/writing/writingLogic.js';
import { isAnswered, isCorrectAnswer } from '../shared/model.js';

const props = defineProps({
  tasks: { type: Array, required: true },
  answers: { type: Object, required: true }
});

const root = ref(null);

function sentenceAnswer(question, answers) {
  const answer = answers[question.id];
  const slots = Array.isArray(answer) ? answer : answer?.slots;
  if (!Array.isArray(slots)) return 'No response provided.';
  const values = slots.map(index => question.candidates?.[index] || '');
  return formatSentence(renderSentence(question.prompt, values));
}

const expectedSentence = question =>
  question.answer || formatSentence(renderSentence(question.prompt, solveAnswerOrder(question)));

function formatSentence(value) {
  const sentence = String(value || '').replace(/\s+([,.;:!?])/g, '$1');
  return sentence ? sentence.charAt(0).toUpperCase() + sentence.slice(1) : sentence;
}

function buildSentenceQuestions() {
  return (props.tasks || []).flatMap(group =>
    (group.questions || []).filter(question => question.type === 'build-sentence')
  );
}

function questionState(question) {
  const answer = props.answers[question.id];
  if (!isAnswered(answer)) return 'unanswered';
  return isCorrectAnswer(answer, question) ? 'correct' : 'incorrect';
}

function stateLabel(state) {
  if (state === 'correct') return 'answered correctly';
  if (state === 'incorrect') return 'answered incorrectly';
  return 'not answered';
}

function revealCard(question) {
  const element = root.value?.querySelector?.(`#review-card-${question.id}`);
  if (!element) return;
  element.open = true;
  element.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <div ref="root" class="results-section-list">
    <div
      v-if="buildSentenceQuestions().length"
      class="results-question-grid"
      role="list"
      aria-label="Build a Sentence question status"
    >
      <button
        v-for="question in buildSentenceQuestions()"
        :key="question.id"
        type="button"
        class="results-question-grid__cell"
        :class="`is-${questionState(question)}`"
        :aria-label="`Question ${question.number}: ${stateLabel(questionState(question))}`"
        @click="revealCard(question)"
      >
        {{ question.number }}
      </button>
    </div>
    <section v-for="group in tasks" :key="group.id" class="results-detail-card results-task">
      <header>
        <strong>{{
          group.type === 'academic-discussion' ? 'Academic Discussion' : group.title
        }}</strong>
      </header>

      <details
        v-for="question in group.questions"
        :id="`review-card-${question.id}`"
        :key="question.id"
        class="answer-review-card"
      >
        <summary>
          <span class="answer-review-card__number">Question {{ question.number }}</span>
          <span class="answer-review-card__prompt">
            {{
              question.type === 'build-sentence'
                ? question.speakerA || question.prompt
                : group.title
            }}
          </span>
        </summary>
        <div class="answer-review-card__body">
          <template v-if="question.type === 'build-sentence'">
            <p v-if="question.speakerA" class="answer-review-card__question">
              {{ question.prompt }}
            </p>
            <dl class="answer-review-card__answers">
              <div>
                <dt>Your answer</dt>
                <dd>{{ sentenceAnswer(question, answers) }}</dd>
              </div>
              <div>
                <dt>Correct answer</dt>
                <dd>{{ expectedSentence(question) }}</dd>
              </div>
            </dl>
          </template>
          <template v-else-if="question.type === 'write-email'">
            <div class="writing-review-prompt">
              <p>{{ question.identity }}</p>
              <strong>Write an email to {{ question.to }}. In your email:</strong>
              <ul>
                <li v-for="requirement in question.requirements" :key="requirement">
                  {{ requirement }}
                </li>
              </ul>
              <p><strong>Subject:</strong> {{ question.subject }}</p>
            </div>
            <div class="results-written-response">
              {{ answers[question.id] || 'No response provided.' }}
            </div>
          </template>
          <template v-else>
            <div class="writing-review-prompt">
              <p>Your professor is teaching a class on {{ question.subject }}.</p>
              <p>
                <strong>{{ question.instructor }}:</strong> {{ question.professor }}
              </p>
              <div v-for="student in question.students" :key="student.name">
                <strong>{{ student.name }}:</strong> {{ student.text }}
              </div>
            </div>
            <div class="results-written-response">
              {{ answers[question.id] || 'No response provided.' }}
            </div>
          </template>
        </div>
      </details>
    </section>
  </div>
</template>
