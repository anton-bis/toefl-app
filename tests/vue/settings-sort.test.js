import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { SETTINGS_STORAGE_KEY, useSettingsStore } from '../../src/vue/stores/settings.js';
import { installMemoryStorage } from './helpers/storage.js';

describe('official sort preference', () => {
  beforeEach(() => {
    installMemoryStorage();
    setActivePinia(createPinia());
  });

  it('defaults to newest first and persists a switch to oldest first', () => {
    const settings = useSettingsStore();
    expect(settings.officialSort).toBe('desc');

    settings.setOfficialSort('asc');
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)).officialSort).toBe('asc');

    setActivePinia(createPinia());
    expect(useSettingsStore().officialSort).toBe('asc');
  });

  it('falls back to newest first for an unknown stored value', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ officialSort: 'sideways' }));
    setActivePinia(createPinia());
    expect(useSettingsStore().officialSort).toBe('desc');
  });
});
