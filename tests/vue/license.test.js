import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ActivationModal from '../../src/vue/components/ActivationModal.vue';
import HomeView from '../../src/vue/views/HomeView.vue';
import { isOfficialTest } from '../../src/vue/platform/licenseRules.js';
import { useCatalogStore } from '../../src/vue/stores/catalog.js';
import { useLicenseStore } from '../../src/vue/stores/license.js';

function installLicenseApi(overrides = {}) {
  const listeners = [];
  const api = {
    getState: vi.fn().mockResolvedValue({ ok: true, state: { status: 'none' } }),
    activate: vi.fn(),
    refresh: vi.fn().mockResolvedValue({ ok: true, state: { status: 'none' } }),
    unbind: vi.fn().mockResolvedValue({ ok: true, state: { status: 'none' } }),
    onState: vi.fn(callback => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index >= 0) listeners.splice(index, 1);
      };
    }),
    ...overrides
  };
  window.electronAPI = { license: api };
  return { api, listeners };
}

describe('license rules', () => {
  it('treats date-id tpoIds as official (paid)', () => {
    expect(isOfficialTest('2026-02-01')).toBe(true);
    expect(isOfficialTest('2026-02-01 (2)')).toBe(true);
    expect(isOfficialTest('2026-02-01 (3)')).toBe(true);
    expect(isOfficialTest('09')).toBe(false);
    expect(isOfficialTest('')).toBe(false);
  });
});

describe('license store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('reports unavailable and ready without the electron api', async () => {
    const store = useLicenseStore();
    await store.initialize();
    expect(store.status).toBe('unavailable');
    expect(store.ready).toBe(true);
    expect(store.contentLocked).toBe(false);
  });

  it('maps the public state through applyState', () => {
    const store = useLicenseStore();
    store.applyState({
      status: 'active',
      deviceId: 'd1',
      deviceCount: 1,
      devices: [{ deviceId: 'd1', current: true }],
      expiresAt: 123
    });
    expect(store.activated).toBe(true);
    expect(store.contentLocked).toBe(false);
    expect(store.deviceId).toBe('d1');
    expect(store.deviceCount).toBe(1);
  });

  it('activates through the ipc api', async () => {
    const { api } = installLicenseApi({
      activate: vi.fn().mockResolvedValue({ ok: true, state: { status: 'active', deviceId: 'd1' } })
    });
    const store = useLicenseStore();
    const result = await store.activate('AB12-CD34-EF56-GH78');
    expect(api.activate).toHaveBeenCalledWith('AB12-CD34-EF56-GH78');
    expect(result.ok).toBe(true);
    expect(store.activated).toBe(true);
  });

  it('surfaces activation errors', async () => {
    installLicenseApi({
      activate: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'LICENSE:DEVICE_LIMIT', message: '该序列号已达到 2 台设备上限' }
      })
    });
    const store = useLicenseStore();
    const result = await store.activate('AB12-CD34-EF56-GH78');
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe('该序列号已达到 2 台设备上限');
  });

  it('contentLocked covers none and locked only', () => {
    const store = useLicenseStore();
    store.applyState({ status: 'none' });
    expect(store.contentLocked).toBe(true);
    store.applyState({ status: 'locked' });
    expect(store.contentLocked).toBe(true);
    store.applyState({ status: 'active' });
    expect(store.contentLocked).toBe(false);
  });

  it('unbind clears the local state through the ipc api', async () => {
    const { api } = installLicenseApi({
      unbind: vi.fn().mockResolvedValue({ ok: true, state: { status: 'none' } })
    });
    const store = useLicenseStore();
    store.applyState({ status: 'active', deviceId: 'd1' });
    const result = await store.unbind();
    expect(api.unbind).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(store.status).toBe('none');
  });
});

describe('ActivationModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    installLicenseApi();
  });

  async function mountModal() {
    const wrapper = mount(ActivationModal, { global: { plugins: [createPinia()] } });
    await flushPromises();
    return wrapper;
  }

  it('formats the serial input with dashes', async () => {
    const wrapper = await mountModal();
    const input = wrapper.find('.serial-input');
    await input.setValue('ab12cd34ef56gh78');
    expect(input.element.value).toBe('AB12-CD34-EF56-GH78');
  });

  it('activates and emits activated on success', async () => {
    const { api } = installLicenseApi({
      activate: vi.fn().mockResolvedValue({ ok: true, state: { status: 'active' } })
    });
    const wrapper = await mountModal();
    await wrapper.find('.serial-input').setValue('AB12-CD34-EF56-GH78');
    await wrapper.find('.practice-restart').trigger('click');
    await flushPromises();
    expect(api.activate).toHaveBeenCalledWith('AB12-CD34-EF56-GH78');
    expect(wrapper.emitted('activated')).toBeTruthy();
  });

  it('shows the server error message on failure', async () => {
    installLicenseApi({
      activate: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'LICENSE:DEVICE_LIMIT', message: '该序列号已达到 2 台设备上限' }
      })
    });
    const wrapper = await mountModal();
    await wrapper.find('.serial-input').setValue('AB12-CD34-EF56-GH78');
    await wrapper.find('.practice-restart').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('该序列号已达到 2 台设备上限');
  });

  it('does not call the api for an empty code', async () => {
    const { api } = installLicenseApi();
    const wrapper = await mountModal();
    await wrapper.find('.practice-restart').trigger('click');
    await flushPromises();
    expect(api.activate).not.toHaveBeenCalled();
  });
});

describe('HomeView content unlock', () => {
  beforeEach(() => setActivePinia(createPinia()));

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
    const license = useLicenseStore(pinia);
    return { wrapper, router, license };
  }

  async function openOfficialPanel(wrapper) {
    const button = wrapper
      .findAll('.sidebar-nav-item')
      .find(candidate => candidate.text().includes('Official Tests'));
    await button.trigger('click');
    await flushPromises();
  }

  it('locks official tests when not activated', async () => {
    const { wrapper, license } = await mountHome();
    license.applyState({ status: 'none' });
    await flushPromises();
    expect(wrapper.findAll('.mod-btn.locked').length).toBe(0);
    await openOfficialPanel(wrapper);
    expect(wrapper.findAll('.mod-btn.locked').length).toBeGreaterThan(0);
    expect(wrapper.find('.lock-mark').exists()).toBe(true);
  });

  it('opens the activation modal from a locked official test', async () => {
    const { wrapper, license } = await mountHome();
    license.applyState({ status: 'none' });
    await flushPromises();
    await openOfficialPanel(wrapper);
    await wrapper.find('.mod-btn.locked').trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-card').text()).toContain('激活官方真题');
  });

  it('does not lock practice tests', async () => {
    const { wrapper, license } = await mountHome();
    license.applyState({ status: 'none' });
    await flushPromises();
    expect(wrapper.findAll('.mod-btn.locked').length).toBe(0);
    expect(wrapper.find('.mod-btn.available').exists()).toBe(true);
  });

  it('unlocks official tests when activated and shows the referral banner', async () => {
    const { wrapper, router, license } = await mountHome();
    license.applyState({ status: 'active' });
    await flushPromises();
    expect(wrapper.find('.referral-banner').exists()).toBe(true);
    await openOfficialPanel(wrapper);
    await wrapper.find('.mod-btn.available').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/exam/2026-02-01/reading/start');
  });
});
