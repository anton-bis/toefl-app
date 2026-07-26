<script setup>
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ExamDialog from '../exam/shared/ExamDialog.vue';
import ExamHeader from '../exam/shared/ExamHeader.vue';
import InstructionPage from '../exam/shared/InstructionPage.vue';
import { expirationCopy, readyPrompt } from '../exam/shared/directions.js';
import {
  blocksListeningHistory,
  pageDuration,
  questionDisplay,
  reportSections as completedReportSections,
  resolveExamEntry
} from '../exam/shared/flow.js';
import { examQuestions, isCorrectAnswer } from '../exam/shared/model.js';
import { useCatalogStore } from '../stores/catalog.js';
import { readExamSession, useExamStore } from '../stores/exam.js';
import { useSettingsStore } from '../stores/settings.js';
import { recordingRepository } from '../platform/dataRepository.js';
import '../exam/shared/exam-shared.css';

const props = defineProps({
  tpoId: { type: String, required: true },
  section: { type: String, required: true },
  pageId: { type: String, default: 'start' }
});

const router = useRouter();
const route = useRoute();
const catalog = useCatalogStore();
const exam = useExamStore();
const settings = useSettingsStore();
const document = shallowRef(null);
const loading = ref(true);
const error = ref('');
const questionsOpen = ref(false);
const helpOpen = ref(false);
const volumeOpen = ref(false);
const exitOpen = ref(false);
const expiredOpen = ref(false);
const readyOpen = ref(false);
const sectionBusy = ref(false);
let loadToken = 0;

onMounted(() => window.electronAPI?.setContentBusy(true));
onBeforeUnmount(() => window.electronAPI?.setContentBusy(false));

const sectionComponents = {
  reading: defineAsyncComponent(() => import('../exam/sections/reading/ReadingPage.vue')),
  listening: defineAsyncComponent(() => import('../exam/sections/listening/ListeningPage.vue')),
  writing: defineAsyncComponent(() => import('../exam/sections/writing/WritingPage.vue')),
  speaking: defineAsyncComponent(() => import('../exam/sections/speaking/SpeakingPage.vue'))
};
const ExitDialog = defineAsyncComponent(() => import('../exam/shared/ExitDialog.vue'));
const HelpDialog = defineAsyncComponent(() => import('../exam/shared/HelpDialog.vue'));
const ResultsPage = defineAsyncComponent(() => import('../exam/shared/ResultsPage.vue'));
const QuestionNavigator = defineAsyncComponent(
  () => import('../exam/shared/QuestionNavigator.vue')
);
const VolumeControl = defineAsyncComponent(() => import('../exam/shared/VolumeControl.vue'));
const normalizedSection = computed(() => props.section.toLowerCase());
const page = computed(() => document.value?.pages.find(item => item.id === props.pageId));
const module = computed(() =>
  document.value?.modules.find(item => item.id === page.value?.moduleId)
);
const task = computed(() => module.value?.tasks.find(item => item.id === page.value?.taskId));
const instructionPage = computed(() =>
  page.value?.type === 'intro'
    ? { ...page.value, title: task.value?.title || module.value?.title }
    : page.value
);
const expiredMessage = computed(() => expirationCopy(normalizedSection.value));
const readyMessage = computed(() => readyPrompt(normalizedSection.value, page.value, task.value));
const question = computed(() => {
  const id = page.value?.questionIds?.[0];
  return task.value?.questions.find(item => item.id === id) || null;
});
const questions = computed(() => examQuestions(document.value));
const moduleQuestions = computed(
  () => module.value?.tasks.flatMap(currentTask => currentTask.questions) || []
);
const questionInfo = computed(() =>
  questionDisplay({
    section: normalizedSection.value,
    page: page.value,
    task: task.value,
    moduleQuestions: moduleQuestions.value,
    questions: questions.value
  })
);
const questionNumber = computed(() => questionInfo.value.number);
const totalQuestions = computed(() => questionInfo.value.total);
const questionLabel = computed(() => questionInfo.value.label);
const scaledScore = computed(() => {
  if (!['reading', 'listening'].includes(normalizedSection.value)) return null;
  const ratios = (document.value?.modules || []).slice(0, 2).map(item => {
    const items = item.tasks.flatMap(currentTask => currentTask.questions);
    const correct = items.filter(currentQuestion =>
      isCorrectAnswer(session.value?.answers[currentQuestion.id], currentQuestion)
    ).length;
    return items.length ? correct / items.length : 0;
  });
  return Math.round(30 * ((ratios[0] || 0) * 0.4 + (ratios[1] || 0) * 0.6));
});
const session = computed(() => exam.activeSession);
const volume = computed(() => settings.volume(normalizedSection.value));
const readOnlyMode = computed(() => session.value?.status === 'completed');
const checkedState = computed(() => readOnlyMode.value);
const lockedState = computed(() => session.value?.lockedQuestionIds || {});
const contentComponent = computed(() => sectionComponents[normalizedSection.value]);
const contentProps = computed(() => {
  const common = {
    page: page.value,
    task: task.value,
    question: question.value
  };
  if (normalizedSection.value === 'speaking') {
    return {
      ...common,
      document: document.value,
      volume: volume.value,
      readOnly: readOnlyMode.value
    };
  }
  const answerProps = {
    ...common,
    answers: session.value.answers,
    checked: checkedState.value,
    locked: lockedState.value
  };
  if (normalizedSection.value === 'listening') {
    return { ...answerProps, document: document.value, volume: volume.value };
  }
  return normalizedSection.value === 'writing'
    ? { ...answerProps, readOnly: readOnlyMode.value }
    : answerProps;
});
const contentListeners = computed(() => ({
  answer: exam.saveAnswer,
  ...(normalizedSection.value === 'listening' ? { 'media-state': mediaState } : {}),
  ...(normalizedSection.value === 'speaking'
    ? { 'navigation-state': state => (sectionBusy.value = state.busy) }
    : {})
}));
const contentPageKey = computed(() =>
  normalizedSection.value === 'speaking'
    ? document.value?.id
    : normalizedSection.value === 'reading'
      ? task.value?.id
      : page.value?.id
);
const isContentPage = computed(() =>
  ['question', 'stimulus', 'scenario'].includes(page.value?.type)
);
const scopedDocument = computed(() => {
  if (!document.value || !module.value) return document.value || {};
  return { ...document.value, modules: [module.value] };
});
const questionNavigatorDocument = computed(() => {
  if (normalizedSection.value === 'reading') return scopedDocument.value;
  if (normalizedSection.value !== 'writing' || task.value?.type !== 'build-sentence') return {};
  return {
    ...document.value,
    modules: [{ ...module.value, tasks: [task.value] }]
  };
});
function adjacentPage(direction) {
  const id = page.value?.[direction];
  return id ? document.value?.pages.find(item => item.id === id) : null;
}

const canBack = computed(() => {
  if (sectionBusy.value || !page.value?.previous || page.value.type === 'scenario') return false;
  const previous = adjacentPage('previous');
  if (readOnlyMode.value) return previous?.type === 'question';
  return previous && !['intro', 'start', 'scenario'].includes(previous.type);
});
const canNext = computed(() => {
  if (!page.value?.next || sectionBusy.value) return false;
  return !readOnlyMode.value || adjacentPage('next')?.type === 'question';
});
const reportSections = computed(() => {
  if (route.query.mode !== 'report') return [];
  const test = catalog.tests.find(item => item.tpoId === props.tpoId);
  return completedReportSections(test, section => readExamSession(props.tpoId, section));
});
const reportIndex = computed(() => reportSections.value.indexOf(normalizedSection.value));
const showBack = computed(() => {
  if (normalizedSection.value === 'listening' && !readOnlyMode.value) return false;
  if (normalizedSection.value === 'writing' && task.value?.type !== 'build-sentence') return false;
  return canBack.value;
});
const showQuestions = computed(
  () =>
    !readOnlyMode.value &&
    page.value?.type === 'question' &&
    (normalizedSection.value === 'reading' ||
      (normalizedSection.value === 'writing' && task.value?.type === 'build-sentence'))
);

function routeTo(pageId, replace = false) {
  const target = {
    name: 'exam',
    params: { tpoId: props.tpoId, section: normalizedSection.value, pageId },
    query: route.query
  };
  return replace ? router.replace(target) : router.push(target);
}

const durationFor = currentPage => pageDuration(normalizedSection.value, currentPage, task.value);

const historyBlocked = (targetPage, active = session.value) =>
  blocksListeningHistory(normalizedSection.value, document.value?.pages || [], targetPage, active);

async function loadExam() {
  const token = ++loadToken;
  loading.value = true;
  error.value = '';
  try {
    const loaded = await catalog.loadDocument(props.tpoId, normalizedSection.value);
    if (token !== loadToken) return;
    document.value = loaded;
    const active = exam.openSession({
      tpoId: props.tpoId,
      section: normalizedSection.value,
      pageId: loaded.pages.some(item => item.id === props.pageId) ? props.pageId : 'start'
    });
    const entry = resolveExamEntry({
      pages: loaded.pages,
      requestedPageId: props.pageId,
      session: active,
      section: normalizedSection.value,
      report: route.query.mode === 'report',
      restart: route.query.restart === '1'
    });
    if (entry.action === 'home') {
      await router.replace('/');
      return;
    }
    if (entry.action === 'redirect') {
      exam.setPage(entry.pageId);
      await routeTo(entry.pageId, true);
      return;
    }
    if (entry.action === 'restart') {
      exam.reset(props.tpoId, normalizedSection.value, { pageId: 'start' });
      await router.replace({ name: 'exam', params: { ...route.params, pageId: 'start' } });
      return;
    }
    enterPage(entry.page, active.pageId);
  } catch (cause) {
    if (token === loadToken) error.value = cause?.message || 'Unable to load this exam.';
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

function enterPage(currentPage, previousSessionPage) {
  exam.setPage(currentPage.id);
  if (currentPage.type === 'results') {
    return;
  }
  if (
    normalizedSection.value === 'listening' &&
    currentPage.type === 'question' &&
    task.value?.type !== 'listen-response' &&
    !session.value.lockedQuestionIds[currentPage.questionIds?.[0]] &&
    !readOnlyMode.value &&
    (session.value.timer.scopeId !== currentPage.id || previousSessionPage !== currentPage.id)
  ) {
    exam.start({
      durationSeconds: durationFor(currentPage),
      pageId: currentPage.id,
      scopeType: 'question',
      scopeId: currentPage.id
    });
  }
}

function begin() {
  if (readOnlyMode.value) return;
  const next = document.value.pages.find(item => item.id === page.value.next);
  if (!next) return;
  const duration = page.value.type === 'intro' ? durationFor(page.value) : null;
  exam.start({
    durationSeconds: duration,
    pageId: next.id,
    scopeType:
      page.value.type === 'intro'
        ? normalizedSection.value === 'writing'
          ? 'task'
          : 'module'
        : null,
    scopeId:
      page.value.type === 'intro'
        ? normalizedSection.value === 'writing'
          ? page.value.taskId
          : page.value.moduleId
        : null
  });
  routeTo(next.id);
}

function navigate(direction) {
  const target = page.value?.[direction];
  if (!target) return;
  const targetPage = document.value.pages.find(item => item.id === target);
  if (readOnlyMode.value && targetPage?.type !== 'question') return;
  if (
    normalizedSection.value === 'listening' &&
    page.value.type === 'question' &&
    !readOnlyMode.value
  ) {
    exam.lockQuestions(page.value.questionIds || []);
    exam.continueUnlimited();
  }
  if (target === 'results') exam.complete();
  routeTo(target);
}

function mediaState(state) {
  if (state?.state !== 'ended') return;
  if (normalizedSection.value === 'listening' && task.value?.type === 'listen-response') {
    exam.start({
      durationSeconds: durationFor(page.value),
      pageId: page.value.id,
      scopeType: 'question',
      scopeId: page.value.id
    });
  }
}

function beginInstruction() {
  if (readOnlyMode.value) return;
  if (page.value.type === 'start') begin();
  else readyOpen.value = true;
}

function selectQuestion(pageId) {
  questionsOpen.value = false;
  router.push({
    name: 'exam',
    params: { tpoId: props.tpoId, section: normalizedSection.value, pageId },
    query: route.query
  });
}

function handleExpired() {
  exam.expire();
  if (normalizedSection.value === 'listening') {
    navigate('next');
    return;
  }
  if (normalizedSection.value === 'writing') {
    expiredOpen.value = true;
    return;
  }
  expiredOpen.value = true;
}

function finishExpired() {
  expiredOpen.value = false;
  if (normalizedSection.value === 'writing') {
    const nextIntro = document.value.pages.find(
      item => item.index > page.value.index && item.type === 'intro'
    );
    if (nextIntro) routeTo(nextIntro.id);
    else {
      exam.complete();
      routeTo('results');
    }
    return;
  }
  exam.complete();
  routeTo('results');
}

function requestExit() {
  readyOpen.value = false;
  if (readOnlyMode.value) {
    routeTo('results');
    return;
  }
  if (sectionBusy.value) return;
  if (session.value?.status === 'not-started') {
    router.push('/');
    return;
  }
  exitOpen.value = true;
}

function saveAndExit() {
  exitOpen.value = false;
  router.push('/');
}

async function clearAndExit() {
  if (normalizedSection.value === 'speaking' && document.value?.id) {
    await recordingRepository.removeSession(document.value.id).catch(() => {});
  }
  exam.remove(props.tpoId, normalizedSection.value);
  exitOpen.value = false;
  router.push('/');
}

async function restart() {
  if (normalizedSection.value === 'speaking' && document.value?.id) {
    await recordingRepository.removeSession(document.value.id).catch(() => {});
  }
  exam.reset(props.tpoId, normalizedSection.value, { pageId: 'start' });
  router.push({
    name: 'exam',
    params: { tpoId: props.tpoId, section: normalizedSection.value, pageId: 'start' }
  });
}

function navigateReport(offset) {
  const section = reportSections.value[reportIndex.value + offset];
  if (!section) return;
  router.push({
    name: 'exam',
    params: { tpoId: props.tpoId, section, pageId: 'results' },
    query: { mode: 'report' }
  });
}

watch(() => [props.tpoId, props.section], loadExam, { immediate: true });
watch(
  () => props.pageId,
  nextPageId => {
    if (!document.value || loading.value) return;
    const next = document.value.pages.find(item => item.id === nextPageId);
    if (!next) routeTo('start', true);
    else if (historyBlocked(next)) routeTo(session.value.pageId, true);
    else enterPage(next, session.value?.pageId);
  }
);
</script>

<template>
  <div v-if="loading" class="exam-route-state">
    <i class="fas fa-spinner fa-spin" /> Loading exam…
  </div>
  <div v-else-if="error" class="exam-route-state exam-route-state--error">
    <h1>Unable to Load Exam</h1>
    <p>{{ error }}</p>
    <RouterLink to="/">Back to Home</RouterLink>
  </div>
  <div
    v-else-if="document && page && session"
    class="exam-page"
    :class="{ 'exam-page--contained': isContentPage }"
  >
    <InstructionPage
      v-if="['start', 'intro'].includes(page.type)"
      :document="document"
      :page="instructionPage"
      :task="task"
      @begin="beginInstruction"
      @exit="requestExit"
      @help="helpOpen = true"
      @volume="volumeOpen = true"
    />
    <ResultsPage
      v-else-if="page.type === 'results'"
      :document="document"
      :page="page"
      :session="session"
      :score="scaledScore"
      :max-score="scaledScore == null ? null : 30"
      :report-previous="reportIndex > 0"
      :report-next="reportIndex >= 0 && reportIndex < reportSections.length - 1"
      @select-question="selectQuestion"
      @restart="restart"
      @exit="router.push('/')"
      @report-previous="navigateReport(-1)"
      @report-next="navigateReport(1)"
    />
    <template v-else-if="isContentPage">
      <ExamHeader
        :timer="normalizedSection === 'speaking' || readOnlyMode ? null : session.timer"
        :question-number="questionNumber"
        :total-questions="totalQuestions"
        :question-label="questionLabel"
        :urgent-at="normalizedSection === 'listening' ? 10 : 60"
        :can-back="canBack"
        :can-next="canNext"
        :show-volume="normalizedSection !== 'writing'"
        :show-back="showBack"
        :show-questions="showQuestions"
        :show-results="readOnlyMode"
        @exit="requestExit"
        @volume="volumeOpen = true"
        @help="helpOpen = true"
        @questions="questionsOpen = true"
        @results="routeTo('results')"
        @back="navigate('previous')"
        @next="navigate('next')"
        @toggle-time="exam.setTimerHidden(!session.timer.hidden)"
        @expired="handleExpired"
      />
      <component
        :is="contentComponent"
        :key="contentPageKey"
        v-bind="contentProps"
        v-on="contentListeners"
      />
    </template>

    <VolumeControl
      :open="volumeOpen"
      :model-value="volume"
      @update:model-value="settings.setVolume(normalizedSection, $event)"
      @close="volumeOpen = false"
    />
    <HelpDialog
      :open="helpOpen"
      :section="normalizedSection"
      :page="page"
      :task="task"
      @close="helpOpen = false"
    />
    <ExitDialog
      :open="exitOpen"
      @close="exitOpen = false"
      @save="saveAndExit"
      @clear="clearAndExit"
    />
    <QuestionNavigator
      :open="questionsOpen"
      :document="questionNavigatorDocument"
      :answers="session.answers"
      :marks="session.marks"
      :page-id="page.id"
      @close="questionsOpen = false"
      @select="selectQuestion"
      @toggle-mark="exam.toggleMark"
    />
    <ExamDialog :open="expiredOpen" title="Time is Up!" icon="fas fa-clock">
      <p>{{ expiredMessage.body }}</p>
      <template #actions>
        <button
          class="exam-secondary-button"
          type="button"
          @click="
            exam.continueUnlimited();
            expiredOpen = false;
          "
        >
          Continue
        </button>
        <button class="exam-primary-button" type="button" @click="finishExpired">
          {{ expiredMessage.finish }}
        </button>
      </template>
    </ExamDialog>
    <ExamDialog
      :open="readyOpen"
      title="Ready to Begin"
      icon="fas fa-check-circle"
      @close="readyOpen = false"
    >
      <p class="ready-copy">{{ readyMessage }}</p>
      <template #actions>
        <button class="exam-secondary-button" type="button" @click="requestExit">Exit Test</button>
        <button
          class="exam-primary-button"
          type="button"
          @click="
            readyOpen = false;
            begin();
          "
        >
          Begin
        </button>
      </template>
    </ExamDialog>
  </div>
</template>

<style scoped>
.exam-route-state {
  min-height: 100vh;
  display: grid;
  place-content: center;
  gap: 12px;
  text-align: center;
}
.exam-route-state--error {
  color: #8a1c1c;
}
.ready-copy {
  white-space: pre-line;
}
</style>
