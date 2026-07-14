<script setup>
import { computed } from 'vue';
import BuildSentence from './BuildSentence.vue';
import ResponseEditor from './ResponseEditor.vue';

const props = defineProps({
  document: { type: Object, required: true },
  page: { type: Object, required: true },
  task: { type: Object, default: null },
  question: { type: Object, default: null },
  answers: { type: Object, default: () => ({}) },
  marks: { type: Object, default: () => ({}) },
  checked: { type: [Boolean, Object], default: false },
  volume: { type: Number, default: 0.8 },
  readOnly: { type: Boolean, default: false }
});
const emit = defineEmits(['answer', 'mark', 'navigate']);
const answer = computed(() => (props.question ? props.answers[props.question.id] : null));
function save(value) {
  if (props.question) emit('answer', props.question.id, value);
}
</script>

<template>
  <BuildSentence
    v-if="question?.type === 'build-sentence'"
    :question="question"
    :answer="answer"
    :checked="checked"
    @answer="save"
  />
  <section v-else-if="question?.type === 'write-email'" class="writing-response email">
    <div class="prompt-card">
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
  <section v-else-if="question?.type === 'academic-discussion'" class="writing-response discussion">
    <div class="prompt-card">
      <p>
        Your professor is teaching a class on {{ question.subject }}. Write a post responding to the
        professor's questions.
      </p>
      <strong>{{ question.instructor }}</strong>
      <p>{{ question.professor }}</p>
      <em>An effective response will contain at least 100 words.</em>
    </div>
    <div class="response-column">
      <div v-for="student in question.students" :key="student.name" class="student">
        <span class="mini-avatar"><i class="fas fa-user-circle" /></span>
        <p>
          <strong>{{ student.name }}</strong
          ><br />{{ student.text }}
        </p>
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
</style>
