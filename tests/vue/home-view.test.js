import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it } from 'vitest';
import HomeView from '../../src/vue/views/HomeView.vue';
import { useCatalogStore } from '../../src/vue/stores/catalog.js';
import { examStorageKey } from '../../src/vue/stores/exam.js';
import { installMemoryStorage, storeJson } from './helpers/storage.js';

async function mountHome(session = null) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const catalog = useCatalogStore(pinia);
  catalog.tests = [
    {
      tpoId: '09',
      description: 'Fixture',
      sections: { reading: { documentPath: 'reading.md' } }
    }
  ];
  if (session) storeJson(examStorageKey('09', 'reading'), session);
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
  return { wrapper, router };
}

async function clickReading(wrapper) {
  await wrapper.find('.module-cell .mod-btn').trigger('click');
  await flushPromises();
}

function session(status, pageId) {
  return { tpoId: '09', section: 'reading', status, pageId, updatedAt: 100 };
}

describe('HomeView practice actions', () => {
  beforeEach(() => installMemoryStorage());

  it('shows the TOEFL guide without a release history entry', async () => {
    const { wrapper } = await mountHome();
    const guideButton = wrapper
      .findAll('.sidebar-nav-item')
      .find(button => button.text().includes('TOEFL Guide'));

    expect(guideButton).toBeDefined();
    await guideButton.trigger('click');
    expect(wrapper.find('.modal-header').text()).toContain('TOEFL Guide');
    expect(wrapper.find('.modal-body').text()).toContain('CEFR alignment');
    expect(wrapper.find('.modal-body').text()).toContain('Score comparison');
  });

  it('starts an untouched section directly without presenting disabled choices', async () => {
    const { wrapper, router } = await mountHome();
    await clickReading(wrapper);
    expect(router.currentRoute.value.path).toBe('/exam/09/reading/start');
    expect(wrapper.find('.practice-box').exists()).toBe(false);
  });

  it('offers continue or restart for an unfinished attempt', async () => {
    const { wrapper, router } = await mountHome(session('in-progress', 'question-7'));
    await clickReading(wrapper);
    expect(wrapper.text()).toContain('Continue Attempt');
    expect(wrapper.text()).toContain('Restart Section');
    expect(wrapper.text()).not.toContain('Start New');
    await wrapper.find('.practice-option-card.active').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/exam/09/reading/question-7');
  });

  it('offers results or a confirmed retake for a completed attempt', async () => {
    const { wrapper, router } = await mountHome(session('completed', 'results'));
    await clickReading(wrapper);
    expect(wrapper.text()).toContain('View Results');
    expect(wrapper.text()).toContain('Retake Section');
    await wrapper.find('.practice-option-card.active').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/exam/09/reading/results?mode=report');
  });

  it('does not erase an unfinished attempt until restart is confirmed', async () => {
    const { wrapper, router } = await mountHome(session('in-progress', 'question-7'));
    await clickReading(wrapper);
    await wrapper.find('.practice-option-card.danger').trigger('click');
    expect(wrapper.text()).toContain('permanently deletes');
    expect(localStorage.getItem(examStorageKey('09', 'reading'))).not.toBeNull();
    await wrapper.find('.practice-restart').trigger('click');
    await flushPromises();
    expect(localStorage.getItem(examStorageKey('09', 'reading'))).toBeNull();
    expect(router.currentRoute.value.path).toBe('/exam/09/reading/start');
  });
});
