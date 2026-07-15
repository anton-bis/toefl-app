<script setup>
import { computed, defineAsyncComponent, markRaw, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ExamDialog from '../exam/shared/ExamDialog.vue';
import ExamHeader from '../exam/shared/ExamHeader.vue';
import IntroPage from '../exam/shared/IntroPage.vue';
import StartPage from '../exam/shared/StartPage.vue';
import { expirationCopy, readyPrompt } from '../exam/shared/directions.js';
import { examQuestions, isCorrectAnswer } from '../exam/shared/model.js';
import { listeningResponseSeconds } from '../exam/sections/listening/helpers.js';
import { useCatalogStore } from '../stores/catalog.js';
import { useExamStore } from '../stores/exam.js';
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
const REPORT_SECTION_ORDER = ['reading', 'listening', 'writing', 'speaking'];
const document = shallowRef(null);
const loading = ref(true);
const error = ref('');
const reviewOpen = ref(false);
const checkOpen = ref(false);
const helpOpen = ref(false);
const volumeOpen = ref(false);
const exitOpen = ref(false);
const expiredOpen = ref(false);
const readyOpen = ref(false);
const sectionBusy = ref(false);
let loadToken = 0;

const sectionComponents = {
  reading: markRaw(defineAsyncComponent(() => import('../exam/sections/reading/ReadingPage.vue'))),
  listening: markRaw(
    defineAsyncComponent(() => import('../exam/sections/listening/ListeningPage.vue'))
  ),
  writing: markRaw(defineAsyncComponent(() => import('../exam/sections/writing/WritingPage.vue'))),
  speaking: markRaw(
    defineAsyncComponent(() => import('../exam/sections/speaking/SpeakingPage.vue'))
  )
};
const CheckDialog = defineAsyncComponent(() => import('../exam/shared/CheckDialog.vue'));
const ExitDialog = defineAsyncComponent(() => import('../exam/shared/ExitDialog.vue'));
const HelpDialog = defineAsyncComponent(() => import('../exam/shared/HelpDialog.vue'));
const ResultsPage = defineAsyncComponent(() => import('../exam/shared/ResultsPage.vue'));
const ReviewDrawer = defineAsyncComponent(() => import('../exam/shared/ReviewDrawer.vue'));
const VolumeControl = defineAsyncComponent(() => import('../exam/shared/VolumeControl.vue'));
const normalizedSection = computed(() => props.section.toLowerCase());
const page = computed(() => document.value?.pages.find(item => item.id === props.pageId));
const module = computed(() =>
  document.value?.modules.find(item => item.id === page.value?.moduleId)
);
const task = computed(() => module.value?.tasks.find(item => item.id === page.value?.taskId));
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
const questionNumber = computed(() => {
  const id = page.value?.questionIds?.[0];
  const collection = ['reading', 'listening'].includes(normalizedSection.value)
    ? moduleQuestions.value
    : questions.value;
  const index = collection.findIndex(item => item.id === id);
  return index < 0 ? 0 : index + 1;
});
const totalQuestions = computed(() => {
  if (['reading', 'listening'].includes(normalizedSection.value))
    return moduleQuestions.value.length;
  if (normalizedSection.value === 'writing') {
    return task.value?.type === 'build-sentence' ? task.value.questions.length : 2;
  }
  return questions.value.length;
});
const questionLabel = computed(() => {
  if (page.value?.type !== 'question') return '';
  if (normalizedSection.value === 'reading' && task.value?.type === 'complete-words') {
    const indexes = page.value.questionIds
      .map(id => moduleQuestions.value.findIndex(item => item.id === id) + 1)
      .filter(Boolean);
    return indexes.length
      ? `Question ${Math.min(...indexes)}–${Math.max(...indexes)} of ${moduleQuestions.value.length}`
      : '';
  }
  if (normalizedSection.value === 'writing' && task.value?.type !== 'build-sentence') {
    return `Question ${task.value?.type === 'write-email' ? 1 : 2} of 2`;
  }
  return questionNumber.value ? `Question ${questionNumber.value} of ${totalQuestions.value}` : '';
});
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
const reviewMode = computed(
  () => session.value?.status === 'completed' || route.query.mode === 'review'
);
const checkedState = computed(() => {
  if (reviewMode.value) return true;
  const ids = {};
  if (session.value?.check.revealedScopes?.[page.value?.id]) {
    for (const id of page.value?.questionIds || []) ids[id] = true;
  }
  for (const id of Object.keys(session.value?.lockedQuestionIds || {})) ids[id] = true;
  return ids;
});
const contentComponent = computed(() => sectionComponents[normalizedSection.value]);
const isContentPage = computed(() =>
  ['question', 'stimulus', 'scenario'].includes(page.value?.type)
);
const scopedDocument = computed(() => {
  if (!document.value || !module.value) return document.value || {};
  return { ...document.value, modules: [module.value] };
});
const checkDocument = computed(() => {
  if (!document.value || !module.value || !task.value) return scopedDocument.value;
  const ids = new Set(page.value?.questionIds || []);
  const questions = task.value.questions.filter(item => ids.has(item.id));
  return {
    ...document.value,
    modules: [{ ...module.value, tasks: [{ ...task.value, questions }] }]
  };
});
const showCheck = computed(
  () =>
    page.value?.type === 'question' &&
    normalizedSection.value !== 'speaking' &&
    !['write-email', 'academic-discussion'].includes(task.value?.type) &&
    !reviewMode.value
);
const canBack = computed(() => {
  if (sectionBusy.value || !page.value?.previous || page.value.type === 'scenario') return false;
  const previous = document.value?.pages.find(item => item.id === page.value.previous);
  return previous && !['intro', 'start', 'scenario'].includes(previous.type);
});
const canNext = computed(() => Boolean(page.value?.next) && !sectionBusy.value);
const reportSections = computed(() => {
  if (route.query.mode !== 'report') return [];
  const test = catalog.tests.find(item => item.tpoId === props.tpoId);
  return REPORT_SECTION_ORDER.filter(section => test?.sections[section]);
});
const reportIndex = computed(() => reportSections.value.indexOf(normalizedSection.value));
const showBack = computed(() => {
  if (normalizedSection.value === 'writing' && task.value?.type !== 'build-sentence') return false;
  return canBack.value;
});
const showReview = computed(
  () =>
    page.value?.type === 'question' ||
    (normalizedSection.value === 'listening' && page.value?.type === 'stimulus')
);

function routeTo(pageId, replace = false) {
  const target = {
    name: 'exam',
    params: { tpoId: props.tpoId, section: normalizedSection.value, pageId },
    query: route.query
  };
  return replace ? router.replace(target) : router.push(target);
}

function durationFor(currentPage) {
  if (normalizedSection.value === 'reading') return currentPage.moduleId === 'module-2' ? 540 : 690;
  if (normalizedSection.value === 'writing') {
    if (currentPage.taskId === 'build-sentence') return 347;
    if (currentPage.taskId === 'write-email') return 420;
    if (currentPage.taskId === 'academic-discussion') return 600;
  }
  if (normalizedSection.value === 'listening' && currentPage.type === 'question')
    return listeningResponseSeconds(task.value);
  return null;
}

async function loadExam() {
  const token = ++loadToken;
  loading.value = true;
  error.value = '';
  try {
    const loaded = await catalog.loadDocument(props.tpoId, normalizedSection.value);
    if (token !== loadToken) return;
    document.value = loaded;
    const validPage = loaded.pages.find(item => item.id === props.pageId);
    const initialPage = validPage?.id || 'start';
    const active = exam.openSession({
      tpoId: props.tpoId,
      section: normalizedSection.value,
      pageId: initialPage
    });
    if (!validPage) {
      exam.setPage('start');
      await routeTo('start', true);
      return;
    }
    if (route.query.restart === '1') {
      exam.reset(props.tpoId, normalizedSection.value, { pageId: 'start' });
      await router.replace({ name: 'exam', params: { ...route.params, pageId: 'start' } });
      return;
    }
    if (props.pageId === 'start' && active.status === 'in-progress' && active.pageId !== 'start') {
      await routeTo(active.pageId, true);
      return;
    }
    if (
      active.status === 'not-started' &&
      !['start', 'results'].includes(validPage.type) &&
      route.query.mode !== 'report'
    ) {
      exam.setPage('start');
      await routeTo('start', true);
      return;
    }
    enterPage(validPage, active.pageId);
  } catch (cause) {
    if (token === loadToken) error.value = cause?.message || '题目加载失败';
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

function enterPage(currentPage, previousSessionPage) {
  exam.setPage(currentPage.id);
  if (currentPage.type === 'results') {
    if (route.query.mode !== 'report' && session.value.status !== 'completed') exam.complete();
    return;
  }
  if (
    normalizedSection.value === 'listening' &&
    currentPage.type === 'question' &&
    task.value?.type !== 'listen-response' &&
    !session.value.lockedQuestionIds[currentPage.questionIds?.[0]] &&
    !reviewMode.value &&
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
  if (normalizedSection.value === 'listening' && page.value.type === 'question') {
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

function openCheck() {
  if (reviewMode.value) return;
  exam.revealScope(page.value.id, true);
  checkOpen.value = true;
}

function retryPage() {
  const currentQuestions =
    task.value?.questions.filter(item => page.value.questionIds?.includes(item.id)) || [];
  const correctIds = currentQuestions
    .filter(item => isCorrectAnswer(session.value.answers[item.id], item))
    .map(item => item.id);
  const incorrectIds = currentQuestions
    .filter(item => !isCorrectAnswer(session.value.answers[item.id], item))
    .map(item => item.id);
  if (correctIds.length) exam.lockQuestions(correctIds);
  exam.clearAnswers(incorrectIds, page.value.id);
  checkOpen.value = false;
}

function selectPage(pageId) {
  reviewOpen.value = false;
  checkOpen.value = false;
  const query = session.value?.status === 'completed' ? { mode: 'review' } : route.query;
  router.push({
    name: 'exam',
    params: { tpoId: props.tpoId, section: normalizedSection.value, pageId },
    query
  });
}

function handleExpired() {
  exam.expire();
  if (normalizedSection.value === 'listening') {
    exam.lockQuestions(page.value.questionIds || []);
    exam.continueUnlimited();
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
  if (!sectionBusy.value) exitOpen.value = true;
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
  routeTo('start');
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
    else enterPage(next, session.value?.pageId);
  }
);
</script>

<template>
  <div v-if="loading" class="exam-route-state">
    <i class="fas fa-spinner fa-spin" /> 正在加载题目…
  </div>
  <div v-else-if="error" class="exam-route-state exam-route-state--error">
    <h1>题目加载失败</h1>
    <p>{{ error }}</p>
    <RouterLink to="/">返回首页</RouterLink>
  </div>
  <div v-else-if="document && page && session" class="exam-page">
    <StartPage
      v-if="page.type === 'start'"
      :document="document"
      :page="page"
      @begin="begin"
      @help="helpOpen = true"
      @volume="volumeOpen = true"
    />
    <IntroPage
      v-else-if="page.type === 'intro'"
      :document="document"
      :page="{ ...page, title: task?.title || module?.title }"
      :task="task"
      @begin="readyOpen = true"
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
      @review="selectPage"
      @restart="restart"
      @exit="router.push('/')"
      @report-previous="navigateReport(-1)"
      @report-next="navigateReport(1)"
    />
    <template v-else-if="isContentPage">
      <ExamHeader
        :document="document"
        :page="page"
        :timer="normalizedSection === 'speaking' || reviewMode ? null : session.timer"
        :question-number="questionNumber"
        :total-questions="totalQuestions"
        :question-label="questionLabel"
        :urgent-at="normalizedSection === 'listening' ? 10 : 60"
        :can-back="canBack"
        :can-next="canNext"
        :show-volume="normalizedSection !== 'writing'"
        :show-back="showBack"
        :show-review="showReview"
        :show-check="showCheck"
        @exit="requestExit"
        @volume="volumeOpen = true"
        @help="helpOpen = true"
        @review="reviewOpen = true"
        @check="openCheck"
        @back="navigate('previous')"
        @next="navigate('next')"
        @toggle-time="exam.setTimerHidden(!session.timer.hidden)"
        @expired="handleExpired"
      />
      <component
        :is="contentComponent"
        :key="normalizedSection === 'speaking' ? document.id : page.id"
        :document="document"
        :page="page"
        :task="task"
        :question="question"
        :answers="session.answers"
        :marks="session.marks"
        :checked="checkedState"
        :volume="volume"
        :read-only="reviewMode"
        @answer="exam.saveAnswer"
        @mark="exam.toggleMark"
        @check="openCheck"
        @media-state="mediaState"
        @navigation-state="sectionBusy = $event.busy"
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
    <ReviewDrawer
      :open="reviewOpen"
      :document="checkDocument"
      :answers="session.answers"
      :marks="session.marks"
      :page="page"
      :section="normalizedSection"
      :task="task"
      :question="question"
      :source-path="document.sourcePath"
      @close="reviewOpen = false"
      @select="selectPage"
      @mark-all="exam.setAllMarks($event, true)"
      @clear-marks="exam.setAllMarks($event, false)"
    />
    <CheckDialog
      :open="checkOpen"
      :document="checkDocument"
      :answers="session.answers"
      :reveal-answers="true"
      @close="checkOpen = false"
      @retry="retryPage"
      @select="selectPage"
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
