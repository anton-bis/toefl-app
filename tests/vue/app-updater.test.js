import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routing = vi.hoisted(() => ({ route: { name: 'home' } }));
vi.mock('vue-router', () => ({ useRoute: () => routing.route }));

import UpdateNotice from '../../src/vue/components/UpdateNotice.vue';
import { useUpdatesStore } from '../../src/vue/stores/updates.js';

let pinia;

function state(revision, status, extra = {}) {
  return {
    revision,
    status,
    version: '',
    description: '',
    progress: 0,
    error: '',
    retryAction: '',
    notice: false,
    installBlocked: false,
    installMode: 'automatic',
    ...extra
  };
}

beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  routing.route.name = 'home';
});

describe('desktop application update state', () => {
  it('keeps a newer event when the initial state snapshot arrives later', async () => {
    let onUpdateState;
    window.electronAPI = {
      onUpdateState: callback => {
        onUpdateState = callback;
        return vi.fn();
      },
      onContentState: () => vi.fn(),
      onContentActivated: () => vi.fn(),
      getUpdateState: async () => {
        onUpdateState(
          state(2, 'available', { version: '2.0.0', notice: true, description: 'Latest' })
        );
        return state(1, 'error', { error: 'stale', notice: true });
      },
      initializeContent: async () => ({ status: 'ready', ready: true, progress: 100 }),
      resumeBackgroundChecks: vi.fn()
    };
    const updates = useUpdatesStore();

    await updates.initialize();

    expect(updates.status).toBe('available');
    expect(updates.version).toBe('2.0.0');
    expect(updates.error).toBe('');
  });

  it('routes retry, download and install actions through authoritative snapshots', async () => {
    window.electronAPI = {
      downloadUpdate: vi.fn(async () => state(2, 'downloading', { notice: true })),
      retryUpdate: vi.fn(async () => state(3, 'available', { notice: true })),
      installUpdate: vi.fn(async () => state(4, 'installing', { notice: true }))
    };
    const updates = useUpdatesStore();
    updates.applyUpdateState(state(1, 'available', { notice: true }));

    await updates.downloadUpdate();
    await updates.retryUpdate();
    await updates.installUpdate();

    expect(window.electronAPI.downloadUpdate).toHaveBeenCalledOnce();
    expect(window.electronAPI.retryUpdate).toHaveBeenCalledOnce();
    expect(window.electronAPI.installUpdate).toHaveBeenCalledOnce();
    expect(updates.status).toBe('installing');
  });

  it('shows bounded actions, supports dismissal and stays hidden during exams', async () => {
    const updates = useUpdatesStore();
    updates.applyUpdateState(
      state(1, 'downloaded', {
        version: '2.0.0',
        notice: true,
        installBlocked: true
      })
    );
    const wrapper = mount(UpdateNotice, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Finish the current exam');
    expect(wrapper.get('.action').attributes('disabled')).toBeDefined();
    await wrapper.get('.dismiss').trigger('click');
    expect(wrapper.find('.update-notice').exists()).toBe(false);

    routing.route.name = 'exam';
    updates.applyUpdateState(state(2, 'error', { error: 'offline', notice: true }));
    const examWrapper = mount(UpdateNotice, { global: { plugins: [pinia] } });
    expect(examWrapper.find('.update-notice').exists()).toBe(false);
  });

  it('offers a retry after an update failure', async () => {
    window.electronAPI = {
      retryUpdate: vi.fn(async () => state(2, 'checking', { notice: true }))
    };
    const updates = useUpdatesStore();
    updates.applyUpdateState(
      state(1, 'error', { error: 'Download interrupted.', retryAction: 'download', notice: true })
    );
    const wrapper = mount(UpdateNotice, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Download interrupted.');
    await wrapper.get('.action').trigger('click');
    expect(window.electronAPI.retryUpdate).toHaveBeenCalledOnce();
  });

  it('downloads the manual macOS installer without opening a release page', async () => {
    window.electronAPI = {
      downloadUpdate: vi.fn(async () =>
        state(2, 'available', { notice: false, installMode: 'manual' })
      )
    };
    const updates = useUpdatesStore();
    updates.applyUpdateState(
      state(1, 'available', { version: '2.0.0', notice: true, installMode: 'manual' })
    );
    const wrapper = mount(UpdateNotice, { global: { plugins: [pinia] } });

    expect(wrapper.text()).toContain('Download macOS Installer');
    expect(wrapper.text()).toContain('right-click it and choose Open');
    await wrapper.get('.action').trigger('click');
    expect(window.electronAPI.downloadUpdate).toHaveBeenCalledOnce();
    expect(wrapper.find('.update-notice').exists()).toBe(false);
  });
});
