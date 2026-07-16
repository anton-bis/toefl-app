<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCatalogStore } from '../stores/catalog.js';
import { readExamSession, removeExamSession } from '../stores/exam.js';
import { recordingRepository } from '../platform/dataRepository.js';
import AppModal from '../components/AppModal.vue';
import { cefrRows, changelog, scoreConversionRows, taskTypes } from '../content/homeCopy.js';
import '../styles/home.css';

const router = useRouter();
const catalog = useCatalogStore();
const panel = ref('mock');
const modal = ref('');
const pendingExam = ref(null);
const sections = [
  ['reading', 'Reading'],
  ['listening', 'Listening'],
  ['writing', 'Writing'],
  ['speaking', 'Speaking']
];

const tests = computed(() => catalog.tests);
const sectionLabel = section => sections.find(([id]) => id === section)?.[1] || section;

function openExam(tpoId, section) {
  const hasData = readExamSession(tpoId, section)?.status === 'in-progress';
  pendingExam.value = { tpoId, section, hasData };
}

async function resumeExam(mode = 'start') {
  if (!pendingExam.value) return;
  const { tpoId, section } = pendingExam.value;
  let pageId = 'start';
  if (mode !== 'continue') {
    removeExamSession(tpoId, section);
    if (section === 'speaking') {
      await recordingRepository.removeSession(`tpo-${tpoId}-speaking`).catch(() => {});
    }
  } else {
    pageId = readExamSession(tpoId, section)?.pageId || 'start';
  }
  pendingExam.value = null;
  router.push(`/exam/${tpoId}/${section}/${pageId}`);
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
    <header class="app-header"><span class="logo-text">TOEFL</span></header>
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-layer-group"></i> Practice</div>
          <button
            class="sidebar-nav-item"
            :class="{ active: panel === 'mock' }"
            @click="panel = 'mock'"
          >
            <span class="nav-icon"><i class="fas fa-pencil-alt"></i></span> Practice Tests
          </button>
          <button
            class="sidebar-nav-item"
            :class="{ active: panel === 'real' }"
            @click="panel = 'real'"
          >
            <span class="nav-icon"><i class="fas fa-scroll"></i></span> Official Tests
          </button>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-tools"></i> Skills</div>
          <RouterLink class="sidebar-nav-item" to="/skills/typing">
            <span class="nav-icon"><i class="fas fa-keyboard"></i></span> Typing
          </RouterLink>
          <RouterLink class="sidebar-nav-item" to="/skills/vocabulary">
            <span class="nav-icon"><i class="fas fa-book"></i></span> Vocabulary
          </RouterLink>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-ellipsis-h"></i> More</div>
          <button class="sidebar-nav-item" @click="modal = 'news'">
            <span class="nav-icon"><i class="fas fa-newspaper"></i></span> TOEFL Updates
          </button>
          <button class="sidebar-nav-item" @click="modal = 'about'">
            <span class="nav-icon"><i class="fas fa-handshake"></i></span> Connect
          </button>
          <button class="sidebar-nav-item" @click="modal = 'log'">
            <span class="nav-icon"><i class="fas fa-history"></i></span> Release Notes
          </button>
        </div>
      </aside>

      <main class="main-content">
        <section v-if="panel === 'mock'" class="panel active">
          <div class="panel-header">
            <h2>Practice Tests</h2>
            <p>Official ETS samples for the 2026 TOEFL iBT update</p>
          </div>
          <div class="table-scroll">
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
                <tr v-for="test in tests" :key="test.tpoId">
                  <td class="id-cell">
                    <span class="tpo-id">TPO {{ test.tpoId }}</span>
                  </td>
                  <td class="desc-cell">{{ test.description }}</td>
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
        </section>
        <section v-else class="empty-panel">
          <div class="empty-icon"><i class="fas fa-inbox"></i></div>
          <h3>More official practice is coming soon</h3>
          <p>Check back soon.</p>
        </section>
      </main>
    </div>

    <AppModal
      v-if="modal === 'news'"
      title="TOEFL Updates"
      icon="fas fa-newspaper"
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
          <li v-for="item in items" :key="item">{{ item }}</li>
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
            <td v-for="index in 5" :key="index">{{ row[1] }}</td>
          </tr>
        </tbody>
      </table>
      <h4>Score comparison (1–6 vs. legacy scales)</h4>
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
            <td v-for="cell in row" :key="cell">{{ cell }}</td>
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
          <h4><i class="fab fa-weixin wechat-icon"></i> WeChat</h4>
          <p class="about-platform-description">Scan the QR code to add me</p>
          <div class="img-block">
            <img src="/assets/images/wechat-qr.jpg" alt="WeChat QR code" />
            <div class="img-label">Add on WeChat</div>
          </div>
        </section>
        <section class="about-platform">
          <h4><span class="x-icon" aria-hidden="true">X</span></h4>
          <p class="about-platform-description">Visit my profile</p>
          <div class="img-block">
            <img src="/assets/images/x-profile.jpg" alt="X profile preview" />
            <div class="img-label">Open profile</div>
          </div>
        </section>
        <section class="about-platform">
          <h4><i class="fas fa-book-open rednote-icon"></i> RedNote</h4>
          <p class="about-platform-description">Follow me on RedNote</p>
          <div class="img-block">
            <img src="/assets/images/rednote-qr.jpg" alt="RedNote QR code" />
            <div class="img-label">Follow on RedNote</div>
          </div>
        </section>
      </div>
      <p class="note">For feedback or collaboration, reach out through any channel above.</p>
    </AppModal>

    <AppModal
      v-if="modal === 'log'"
      title="Release Notes"
      icon="fas fa-history"
      @close="modal = ''"
    >
      <article v-for="entry in changelog" :key="entry[0]" class="log-entry">
        <strong>{{ entry[0] }}</strong
        ><time>{{ entry[1] }}</time>
        <p>
          <template v-for="(line, index) in entry[2].split('<br>')" :key="line">
            <br v-if="index" />{{ line }}
          </template>
        </p>
      </article>
      <p class="note">Thanks for using TOEFL Practice.</p>
    </AppModal>

    <div
      v-if="pendingExam"
      class="practice-overlay"
      role="presentation"
      @mousedown.self="pendingExam = null"
    >
      <section
        class="practice-box"
        role="dialog"
        aria-modal="true"
        :aria-label="`TPO ${pendingExam.tpoId} · ${sectionLabel(pendingExam.section)}`"
      >
        <button
          class="modal-close practice-close"
          type="button"
          aria-label="Close"
          @click="pendingExam = null"
        >
          <i class="fas fa-times"></i>
        </button>
        <h2>
          TPO {{ pendingExam.tpoId }} ·
          {{ sectionLabel(pendingExam.section) }}
        </h2>
        <p class="practice-sub">
          {{
            pendingExam.hasData
              ? 'You have an unfinished attempt. Choose how to continue.'
              : 'Choose a practice mode.'
          }}
        </p>
        <button
          class="practice-option-card active start-option"
          type="button"
          @click="resumeExam('start')"
        >
          <span class="opt-icon"><i class="fas fa-play"></i></span>
          <span class="opt-body"
            ><strong class="opt-title">Start New</strong
            ><small class="opt-hint">Begin again from Question 1.</small></span
          >
        </button>
        <button
          class="practice-option-card"
          :class="pendingExam.hasData ? 'active' : 'disabled'"
          type="button"
          :disabled="!pendingExam.hasData"
          @click="resumeExam('continue')"
        >
          <span class="opt-icon"
            ><i :class="pendingExam.hasData ? 'fas fa-play' : 'fas fa-lock'"></i
          ></span>
          <span class="opt-body"
            ><strong class="opt-title">Resume</strong
            ><small class="opt-hint">Continue where you left off.</small></span
          >
        </button>
        <button
          class="practice-option-card danger"
          :class="pendingExam.hasData ? 'active' : 'disabled'"
          type="button"
          :disabled="!pendingExam.hasData"
          @click="resumeExam('restart')"
        >
          <span class="opt-icon"
            ><i :class="pendingExam.hasData ? 'fas fa-redo-alt' : 'fas fa-lock'"></i
          ></span>
          <span class="opt-body"
            ><strong class="opt-title">Start Over</strong
            ><small class="opt-hint">Delete this attempt and begin again.</small></span
          >
        </button>
      </section>
    </div>
  </div>
</template>
