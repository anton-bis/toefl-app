<script setup>
import { ref } from 'vue';
import { isAnswered, isCorrectAnswer } from '../shared/model.js';
import ChoiceList from '../shared/ChoiceList.vue';
import AudioSegment from '../sections/listening/AudioSegment.vue';

const root = ref(null);
const props = defineProps({
  document: { type: Object, required: true },
  section: { type: String, required: true },
  modules: { type: Array, required: true },
  answers: { type: Object, required: true },
  volume: { type: Number, default: 0.8 }
});

function answerLabel(question, value) {
  if (!isAnswered(value)) return 'No answer submitted';
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(item => {
      const option = question.options?.find(candidate => candidate.id === item);
      return option ? `${option.label || option.id}. ${option.text}` : String(item);
    })
    .join(', ');
}

function shortPrompt(section, task, question) {
  if (section === 'listening' && task.type === 'listen-response')
    return question.transcript || question.prompt || `Question ${question.number}`;
  return question.prompt || question.transcript || `Question ${question.number}`;
}

function hasTaskSource(section, task) {
  if (section === 'reading') return Boolean(task.passage);
  return task.type !== 'listen-response' && Boolean(task.transcript || task.media?.file);
}

function moduleQuestions(examModule) {
  return (examModule.tasks || []).flatMap(task =>
    (task.questions || []).map(question => ({ question, task, moduleId: examModule.id }))
  );
}

function questionState(question) {
  const answer = props.answers[question.id];
  if (!isAnswered(answer)) return 'unanswered';
  return isCorrectAnswer(answer, question) ? 'correct' : 'incorrect';
}

function stateLabel(question) {
  const state = questionState(question);
  if (state === 'correct') return 'answered correctly';
  if (state === 'incorrect') return 'answered incorrectly';
  return 'not answered';
}

function cardId(question, task, moduleId) {
  return task.type === 'complete-words'
    ? `review-card-${moduleId}-${task.id}`
    : `review-card-${question.id}`;
}

function revealCard(question, task, moduleId) {
  const element = root.value?.querySelector?.(`#${cardId(question, task, moduleId)}`);
  if (!element) return;
  element.open = true;
  element.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <div ref="root" class="results-module-list">
    <section v-for="examModule in modules" :key="examModule.id" class="results-module">
      <h2>
        <i :class="section === 'reading' ? 'fas fa-book' : 'fas fa-volume-up'" />
        {{ examModule.title }}
      </h2>

      <div class="results-question-grid" role="list" :aria-label="`${examModule.title} question status`">
        <button
          v-for="{ question, task, moduleId } in moduleQuestions(examModule)"
          :key="question.id"
          type="button"
          class="results-question-grid__cell"
          :class="`is-${questionState(question)}`"
          :aria-label="`Question ${question.number}: ${stateLabel(question)}`"
          @click="revealCard(question, task, moduleId)"
        >
          {{ question.number }}
        </button>
      </div>

      <section v-for="task in examModule.tasks" :key="task.id" class="results-task">
        <header class="results-task__header">
          <strong>{{ task.title }}</strong>
        </header>

        <details v-if="hasTaskSource(section, task)" class="results-source-card">
          <summary>
            {{ section === 'reading' ? 'View source passage' : 'View audio and transcript' }}
          </summary>
          <div class="results-source-card__body">
            <AudioSegment
              v-if="section === 'listening' && task.media?.file"
              :document="document"
              :media="task.media"
              :volume="volume"
              :play-once="false"
            />
            <p v-if="section === 'reading'" class="results-source-text">{{ task.passage }}</p>
            <p v-else-if="task.transcript" class="results-source-text">{{ task.transcript }}</p>
            <p v-else class="results-empty-copy">No transcript available.</p>
          </div>
        </details>

        <details
          v-if="task.type === 'complete-words'"
          :id="cardId(task.questions[0], task, examModule.id)"
          class="answer-review-card fill-review-card"
        >
          <summary>
            <span class="answer-review-card__number"
              >Questions {{ task.questionRange?.join('–') }}</span
            >
            <span class="answer-review-card__prompt">Review answers</span>
          </summary>
          <div class="answer-review-card__body fill-review-list">
            <div v-for="question in task.questions" :key="question.id" class="fill-review-row">
              <strong>Question {{ question.number }}</strong>
              <span class="fill-review-answer">
                <small>Your answer</small>
                {{ answerLabel(question, answers[question.id]) }}
              </span>
              <span class="fill-review-answer">
                <small>Correct answer</small>
                {{ answerLabel(question, question.answer) }}
              </span>
            </div>
          </div>
        </details>

        <details
          v-for="question in task.type === 'complete-words' ? [] : task.questions"
          :id="cardId(question, task, examModule.id)"
          :key="question.id"
          class="answer-review-card"
        >
          <summary>
            <span class="answer-review-card__number">Question {{ question.number }}</span>
            <span class="answer-review-card__prompt">{{
              shortPrompt(section, task, question)
            }}</span>
          </summary>
          <div class="answer-review-card__body">
            <div
              v-if="section === 'listening' && task.type === 'listen-response'"
              class="answer-review-card__media"
            >
              <AudioSegment
                v-if="question.media?.file"
                :document="document"
                :media="question.media"
                :volume="volume"
                :play-once="false"
              />
            </div>
            <ChoiceList
              v-if="question.options?.length"
              :question="question"
              :answers="answers"
              :checked="true"
              :locked="true"
            />
            <dl
              class="answer-review-card__answers"
              :class="{ 'answer-review-card__answers--compact': question.options?.length }"
            >
              <div>
                <dt>Your answer</dt>
                <dd>{{ answerLabel(question, answers[question.id]) }}</dd>
              </div>
              <div>
                <dt>Correct answer</dt>
                <dd>{{ answerLabel(question, question.answer) }}</dd>
              </div>
            </dl>
          </div>
        </details>
      </section>
    </section>
  </div>
</template>
