<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.js';
import { useLicenseStore } from '../stores/license.js';
import { readExamSession, useExamStore } from '../stores/exam.js';
import { recordingRepository } from '../platform/dataRepository.js';
import { homeState } from '../platform/homeState.js';
import { WEB_BASE_DISPLAY, WEB_BASE_URL, PROMO_JUMP_ENABLED } from '../platform/promoConfig.js';
import AppModal from '../components/AppModal.vue';
import ActivationModal from '../components/ActivationModal.vue';
import { cefrRows, scoreConversionRows, taskTypes } from '../content/guideCopy.js';
import '../styles/home.css';

const router = useRouter();
const route = useRoute();
const catalog = useCatalogStore();
const exam = useExamStore();
const license = useLicenseStore();
const panel = ref(homeState.panel);
const modal = ref('');
const pendingExam = ref(null);
const restartConfirm = ref(false);
const showActivation = ref(false);

function saveHomeState() {
  homeState.panel = panel.value;
  const scroller = document.querySelector('.home-page .main-content');
  homeState.scrollTop = scroller?.scrollTop ?? 0;
}

let homeRestored = false;
function restoreHomeState() {
  if (homeRestored || !catalog.tests.length) return;
  homeRestored = true;
  nextTick(() => {
    const scroller = document.querySelector('.home-page .main-content');
    if (scroller) scroller.scrollTop = homeState.scrollTop;
  });
}
onMounted(restoreHomeState);
watch(() => catalog.tests.length, restoreHomeState);
onBeforeUnmount(saveHomeState);
const sections = [
  ['reading', 'Reading'],
  ['listening', 'Listening'],
  ['writing', 'Writing'],
  ['speaking', 'Speaking']
];

const tests = computed(() => catalog.tests);
const DATE_ID_PATTERN = /^\d{4}-\d{2}-\d{2}(?:\s*\(\d+\))?$/;
const DATE_ID_PARTS = /^(\d{4})-(\d{2})-(\d{2})(?:\s*\((\d+)\))?$/;
const isDateId = tpoId => DATE_ID_PATTERN.test(String(tpoId || ''));
const practiceTests = computed(() => tests.value.filter(test => !isDateId(test.tpoId)));
const officialTests = computed(() => tests.value.filter(test => isDateId(test.tpoId)));
function displayId(tpoId) {
  const match = String(tpoId || '').match(DATE_ID_PARTS);
  return match
    ? `${match[2]}-${match[3]}${match[4] ? ` (${match[4]})` : ''}`
    : `TPO ${tpoId}`;
}
const practiceState = computed(() => {
  const completed = pendingExam.value?.status === 'completed';
  if (completed) {
    return {
      completed,
      subtitle: 'You have completed this section.',
      primaryAction: 'results',
      primaryIcon: 'fas fa-chart-bar',
      primaryTitle: 'View Results',
      primaryHint: 'Review your score and answers.',
      restartTitle: 'Retake Section',
      restartVerb: 'Retake'
    };
  }
  return {
    completed,
    subtitle: 'You have an unfinished attempt.',
    primaryAction: 'continue',
    primaryIcon: 'fas fa-play',
    primaryTitle: 'Continue Attempt',
    primaryHint: 'Return to where you left off.',
    restartTitle: 'Restart Section',
    restartVerb: 'Restart'
  };
});
const restartWarning = computed(() => {
  if (!pendingExam.value) return '';
  const recordings = pendingExam.value.section === 'speaking' ? ', including recordings' : '';
  return practiceState.value.completed
    ? `This permanently deletes this completed attempt, its score, and saved answers${recordings}.`
    : `This permanently deletes your saved answers and timer data${recordings}.`;
});
const sectionLabel = section => sections.find(([id]) => id === section)?.[1] || section;

function openExam(tpoId, section) {
  const session = readExamSession(tpoId, section);
  if (!['in-progress', 'completed'].includes(session?.status)) {
    router.push(`/exam/${tpoId}/${section}/start`);
    return;
  }
  restartConfirm.value = false;
  pendingExam.value = { tpoId, section, status: session.status, pageId: session.pageId };
}

function openTest(tpoId, section) {
  if (license.contentLocked) {
    showActivation.value = true;
    return;
  }
  openExam(tpoId, section);
}

watch(
  () => route.query.activate,
  value => {
    if (value === '1' && license.contentLocked) showActivation.value = true;
  }
);

function closePractice() {
  restartConfirm.value = false;
  pendingExam.value = null;
}

function selectExamAction(action) {
  if (!pendingExam.value) return;
  const { tpoId, section, pageId } = pendingExam.value;
  if (action === 'restart') {
    restartConfirm.value = true;
    return;
  }
  closePractice();
  const target = action === 'results' ? 'results?mode=report' : pageId || 'start';
  router.push(`/exam/${tpoId}/${section}/${target}`);
}

async function confirmRestart() {
  if (!pendingExam.value) return;
  const { tpoId, section } = pendingExam.value;
  exam.reset(tpoId, section, { pageId: 'start' });
  if (section === 'speaking') {
    await recordingRepository.removeAttempt(`tpo-${tpoId}-speaking`).catch(() => {});
  }
  closePractice();
  router.push(`/exam/${tpoId}/${section}/start`);
}

function openReport(test) {
  const section = sections.find(([id]) => {
    if (!test.sections[id]) return false;
    return readExamSession(test.tpoId, id)?.status === 'completed';
  })?.[0];
  if (section) router.push(`/exam/${test.tpoId}/${section}/results?mode=report`);
}

function hasReport(test) {
  return sections.some(
    ([section]) =>
      test.sections[section] && readExamSession(test.tpoId, section)?.status === 'completed'
  );
}
</script>

<template>
  <div class="home-page">
    <header class="app-header">
      <span class="logo-text">Just Tofu</span>
    </header>
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-layer-group" /> Practice</div>
          <button
            class="sidebar-nav-item"
            :class="{ active: panel === 'mock' }"
            @click="panel = 'mock'"
          >
            <span class="nav-icon"><i class="fas fa-pencil-alt" /></span> Practice Tests
          </button>
          <button
            class="sidebar-nav-item"
            :class="{ active: panel === 'real' }"
            @click="panel = 'real'"
          >
            <span class="nav-icon"><i class="fas fa-scroll" /></span> Official Tests
          </button>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-tools" /> Skills</div>
          <RouterLink class="sidebar-nav-item" to="/skills/typing">
            <span class="nav-icon"><i class="fas fa-keyboard" /></span> Typing
          </RouterLink>
          <RouterLink class="sidebar-nav-item" to="/skills/vocabulary">
            <span class="nav-icon"><i class="fas fa-book" /></span> Vocabulary
          </RouterLink>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-ellipsis-h" /> More</div>
          <button class="sidebar-nav-item" @click="modal = 'guide'">
            <span class="nav-icon"><i class="fas fa-book-open" /></span> TOEFL Guide
          </button>
          <button class="sidebar-nav-item" @click="modal = 'about'">
            <span class="nav-icon"><i class="fas fa-handshake" /></span> Connect
          </button>
          <RouterLink class="sidebar-nav-item" to="/settings">
            <span class="nav-icon"><i class="fas fa-cog" /></span> Settings
          </RouterLink>
        </div>
      </aside>

      <main class="main-content">
        <section
          v-if="license.isDesktop"
          class="referral-banner"
          :class="{ 'referral-banner--active': license.activated }"
        >
          <a
            :href="PROMO_JUMP_ENABLED ? WEB_BASE_URL : undefined"
            :target="PROMO_JUMP_ENABLED ? '_blank' : undefined"
            :rel="PROMO_JUMP_ENABLED ? 'noopener' : undefined"
            :aria-disabled="!PROMO_JUMP_ENABLED"
            class="referral-banner__inner"
            :class="{ 'referral-banner__inner--disabled': !PROMO_JUMP_ENABLED }"
          >
            <span class="referral-banner__icon" aria-hidden="true">
              <i class="fas fa-gem" />
            </span>
            <div class="referral-banner__body">
              <template v-if="license.activated">
                <strong>网页版同样可用</strong>
                <p>
                  你的序列号在网页（{{ WEB_BASE_DISPLAY }}）注册后通用：解锁真题权益 + AI
                  作文 / 口语批改，报告永久保存。
                </p>
              </template>
              <template v-else>
                <strong>网页版有 AI 批改</strong>
                <p>
                  本软件与网页版（{{ WEB_BASE_DISPLAY }}）同一序列号通用：写作 / 口语逐题评分、
                  分项反馈、润色版，报告永久保存。兑换序列号解锁全部真题，Web 与桌面版均可使用。
                </p>
              </template>
            </div>
            <span
              class="referral-banner__cta"
              :class="{ 'referral-banner__cta--disabled': !PROMO_JUMP_ENABLED }"
            >
              前往网页版 <i class="fas fa-arrow-right" aria-hidden="true" />
            </span>
          </a>
        </section>
        <section v-if="panel === 'mock'" class="panel active">
          <div class="panel-header">
            <h2>Practice Tests</h2>
            <p>Official ETS samples for the 2026 TOEFL iBT update</p>
          </div>
          <div v-if="practiceTests.length" class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="id-heading">ID</th>
                  <th>Description</th>
                  <th>Reading</th>
                  <th>Listening</th>
                  <th>Writing</th>
                  <th>Speaking</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="test in practiceTests" :key="test.tpoId">
                  <td class="id-cell">
                    <span class="tpo-id">{{ displayId(test.tpoId) }}</span>
                  </td>
                  <td class="desc-cell">
                    {{ test.description }}
                  </td>
                  <td v-for="[section, label] in sections" :key="section" class="module-cell">
                    <button
                      v-if="test.sections[section]"
                      class="mod-btn available"
                      @click="openExam(test.tpoId, section)"
                    >
                      {{ label }}
                    </button>
                    <span v-else class="mod-na">—</span>
                  </td>
                  <td class="report-cell">
                    <button
                      class="mod-btn"
                      :class="{ available: hasReport(test) }"
                      :disabled="!hasReport(test)"
                      @click="openReport(test)"
                    >
                      View Report
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-panel">
            <div class="empty-icon"><i class="fas fa-inbox" /></div>
            <h3>More official practice is coming soon</h3>
            <p>Check back soon.</p>
          </div>
        </section>
        <section v-else-if="panel === 'real'" class="panel active">
          <div class="panel-header">
            <h2>Official Tests</h2>
            <p>Official ETS Tests for the 2026 TOEFL IBT</p>
          </div>
          <div v-if="officialTests.length" class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="id-heading">ID</th>
                  <th>Description</th>
                  <th>Reading</th>
                  <th>Listening</th>
                  <th>Writing</th>
                  <th>Speaking</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="test in officialTests" :key="test.tpoId">
                  <td class="id-cell">
                    <span class="tpo-id">{{ displayId(test.tpoId) }}</span>
                  </td>
                  <td class="desc-cell">
                    {{ test.description }}
                  </td>
                  <td v-for="[section, label] in sections" :key="section" class="module-cell">
                    <button
                      v-if="test.sections[section]"
                      class="mod-btn available"
                      :class="{ locked: license.contentLocked }"
                      :title="license.contentLocked ? '需要激活后才能使用' : ''"
                      @click="openTest(test.tpoId, section)"
                    >
                      <span v-if="license.contentLocked" class="lock-mark" aria-hidden="true"
                        >🔒
                      </span>
                      {{ label }}
                    </button>
                    <span v-else class="mod-na">—</span>
                  </td>
                  <td class="report-cell">
                    <button
                      class="mod-btn"
                      :class="{ available: hasReport(test) }"
                      :disabled="!hasReport(test)"
                      @click="openReport(test)"
                    >
                      View Report
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-panel">
            <div class="empty-icon"><i class="fas fa-inbox" /></div>
            <h3>No official tests yet</h3>
            <p>Check back soon.</p>
          </div>
        </section>
        <section v-else class="empty-panel">
          <div class="empty-icon">
            <i class="fas fa-inbox" />
          </div>
          <h3>More official practice is coming soon</h3>
          <p>Check back soon.</p>
        </section>
      </main>
    </div>

    <AppModal
      v-if="modal === 'guide'"
      title="TOEFL Guide"
      icon="fas fa-book-open"
      wide
      @close="modal = ''"
    >
      <h4>January 21, 2026 · What’s changing in the TOEFL iBT</h4>
      <p>
        The updated TOEFL iBT uses <strong>multistage adaptive testing</strong>. Sections appear in
        this order: Reading, Listening, Writing, and Speaking.
      </p>
      <h4>Questions and timing</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>Section</th>
            <th>Questions</th>
            <th>Estimated time</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Reading (adaptive)</td>
            <td>35–48 questions</td>
            <td>18–27 minutes</td>
          </tr>
          <tr>
            <td>Listening (adaptive)</td>
            <td>35–45 questions</td>
            <td>18–27 minutes</td>
          </tr>
          <tr>
            <td>Writing</td>
            <td>12 questions</td>
            <td>23 minutes</td>
          </tr>
          <tr>
            <td>Speaking</td>
            <td>12 questions</td>
            <td>8 minutes</td>
          </tr>
        </tbody>
      </table>
      <h4>Task types</h4>
      <template v-for="[name, items] in taskTypes" :key="name">
        <p>
          <strong>{{ name }}</strong>
        </p>
        <ul>
          <li v-for="item in items" :key="item">
            {{ item }}
          </li>
        </ul>
      </template>
      <h4>Scoring</h4>
      <p>
        The test uses a <strong>1–6 band scale</strong> aligned with CEFR. Section and overall
        scores are reported in 0.5-point increments, and the overall score is the average of the
        four section scores. <strong>MyBest® scores</strong> combine your highest section scores
        from the past two years.
      </p>
      <h4>Raw scores and 1–6 bands</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>Section</th>
            <th>Raw score</th>
            <th>1–6 band</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Reading</td>
            <td>0–35</td>
            <td>1–6</td>
          </tr>
          <tr>
            <td>Listening</td>
            <td>0–30</td>
            <td>1–6</td>
          </tr>
          <tr>
            <td>Writing</td>
            <td>0–15</td>
            <td>1–6</td>
          </tr>
          <tr>
            <td>Speaking</td>
            <td>0–50</td>
            <td>1–6</td>
          </tr>
        </tbody>
      </table>
      <h4>CEFR alignment</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>CEFR</th>
            <th>Reading</th>
            <th>Listening</th>
            <th>Writing</th>
            <th>Speaking</th>
            <th>Overall</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in cefrRows" :key="row[0]">
            <td>{{ row[0] }}</td>
            <td v-for="index in 5" :key="index">
              {{ row[1] }}
            </td>
          </tr>
        </tbody>
      </table>
      <h4>Score comparison (1–6 vs. previous scales)</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>Band</th>
            <th>Reading (0–30)</th>
            <th>Listening (0–30)</th>
            <th>Writing (0–30)</th>
            <th>Speaking (0–30)</th>
            <th>Overall (0–120)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in scoreConversionRows" :key="row[0]">
            <td v-for="cell in row" :key="cell">
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </AppModal>

    <AppModal
      v-if="modal === 'about'"
      class="about-modal"
      title="Connect"
      icon="fas fa-handshake"
      wide
      @close="modal = ''"
    >
      <p>Built with AI assistance to provide focused, high-quality TOEFL practice.</p>
      <div class="about-platforms">
        <section class="about-platform">
          <h4><span class="wechat-icon" aria-hidden="true" /> WeChat</h4>
          <p class="about-platform-description">Scan the QR code to add me</p>
          <div class="img-block">
            <img src="/assets/images/wechat-qr.jpg" alt="WeChat QR code" />
            <div class="img-label">Add on WeChat</div>
          </div>
        </section>
        <section class="about-platform">
          <h4><i class="fas fa-book-open rednote-icon" /> RedNote</h4>
          <p class="about-platform-description">Follow me on RedNote</p>
          <div class="img-block">
            <img src="/assets/images/rednote-qr.jpg" alt="RedNote QR code" />
            <div class="img-label">Follow on RedNote</div>
          </div>
        </section>
      </div>
      <p class="note">For feedback or collaboration, reach out through any channel above.</p>
    </AppModal>

    <div
      v-if="pendingExam"
      class="practice-overlay"
      role="presentation"
      @mousedown.self="closePractice"
    >
      <section
        class="practice-box"
        role="dialog"
        aria-modal="true"
        :aria-label="`${displayId(pendingExam.tpoId)} · ${sectionLabel(pendingExam.section)}`"
      >
        <button
          class="modal-close practice-close"
          type="button"
          aria-label="Close"
          @click="closePractice"
        >
          <i class="fas fa-times" />
        </button>
        <template v-if="!restartConfirm">
          <h2>
            {{ displayId(pendingExam.tpoId) }} ·
            {{ sectionLabel(pendingExam.section) }}
          </h2>
          <p class="practice-sub">
            {{ practiceState.subtitle }}
          </p>
          <button
            class="practice-option-card active"
            type="button"
            @click="selectExamAction(practiceState.primaryAction)"
          >
            <span class="opt-icon"><i :class="practiceState.primaryIcon" /></span>
            <span class="opt-body">
              <strong class="opt-title">{{ practiceState.primaryTitle }}</strong>
              <small class="opt-hint">{{ practiceState.primaryHint }}</small>
            </span>
          </button>
          <button
            class="practice-option-card danger active"
            type="button"
            @click="selectExamAction('restart')"
          >
            <span class="opt-icon"><i class="fas fa-redo-alt" /></span>
            <span class="opt-body">
              <strong class="opt-title">{{ practiceState.restartTitle }}</strong>
              <small class="opt-hint">Start again from Question 1.</small>
            </span>
          </button>
        </template>
        <template v-else>
          <h2>{{ practiceState.restartVerb }} {{ sectionLabel(pendingExam.section) }}?</h2>
          <p class="practice-confirm-copy">
            {{ restartWarning }}
          </p>
          <div class="practice-confirm-actions">
            <button type="button" class="practice-cancel" @click="restartConfirm = false">
              Keep Attempt
            </button>
            <button type="button" class="practice-restart" @click="confirmRestart">
              {{ practiceState.restartTitle }}
            </button>
          </div>
        </template>
      </section>
    </div>

    <ActivationModal
      v-if="showActivation"
      @close="showActivation = false"
      @activated="showActivation = false"
    />
  </div>
</template>
