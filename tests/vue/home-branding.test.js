import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it } from 'vitest';
import HomeView from '../../src/vue/views/HomeView.vue';
import ExamHeader from '../../src/vue/exam/shared/ExamHeader.vue';
import InstructionPage from '../../src/vue/exam/shared/InstructionPage.vue';
import ResultsPage from '../../src/vue/exam/shared/ResultsPage.vue';
import { useCatalogStore } from '../../src/vue/stores/catalog.js';
import { homeState } from '../../src/vue/platform/homeState.js';

async function mountHome() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const catalog = useCatalogStore(pinia);
  catalog.tests = [
    { tpoId: '09', description: 'Practice', sections: { reading: { documentPath: 'r.md' } } },
    { tpoId: '2026-02-01', description: 'Official', sections: { reading: { documentPath: 'r.md' } } }
  ];
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/exam/:tpoId/:section/:pageId', component: { template: '<div>Exam</div>' } }
    ]
  });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(HomeView, { global: { plugins: [pinia, router] } });
  return wrapper;
}

describe('home branding and navigation state', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    homeState.panel = 'mock';
    homeState.scrollTop = 0;
  });

  it('renders the Just Tofu home logo', async () => {
    const wrapper = await mountHome();
    expect(wrapper.find('.logo-text').text()).toBe('Just Tofu');
    wrapper.unmount();
  });

  it('renders the Tofu exam header brand', () => {
    const wrapper = mount(ExamHeader, { props: { questionNumber: 1, totalQuestions: 5 } });
    expect(wrapper.find('.exam-header__brand').text()).toContain('Tofu');
  });

  it('renders the Tofu brand on instruction (start and intro) pages', () => {
    const wrapper = mount(InstructionPage, {
      props: { document: { section: 'reading' }, page: { id: 'start', type: 'start' }, task: null }
    });
    expect(wrapper.find('.exam-header__brand').text()).toContain('Tofu');
  });

  it('renders the Tofu brand on the results page', () => {
    const wrapper = mount(ResultsPage, {
      props: { document: { section: 'reading', modules: [] }, session: { answers: {} } }
    });
    expect(wrapper.find('.exam-header__brand').text()).toContain('Tofu');
  });

  it('exposes the default home state', () => {
    expect(homeState.panel).toBe('mock');
    expect(homeState.scrollTop).toBe(0);
  });

  it('restores the previously selected home panel', async () => {
    homeState.panel = 'real';
    const wrapper = await mountHome();
    await flushPromises();
    expect(wrapper.find('section.panel.active h2').text()).toBe('Official Tests');
    wrapper.unmount();
  });

  it('persists the selected panel on unmount', async () => {
    const wrapper = await mountHome();
    const official = wrapper
      .findAll('.sidebar-nav-item')
      .find(candidate => candidate.text().includes('Official Tests'));
    await official.trigger('click');
    await flushPromises();
    wrapper.unmount();
    expect(homeState.panel).toBe('real');
  });
});
