import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsView from '../../src/vue/views/SettingsView.vue';
import { useLicenseStore } from '../../src/vue/stores/license.js';

function installLicenseApi(overrides = {}) {
  const api = {
    getState: vi.fn().mockResolvedValue({ ok: true, state: { status: 'none' } }),
    activate: vi.fn(),
    refresh: vi.fn(),
    unbind: vi.fn(),
    onState: vi.fn(() => () => {}),
    ...overrides
  };
  window.electronAPI = { license: api };
  return api;
}

async function mountSettings() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/settings', name: 'settings', component: SettingsView }
    ]
  });
  await router.push('/settings');
  await router.isReady();
  const wrapper = mount(SettingsView, { global: { plugins: [pinia, router] } });
  const store = useLicenseStore(pinia);
  await flushPromises();
  return { wrapper, store, router };
}

function findButton(wrapper, text) {
  return wrapper.findAll('.settings-btn').find(button => button.text().includes(text));
}

describe('SettingsView license management', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows activated status, expiry and the bound device list', async () => {
    installLicenseApi();
    const { wrapper, store } = await mountSettings();
    store.applyState({
      status: 'active',
      deviceId: 'device-1',
      expiresAt: Date.now() + 86_400_000,
      devices: [
        { deviceId: 'device-1', current: true },
        { deviceId: 'device-2' }
      ],
      deviceCount: 2
    });
    await flushPromises();
    expect(wrapper.text()).toContain('已激活');
    expect(wrapper.text()).toContain('2 / 2');
    expect(wrapper.text()).toContain('本机 · device-1');
    expect(wrapper.text()).toContain('设备 2 · device-2');
    expect(wrapper.text()).toContain('解绑本机');
  });

  it('offers activation when not activated', async () => {
    installLicenseApi();
    const { wrapper, store } = await mountSettings();
    store.applyState({ status: 'none' });
    await flushPromises();
    expect(wrapper.text()).toContain('未激活');
    expect(wrapper.find('.settings-btn--primary').text()).toBe('激活');
  });

  it('unbinds the current device after confirmation', async () => {
    const api = installLicenseApi({
      unbind: vi.fn().mockResolvedValue({ ok: true, state: { status: 'none' } })
    });
    vi.stubGlobal('confirm', () => true);
    const { wrapper, store } = await mountSettings();
    store.applyState({
      status: 'active',
      deviceId: 'device-1',
      deviceCount: 1,
      devices: [{ deviceId: 'device-1', current: true }]
    });
    await flushPromises();
    await findButton(wrapper, '解绑本机').trigger('click');
    await flushPromises();
    expect(api.unbind).toHaveBeenCalled();
    expect(store.status).toBe('none');
    expect(wrapper.text()).toContain('本机已解绑');
  });

  it('keeps the device when unbind is cancelled', async () => {
    const api = installLicenseApi({
      unbind: vi.fn().mockResolvedValue({ ok: true, state: { status: 'none' } })
    });
    vi.stubGlobal('confirm', () => false);
    const { wrapper, store } = await mountSettings();
    store.applyState({ status: 'active', deviceId: 'device-1', deviceCount: 1 });
    await flushPromises();
    await findButton(wrapper, '解绑本机').trigger('click');
    await flushPromises();
    expect(api.unbind).not.toHaveBeenCalled();
    expect(store.activated).toBe(true);
  });

  it('surfaces an unbind error', async () => {
    installLicenseApi({
      unbind: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'LICENSE:NETWORK', message: '无法连接服务器，请检查网络后重试' }
      })
    });
    vi.stubGlobal('confirm', () => true);
    const { wrapper, store } = await mountSettings();
    store.applyState({ status: 'active', deviceId: 'device-1', deviceCount: 1 });
    await flushPromises();
    await findButton(wrapper, '解绑本机').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('无法连接服务器');
  });

  it('refreshes the license on demand', async () => {
    const api = installLicenseApi({
      refresh: vi.fn().mockResolvedValue({ ok: true, state: { status: 'active' } })
    });
    const { wrapper, store } = await mountSettings();
    store.applyState({ status: 'active' });
    await flushPromises();
    await findButton(wrapper, '检查许可证').trigger('click');
    await flushPromises();
    expect(api.refresh).toHaveBeenCalled();
    expect(wrapper.text()).toContain('已检查许可证状态');
  });

  it('opens the activation modal from settings', async () => {
    installLicenseApi();
    const { wrapper, store } = await mountSettings();
    store.applyState({ status: 'none' });
    await flushPromises();
    await wrapper.find('.settings-btn--primary').trigger('click');
    await flushPromises();
    expect(wrapper.find('.modal-card').text()).toContain('激活官方真题');
  });

  it('shows a desktop-only hint in browser mode', async () => {
    delete window.electronAPI;
    const { wrapper } = await mountSettings();
    expect(wrapper.text()).toContain('序列号激活仅适用于桌面版');
    expect(wrapper.find('.settings-btn--primary').exists()).toBe(false);
  });

  it('shows a gear icon and returns to home from the back button', async () => {
    const { wrapper, router } = await mountSettings();
    expect(wrapper.find('.settings-header h1 i.fa-cog').exists()).toBe(true);
    expect(wrapper.find('.settings-back').text()).toContain('Home');
    await wrapper.find('.settings-back').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('home');
  });
});
