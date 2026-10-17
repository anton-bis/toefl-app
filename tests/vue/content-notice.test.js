import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContentNotice from '../../src/vue/components/ContentNotice.vue';
import { useUpdatesStore } from '../../src/vue/stores/updates.js';

async function mountNotice(path = '/') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/exam', name: 'exam', component: { template: '<div />' } }
    ]
  });
  await router.push(path);
  await router.isReady();
  return mount(ContentNotice, { global: { plugins: [pinia, router] } });
}

describe('content update notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the update message, hides itself after six seconds, and can be dismissed', async () => {
    const wrapper = await mountNotice();
    const updates = useUpdatesStore();

    updates.showContentNotice('题库已更新：最新 09-19（共 32 套真题）');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('题库已更新：最新 09-19（共 32 套真题）');

    vi.advanceTimersByTime(6000);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.content-notice').exists()).toBe(false);

    updates.showContentNotice('题库已更新');
    await wrapper.vm.$nextTick();
    await wrapper.get('.content-notice__dismiss').trigger('click');
    expect(wrapper.find('.content-notice').exists()).toBe(false);
    wrapper.unmount();
  });

  it('stays hidden during an exam route', async () => {
    const wrapper = await mountNotice('/exam');
    const updates = useUpdatesStore();

    updates.showContentNotice('题库已更新');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.content-notice').exists()).toBe(false);
    wrapper.unmount();
  });
});
