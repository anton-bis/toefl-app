import { defineComponent } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExamView from '../../src/vue/views/ExamView.vue';
import { useCatalogStore } from '../../src/vue/stores/catalog.js';
import { useExamStore } from '../../src/vue/stores/exam.js';
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
async function mountRoute(path) {
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
  catalog.loadDocument = vi.fn(async () => document);
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
  });
});
