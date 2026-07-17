import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamView from '../../src/vue/views/ExamView.vue';
import ExamHeader from '../../src/vue/exam/shared/ExamHeader.vue';
import { useCatalogStore } from '../../src/vue/stores/catalog.js';
import { examStorageKey, useExamStore } from '../../src/vue/stores/exam.js';
import { installMemoryStorage } from './helpers/storage.js';

const document = {
  id: 'tpo-03-reading',
  tpoId: '03',
  section: 'reading',
  sourcePath: 'assets/questions/reading/TPO-03/reading-TPO-03.md',
  pages: [
    { id: 'start', type: 'start', next: 'module-1-intro', questionIds: [] },
    {
      id: 'module-1-intro',
      type: 'intro',
      moduleId: 'module-1',
      previous: 'start',
      next: 'q1',
      questionIds: []
    },
    {
      id: 'q1',
      type: 'question',
      moduleId: 'module-1',
      taskId: 'task-1',
      previous: 'module-1-intro',
      next: 'results',
      questionIds: ['q1']
    },
    { id: 'results', type: 'results', previous: 'q1', next: null, questionIds: [] }
  ],
  modules: [
    {
      id: 'module-1',
      title: 'Module 1',
      tasks: [
        {
          id: 'task-1',
          title: 'Read a Notice',
          type: 'notice',
          passage: 'Library opening hours',
          questions: [
            {
              id: 'q1',
              number: 1,
              type: 'notice',
              prompt: 'When does it open?',
              options: [
                { id: 'A', text: 'Eight' },
                { id: 'B', text: 'Nine' }
              ],
              answer: 'A'
            }
          ]
        }
      ]
    }
  ]
};
const listeningDocument = {
  ...document,
  id: 'tpo-03-listening',
  section: 'listening',
  sourcePath: 'assets/questions/listening/TPO-03/listening-TPO-03.md',
  pages: [
    { id: 'start', type: 'start', next: 'module-1-intro', questionIds: [] },
    {
      id: 'module-1-intro',
      type: 'intro',
      moduleId: 'module-1',
      previous: 'start',
      next: 'lq1',
      questionIds: []
    },
    {
      id: 'lq1',
      type: 'question',
      moduleId: 'module-1',
      taskId: 'task-1',
      previous: 'module-1-intro',
      next: 'lq2',
      questionIds: ['lq1']
    },
    {
      id: 'lq2',
      type: 'question',
      moduleId: 'module-1',
      taskId: 'task-1',
      previous: 'lq1',
      next: 'results',
      questionIds: ['lq2']
    },
    { id: 'results', type: 'results', previous: 'lq2', next: null, questionIds: [] }
  ],
  modules: [
    {
      id: 'module-1',
      title: 'Module 1',
      tasks: [
        {
          id: 'task-1',
          title: 'Conversation',
          type: 'conversation',
          questions: [
            { ...document.modules[0].tasks[0].questions[0], id: 'lq1', number: 1 },
            { ...document.modules[0].tasks[0].questions[0], id: 'lq2', number: 2 }
          ]
        }
      ]
    }
  ]
};
const readingNavigationDocument = {
  ...document,
  pages: [
    ...document.pages.slice(0, 2),
    { ...document.pages[2], next: 'q2' },
    {
      id: 'q2',
      type: 'question',
      moduleId: 'module-1',
      taskId: 'task-1',
      previous: 'q1',
      next: 'module-2-intro',
      questionIds: ['q2']
    },
    {
      id: 'module-2-intro',
      type: 'intro',
      moduleId: 'module-2',
      previous: 'q2',
      next: 'q3',
      questionIds: []
    },
    {
      id: 'q3',
      type: 'question',
      moduleId: 'module-2',
      taskId: 'task-2',
      previous: 'module-2-intro',
      next: 'results',
      questionIds: ['q3']
    },
    { id: 'results', type: 'results', previous: 'q3', next: null, questionIds: [] }
  ],
  modules: [
    {
      ...document.modules[0],
      tasks: [
        {
          ...document.modules[0].tasks[0],
          questions: [
            document.modules[0].tasks[0].questions[0],
            {
              ...document.modules[0].tasks[0].questions[0],
              id: 'q2',
              number: 2,
              prompt: 'When does it close?'
            }
          ]
        }
      ]
    },
    {
      id: 'module-2',
      title: 'Module 2',
      tasks: [
        {
          ...document.modules[0].tasks[0],
          id: 'task-2',
          questions: [
            {
              ...document.modules[0].tasks[0].questions[0],
              id: 'q3',
              number: 1,
              prompt: 'When is it closed?'
            }
          ]
        }
      ]
    }
  ]
};

async function mountRoute(path, loadedDocument = document) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      {
        path: '/exam/:tpoId/:section/:pageId?',
        name: 'exam',
        component: ExamView,
        props: true
      }
    ]
  });
  const catalog = useCatalogStore(pinia);
  catalog.loadDocument = vi.fn(async () => loadedDocument);
  await router.push(path);
  await router.isReady();
  const wrapper = mount(defineComponent({ template: '<RouterView />' }), {
    global: { plugins: [pinia, router] }
  });
  await flushPromises();
  return { wrapper, router, exam: useExamStore(pinia) };
}

async function clickButton(root, label) {
  const button = [...root.querySelectorAll('button')].find(
    candidate => candidate.textContent.trim() === label
  );
  expect(button).toBeTruthy();
  button.click();
  await flushPromises();
}

describe('ExamView route guard and flow', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it.each(['stale-page', 'q1'])('normalizes a locked %s route to the start page', async pageId => {
    const { wrapper, router, exam } = await mountRoute(`/exam/03/reading/${pageId}`);
    await vi.waitFor(() => expect(router.currentRoute.value.params.pageId).toBe('start'));
    expect(wrapper.text()).toContain('Reading Section');
    expect(exam.activeSession.pageId).toBe('start');
  });

  it('moves through start, intro and confirmation before the first question', async () => {
    const { wrapper, router } = await mountRoute('/exam/03/reading/start');
    await clickButton(wrapper.element, 'Begin');
    expect(router.currentRoute.value.params.pageId).toBe('module-1-intro');
    await clickButton(wrapper.element, 'Begin');
    await clickButton(globalThis.document, 'Begin');
    expect(router.currentRoute.value.params.pageId).toBe('q1');
    await vi.waitFor(() => expect(wrapper.text()).toContain('When does it open?'));
    expect(wrapper.find('.exam-page--contained').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('Check Answers');
  });

  it('uses Questions as a current-module navigator with per-question marks', async () => {
    const { wrapper, router, exam } = await mountRoute(
      '/exam/03/reading/start',
      readingNavigationDocument
    );
    await clickButton(wrapper.element, 'Begin');
    await clickButton(wrapper.element, 'Begin');
    await clickButton(globalThis.document, 'Begin');
    const readingSurface = wrapper.find('.reading-page').element;
    const passageSurface = wrapper.find('.left-column').element;
    const passageCard = wrapper.find('.daily-passage-card').element;
    const questionSurface = wrapper.find('.right-column').element;
    await clickButton(wrapper.element, 'Questions');

    await vi.waitFor(() =>
      expect(globalThis.document.querySelectorAll('.question-navigator__item')).toHaveLength(2)
    );
    expect(globalThis.document.querySelector('.question-navigator__stats').textContent).toContain(
      '0 / 2'
    );

    globalThis.document.querySelectorAll('.question-navigator__mark')[1].click();
    await flushPromises();
    expect(exam.activeSession.marks.q2).toBe(true);

    globalThis.document.querySelectorAll('.question-navigator__question')[1].click();
    await flushPromises();
    expect(router.currentRoute.value.params.pageId).toBe('q2');
    expect(wrapper.find('.reading-page').element).toBe(readingSurface);
    expect(wrapper.find('.left-column').element).toBe(passageSurface);
    expect(wrapper.find('.daily-passage-card').element).toBe(passageCard);
    expect(wrapper.find('.right-column').element).not.toBe(questionSurface);
    expect(globalThis.document.querySelector('.question-navigator')).toBeNull();

    exam.complete();
    await flushPromises();
    expect(wrapper.text()).not.toContain('Questions');
    const next = [...wrapper.element.querySelectorAll('button')].find(
      button => button.textContent.trim() === 'Next'
    );
    expect(next.disabled).toBe(true);
    await clickButton(wrapper.element, 'Results');
    expect(router.currentRoute.value.params.pageId).toBe('results');
  });

  it('keeps report links read-only and routes back to results', async () => {
    localStorage.setItem(
      examStorageKey('03', 'reading'),
      JSON.stringify({
        tpoId: '03',
        section: 'reading',
        pageId: 'results',
        status: 'completed',
        answers: { q1: 'B' },
        completedAt: 100,
        updatedAt: 100
      })
    );
    const { wrapper, router } = await mountRoute('/exam/03/reading/q1?mode=report');
    await vi.waitFor(() => expect(wrapper.text()).toContain('When does it open?'));
    expect(wrapper.text()).not.toContain('Questions');
    expect(
      wrapper.findAll('.option-item-apple').every(option => option.attributes('disabled') === '')
    ).toBe(true);
    expect(wrapper.find('.option-item-apple.correct').attributes('data-option')).toBe('A');

    await clickButton(wrapper.element, 'Results');
    expect(router.currentRoute.value.params.pageId).toBe('results');
    expect(router.currentRoute.value.query.mode).toBe('report');

    await vi.waitFor(() => expect(wrapper.text()).toContain('Restart Test'));
    await clickButton(wrapper.element, 'Restart Test');
    const confirm = [...globalThis.document.querySelectorAll('button')]
      .filter(button => button.textContent.trim() === 'Restart Test')
      .at(-1);
    confirm.click();
    await flushPromises();
    expect(router.currentRoute.value.params.pageId).toBe('start');
    expect(router.currentRoute.value.query).toEqual({});
  });

  it('numbers result questions by their order within each module', async () => {
    const repeatedTaskNumbers = {
      ...readingNavigationDocument,
      modules: [
        {
          ...readingNavigationDocument.modules[0],
          tasks: [
            {
              ...readingNavigationDocument.modules[0].tasks[0],
              questions: [
                readingNavigationDocument.modules[0].tasks[0].questions[0],
                {
                  ...readingNavigationDocument.modules[0].tasks[0].questions[1],
                  number: 1
                }
              ]
            }
          ]
        },
        readingNavigationDocument.modules[1]
      ]
    };
    localStorage.setItem(
      examStorageKey('03', 'reading'),
      JSON.stringify({
        tpoId: '03',
        section: 'reading',
        pageId: 'results',
        status: 'completed',
        answers: {},
        completedAt: 100,
        updatedAt: 100
      })
    );

    const { wrapper } = await mountRoute(
      '/exam/03/reading/results?mode=report',
      repeatedTaskNumbers
    );
    await vi.waitFor(() => expect(wrapper.findAll('.results-module')).toHaveLength(2));
    const moduleButtons = wrapper.findAll('.results-module')[0].findAll('.results-grid button');
    expect(moduleButtons.map(button => button.text())).toEqual(['1', '2']);
    await moduleButtons[1].trigger('click');
    await vi.waitFor(() => expect(wrapper.text()).toContain('When does it close?'));
  });

  it('rejects report access for an unfinished session without moving its saved page', async () => {
    const key = examStorageKey('03', 'reading');
    localStorage.setItem(
      key,
      JSON.stringify({
        tpoId: '03',
        section: 'reading',
        pageId: 'q2',
        status: 'in-progress',
        answers: { q1: 'A' },
        updatedAt: 100
      })
    );

    const { wrapper, router } = await mountRoute('/exam/03/reading/q1?mode=report');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'));
    expect(wrapper.text()).toBe('Home');
    expect(JSON.parse(localStorage.getItem(key)).pageId).toBe('q2');
  });

  it('does not complete an unstarted session through a direct results route', async () => {
    const { router, exam } = await mountRoute('/exam/03/reading/results');
    await vi.waitFor(() => expect(router.currentRoute.value.params.pageId).toBe('start'));
    expect(exam.activeSession.status).toBe('not-started');
    expect(exam.activeSession.pageId).toBe('start');
  });

  it('returns a direct results route to the saved in-progress page', async () => {
    const key = examStorageKey('03', 'reading');
    localStorage.setItem(
      key,
      JSON.stringify({
        tpoId: '03',
        section: 'reading',
        pageId: 'q1',
        status: 'in-progress',
        answers: { q1: 'B' },
        updatedAt: 100
      })
    );

    const { router, exam } = await mountRoute('/exam/03/reading/results');
    await vi.waitFor(() => expect(router.currentRoute.value.params.pageId).toBe('q1'));
    expect(exam.activeSession.status).toBe('in-progress');
    expect(exam.activeSession.answers.q1).toBe('B');
  });

  it('advances an unanswered listening question on timeout without revealing its answer', async () => {
    const { wrapper, router, exam } = await mountRoute(
      '/exam/03/listening/start',
      listeningDocument
    );
    await clickButton(wrapper.element, 'Begin');
    await clickButton(wrapper.element, 'Begin');
    await clickButton(globalThis.document, 'Begin');
    expect(router.currentRoute.value.params.pageId).toBe('lq1');

    wrapper.findComponent(ExamHeader).vm.$emit('expired');
    await flushPromises();
    expect(router.currentRoute.value.params.pageId).toBe('lq2');
    expect(exam.activeSession.answers.lq1).toBeUndefined();
    expect(exam.activeSession.lockedQuestionIds.lq1).toBe(true);
    await vi.waitFor(() => expect(wrapper.find('[data-option="A"]').exists()).toBe(true));
    expect(wrapper.find('.option-item-apple.correct').exists()).toBe(false);
    expect(wrapper.find('.option-item-apple.incorrect').exists()).toBe(false);
    await wrapper.find('[data-option="A"]').trigger('click');
    expect(exam.activeSession.answers.lq2).toBe('A');

    expect(wrapper.text()).not.toContain('Questions');
    expect(wrapper.text()).not.toContain('Back');

    await router.push('/exam/03/listening/lq1');
    await flushPromises();
    expect(router.currentRoute.value.params.pageId).toBe('lq2');
  });
});
