import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/vue/App.vue';
import ContentStartup from '../../src/vue/components/ContentStartup.vue';
import { useCatalogStore } from '../../src/vue/stores/catalog.js';
import { useUpdatesStore } from '../../src/vue/stores/updates.js';

describe('question-bank startup experience', () => {
  it('shows accessible download progress', () => {
    const wrapper = mount(ContentStartup, {
      props: { status: 'downloading', progress: 19 }
    });

    expect(wrapper.text()).toContain('Downloading the question bank');
    expect(wrapper.text()).toContain('19%');
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('19');
    expect(wrapper.get('.content-startup__progress span').attributes('style')).toContain(
      'width: 19%'
    );
  });

  it('offers a clear retry without exposing a raw loading page', async () => {
    const wrapper = mount(ContentStartup, {
      props: { status: 'error', error: 'Could not read installed content.' }
    });

    expect(wrapper.get('[role="alert"]').text()).toContain('Question bank unavailable');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });
});

describe('question catalog recovery', () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it('retries catalog opening without re-downloading ready content', async () => {
    const catalog = useCatalogStore();
    const updates = useUpdatesStore();
    const retryContent = vi.spyOn(updates, 'retryContent');
    catalog.refreshCatalog = vi.fn().mockRejectedValueOnce(new Error('Protocol request failed'));

    const wrapper = mount(App, {
      global: {
        plugins: [pinia],
        provide: { storageReady: ref(true) },
        stubs: { RouterView: { template: '<div data-test="router-view" />' } }
      }
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Question bank unavailable');
    expect(wrapper.text()).toContain('Protocol request failed');
    expect(wrapper.text()).not.toContain('Something Went Wrong');

    catalog.refreshCatalog.mockImplementationOnce(async () => {
      catalog.catalogLoaded = true;
    });
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(retryContent).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="router-view"]').exists()).toBe(true);
  });
});
