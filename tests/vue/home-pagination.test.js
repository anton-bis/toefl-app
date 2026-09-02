import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it } from 'vitest';
import HomeView from '../../src/vue/views/HomeView.vue';
import { homeState } from '../../src/vue/platform/homeState.js';
import { useCatalogStore } from '../../src/vue/stores/catalog.js';
import { installMemoryStorage } from './helpers/storage.js';

function testsFor(prefix, count, official = false) {
  return Array.from({ length: count }, (_, index) => {
    const id = official
      ? `2026-02-${String(index + 1).padStart(2, '0')}`
      : `${prefix}-${String(index + 1).padStart(2, '0')}`;
    return {
      tpoId: id,
      description: `${prefix} ${index + 1}`,
      sections: { reading: { documentPath: 'r.md' } }
    };
  });
}

async function mountHome(tests) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const catalog = useCatalogStore(pinia);
  catalog.tests = tests;
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

describe('HomeView list pagination', () => {
  beforeEach(() => installMemoryStorage());

  it('pages practice tests at 10 per page with correct total', async () => {
    homeState.panel = 'mock';
    const wrapper = await mountHome(testsFor('TPO', 11));
    const rows = () => wrapper.findAll('tbody tr');
    expect(rows()).toHaveLength(10);
    expect(wrapper.find('.pagination-info').text()).toContain('第 1 / 2 页 · 共 11 套');
    wrapper.unmount();
  });

  it('navigates practice pages and clamps at the last page', async () => {
    homeState.panel = 'mock';
    const wrapper = await mountHome(testsFor('TPO', 11));
    const next = wrapper.findAll('.pagination-btn')[1];
    const prev = wrapper.findAll('.pagination-btn')[0];
    expect(prev.attributes('disabled')).toBeDefined();
    expect(next.attributes('disabled')).toBeUndefined();
    await next.trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
    expect(wrapper.find('.pagination-info').text()).toContain('第 2 / 2 页');
    expect(next.attributes('disabled')).toBeDefined();
    expect(prev.attributes('disabled')).toBeUndefined();
    await prev.trigger('click');
    expect(wrapper.find('.pagination-info').text()).toContain('第 1 / 2 页');
    wrapper.unmount();
  });

  it('pages official tests independently from practice tests', async () => {
    homeState.panel = 'mock';
    const wrapper = await mountHome([
      ...testsFor('TPO', 12),
      ...testsFor('2026-02', 11, true)
    ]);
    const next = wrapper.findAll('.pagination-btn')[1];
    await next.trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.find('.pagination-info').text()).toContain('第 2 / 2 页 · 共 12 套');

    const officialNav = wrapper
      .findAll('.sidebar-nav-item')
      .find(node => node.text().includes('Official Tests'));
    await officialNav.trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(10);
    expect(wrapper.find('.pagination-info').text()).toContain('第 1 / 2 页 · 共 11 套');
    wrapper.unmount();
  });

  it('keeps both prev and next disabled on a single page of 9', async () => {
    homeState.panel = 'mock';
    const wrapper = await mountHome(testsFor('TPO', 9));
    expect(wrapper.findAll('tbody tr')).toHaveLength(9);
    expect(wrapper.find('.pagination-info').text()).toContain('第 1 / 1 页 · 共 9 套');
    const [prev, next] = wrapper.findAll('.pagination-btn');
    expect(prev.attributes('disabled')).toBeDefined();
    expect(next.attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });
});
