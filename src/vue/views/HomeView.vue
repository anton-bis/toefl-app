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
  router.push(
    `/exam/${test.tpoId}/${section || sections.find(([id]) => test.sections[id])?.[0]}/results?mode=report`
  );
}
</script>

<template>
  <div class="home-page">
    <header class="app-header"><span class="logo-text">Toefl</span></header>
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-section-header"><i class="fas fa-layer-group"></i> 题目</div>
          <button
            class="sidebar-nav-item"
            :class="{ active: panel === 'mock' }"
            @click="panel = 'mock'"
          >
            <span class="nav-icon"><i class="fas fa-pencil-alt"></i></span> 模考
          </button>
          <button
            class="sidebar-nav-item"
            :class="{ active: panel === 'real' }"
            @click="panel = 'real'"
          >
            <span class="nav-icon"><i class="fas fa-scroll"></i></span> 真题
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
          <div class="sidebar-section-header"><i class="fas fa-ellipsis-h"></i> 其他</div>
          <button class="sidebar-nav-item" @click="modal = 'news'">
            <span class="nav-icon"><i class="fas fa-newspaper"></i></span> 托福动态
          </button>
          <button class="sidebar-nav-item" @click="modal = 'about'">
            <span class="nav-icon"><i class="fas fa-handshake"></i></span> 关注/合作
          </button>
          <button class="sidebar-nav-item" @click="modal = 'log'">
            <span class="nav-icon"><i class="fas fa-history"></i></span> 日志
          </button>
        </div>
      </aside>

      <main class="main-content">
        <section v-if="panel === 'mock'" class="panel active">
          <div class="panel-header">
            <h2>模考</h2>
            <p>2026年reform ETS官方样题 · official</p>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="id-heading">ID</th>
                  <th>描述</th>
                  <th>阅读</th>
                  <th>听力</th>
                  <th>写作</th>
                  <th>口语</th>
                  <th>测试报告</th>
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
                    <button class="mod-btn available" @click="openReport(test)">测试报告</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section v-else class="empty-panel">
          <div class="empty-icon"><i class="fas fa-inbox"></i></div>
          <h3>真题数据即将上线</h3>
          <p>敬请期待</p>
        </section>
      </main>
    </div>

    <AppModal
      v-if="modal === 'news'"
      title="托福动态"
      icon="fas fa-newspaper"
      wide
      @close="modal = ''"
    >
      <h4>2026年1月21日 · 托福iBT改革要点</h4>
      <p>
        新版托福 iBT 采用<strong>多阶段自适应（multistage）</strong>形式，考试顺序固定为：阅读 →
        听力 → 写作 → 口语。
      </p>
      <h4>考试题量与时长</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>考试部分</th>
            <th>题型数量</th>
            <th>预估时长</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>阅读（自适应）</td>
            <td>35–48 题</td>
            <td>约 18–27 分钟</td>
          </tr>
          <tr>
            <td>听力（自适应）</td>
            <td>35–45 题</td>
            <td>约 18–27 分钟</td>
          </tr>
          <tr>
            <td>写作</td>
            <td>12 题</td>
            <td>约 23 分钟</td>
          </tr>
          <tr>
            <td>口语</td>
            <td>12 题</td>
            <td>约 8 分钟</td>
          </tr>
        </tbody>
      </table>
      <h4>各部分任务类型</h4>
      <template v-for="[name, items] in taskTypes" :key="name">
        <p>
          <strong>{{ name }}</strong>
        </p>
        <ul>
          <li v-for="item in items" :key="item">{{ item }}</li>
        </ul>
      </template>
      <h4>评分体系</h4>
      <p>
        采用<strong>1–6 分制分段评分</strong>，与 CEFR 直接对齐。四个单项及总分均以 0.5
        分为增量，总分由四项平均值计算得出。成绩报告包含 <strong>MyBest® 分数</strong>（过去 2
        年内各单项最高分平均值）。
      </p>
      <h4>原始分与 1–6 分制对照</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>考试部分</th>
            <th>原始分范围</th>
            <th>1–6 分制范围</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>阅读</td>
            <td>0–35</td>
            <td>1–6</td>
          </tr>
          <tr>
            <td>听力</td>
            <td>0–30</td>
            <td>1–6</td>
          </tr>
          <tr>
            <td>写作</td>
            <td>0–15</td>
            <td>1–6</td>
          </tr>
          <tr>
            <td>口语</td>
            <td>0–50</td>
            <td>1–6</td>
          </tr>
        </tbody>
      </table>
      <h4>CEFR 等级对应</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>CEFR</th>
            <th>阅读</th>
            <th>听力</th>
            <th>写作</th>
            <th>口语</th>
            <th>总分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in cefrRows" :key="row[0]">
            <td>{{ row[0] }}</td>
            <td v-for="index in 5" :key="index">{{ row[1] }}</td>
          </tr>
        </tbody>
      </table>
      <h4>新旧分制换算（1–6 ↔ 0–30/0–120）</h4>
      <table class="info-table">
        <thead>
          <tr>
            <th>新制</th>
            <th>阅读(0–30)</th>
            <th>听力(0–30)</th>
            <th>写作(0–30)</th>
            <th>口语(0–30)</th>
            <th>总分(0–120)</th>
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
      title="关注/合作"
      icon="fas fa-handshake"
      wide
      @close="modal = ''"
    >
      <p>本软件由 AI 辅助开发，致力于为托福考生提供高质量的模拟练习体验。</p>
      <div class="about-platforms">
        <section class="about-platform">
          <h4><i class="fab fa-weixin wechat-icon"></i> 微信平台</h4>
          <p class="about-platform-description">扫描下方二维码添加好友</p>
          <div class="img-block">
            <img src="/assets/images/wechat-qr.jpg" alt="微信二维码" />
            <div class="img-label">扫码添加好友</div>
          </div>
        </section>
        <section class="about-platform">
          <h4><span class="x-icon" aria-hidden="true">X</span> 社交平台</h4>
          <p class="about-platform-description">访问我的个人主页</p>
          <div class="img-block">
            <img src="/assets/images/x-profile.jpg" alt="X 平台主页" />
            <div class="img-label">访问主页</div>
          </div>
        </section>
        <section class="about-platform">
          <h4><i class="fas fa-book-open rednote-icon"></i> 小红书</h4>
          <p class="about-platform-description">关注我的小红书账号</p>
          <div class="img-block">
            <img src="/assets/images/rednote-qr.jpg" alt="小红书二维码" />
            <div class="img-label">扫码关注</div>
          </div>
        </section>
      </div>
      <p class="note">如有合作意向或反馈建议，请通过以上方式联系我们。</p>
    </AppModal>

    <AppModal v-if="modal === 'log'" title="更新日志" icon="fas fa-history" @close="modal = ''">
      <article v-for="entry in changelog" :key="entry[0]" class="log-entry">
        <strong>{{ entry[0] }}</strong
        ><time>{{ entry[1] }}</time>
        <p>
          <template v-for="(line, index) in entry[2].split('<br>')" :key="line">
            <br v-if="index" />{{ line }}
          </template>
        </p>
      </article>
      <p class="note">很荣幸为您服务。</p>
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
        :aria-label="`TPO ${pendingExam.tpoId} · ${pendingExam.section === 'reading' ? 'Reading' : pendingExam.section}`"
      >
        <button
          class="modal-close practice-close"
          type="button"
          aria-label="关闭"
          @click="pendingExam = null"
        >
          <i class="fas fa-times"></i>
        </button>
        <h2>
          TPO {{ pendingExam.tpoId }} ·
          {{ pendingExam.section === 'reading' ? 'Reading' : pendingExam.section }}
        </h2>
        <p class="practice-sub">
          {{ pendingExam.hasData ? '检测到已有答题记录，请选择练习模式' : '请选择练习模式' }}
        </p>
        <button
          class="practice-option-card active start-option"
          type="button"
          @click="resumeExam('start')"
        >
          <span class="opt-icon"><i class="fas fa-play"></i></span>
          <span class="opt-body"
            ><strong class="opt-title">开始练习</strong
            ><small class="opt-hint">全新开始，从第一题做起</small></span
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
            ><strong class="opt-title">继续练习</strong
            ><small class="opt-hint">从上次退出的位置继续答题</small></span
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
            ><strong class="opt-title">重新练习</strong
            ><small class="opt-hint">清除当前记录，全新开始</small></span
          >
        </button>
      </section>
    </div>
  </div>
</template>
