<script setup>
import { computed } from 'vue';
import { resolveQuestionAsset } from '../../../platform/contentRepository.js';
import BuildSentence from './BuildSentence.vue';
import ResponseEditor from './ResponseEditor.vue';

const props = defineProps({
  document: { type: Object, default: null },
  page: { type: Object, required: true },
  task: { type: Object, default: null },
  question: { type: Object, default: null },
  answers: { type: Object, default: () => ({}) },
  checked: { type: [Boolean, Object], default: false },
  locked: { type: [Boolean, Object], default: false },
  readOnly: { type: Boolean, default: false }
});
const emit = defineEmits(['answer']);
const answer = computed(() => (props.question ? props.answers[props.question.id] : null));
function save(value) {
  if (props.question) emit('answer', props.question.id, value);
}
const professorImage = computed(() =>
  resolveQuestionAsset(props.document, props.question?.professorImage)
);
function studentImage(student) {
  return resolveQuestionAsset(props.document, student?.image);
}
</script>

<template>
  <BuildSentence
    v-if="question?.type === 'build-sentence'"
    :document="document"
    :question="question"
    :answer="answer"
    :checked="checked"
    :locked="locked"
    @answer="save"
  />
  <section
    v-else-if="question?.type === 'write-email'"
    class="writing-response email exam-content-pane"
  >
    <div
      class="prompt-card exam-scroll-region"
      role="region"
      aria-label="Writing prompt"
      tabindex="0"
    >
      <p>{{ question.identity }}</p>
      <strong>Write an email to {{ question.to }}. In your email, do the following:</strong>
      <ul>
        <li v-for="requirement in question.requirements" :key="requirement">
          {{ requirement }}
        </li>
      </ul>
      <em>Write as much as you can and in complete sentences.</em>
    </div>
    <div class="response-column">
      <h2>Your Response:</h2>
      <strong>To: {{ question.to }}</strong
      ><strong>Subject: {{ question.subject }}</strong
      ><ResponseEditor
        :model-value="answer || ''"
        :read-only="readOnly"
        @update:model-value="save"
      />
    </div>
  </section>
  <section
    v-else-if="question?.type === 'academic-discussion'"
    class="writing-response discussion exam-content-pane"
  >
    <div
      class="discussion-left exam-scroll-region"
      role="region"
      aria-label="Writing prompt"
      tabindex="0"
    >
      <p>
        Your professor is teaching a class on {{ question.subject }}. Write a post responding to the
        professor's questions.
      </p>
      <strong>In your response, you should do the following:</strong>
      <ul>
        <li v-for="requirement in question.requirements" :key="requirement">
          {{ requirement }}
        </li>
      </ul>
      <div class="discussion-professor">
        <img
          v-if="professorImage"
          :src="professorImage"
          alt="Professor"
          class="discussion-avatar professor-avatar"
        />
        <span v-else class="mini-avatar professor-avatar"><i class="fas fa-user-circle" /></span>
        <strong>{{ question.instructor }}</strong>
        <p>{{ question.professor }}</p>
      </div>
    </div>
    <div class="response-column">
      <div
        class="discussion-context exam-scroll-region"
        aria-label="Student responses"
        tabindex="0"
      >
        <div v-for="student in question.students" :key="student.name" class="student">
          <img
            v-if="studentImage(student)"
            :src="studentImage(student)"
            :alt="student.name"
            class="mini-avatar"
          />
          <span v-else class="mini-avatar"><i class="fas fa-user-circle" /></span>
          <p>
            <strong>{{ student.name }}</strong
            ><br />{{ student.text }}
          </p>
        </div>
      </div>
      <ResponseEditor
        :model-value="answer || ''"
        :read-only="readOnly"
        @update:model-value="save"
      />
    </div>
  </section>
  <section v-else class="writing-intro">
    <h1>{{ task?.title || 'Writing' }}</h1>
    <p v-if="page.type === 'intro'">Follow the instructions, then begin when you are ready.</p>
  </section>
</template>

<style scoped>
.writing-response {
  display: flex;
  gap: 20px;
  max-width: 1200px;
  margin: auto;
  padding: 18px 30px;
  min-height: calc(100vh - 210px);
  box-sizing: border-box;
  color: #333;
}
.prompt-card {
  width: 35%;
  border: 1px solid #d1d1d6;
  border-radius: 12px;
  padding: 18px 24px;
  font-size: 18px;
  line-height: 1.5;
  overflow: auto;
  box-sizing: border-box;
}
.discussion-left {
  width: 35%;
  border: 1px solid #d1d1d6;
  border-radius: 12px;
  padding: 18px 24px;
  font-size: 18px;
  line-height: 1.5;
  overflow: auto;
  box-sizing: border-box;
}
.discussion-professor {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 24px;
  text-align: center;
}
.discussion-professor p {
  margin: 8px 0 0;
  text-align: left;
}
.professor-avatar {
  width: 108px;
  height: 108px;
  font-size: 48px;
  margin-bottom: 8px;
}
.prompt-card strong {
  display: block;
  margin-bottom: 12px;
}
.prompt-card em {
  display: block;
  color: #666;
  border-top: 1px solid #e5e5e7;
  padding-top: 8px;
}
.response-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.response-column h2 {
  font-size: 20px;
  margin: 0 0 10px;
}
.student {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.student p {
  margin: 0 0 10px;
  font-size: 17px;
  line-height: 1.45;
}
.mini-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #e8e8ed;
  display: grid;
  place-items: center;
  color: #aaa;
  font-size: 28px;
  flex: none;
  overflow: hidden;
}
.mini-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.writing-intro {
  text-align: center;
  padding: 80px 30px;
}
@media (max-width: 760px) {
  .writing-response {
    flex-direction: column;
  }
  .prompt-card {
    width: 100%;
    max-height: 40vh;
  }
}
@media (min-width: 801px) {
  .response-column {
    min-height: 0;
  }
  .discussion-context {
    max-height: 40%;
  }
}
</style>
