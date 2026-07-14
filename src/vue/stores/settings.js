import { defineStore } from 'pinia';
import { readLocalJson, writeLocalJson } from '../platform/localPersistence.js';

export const SETTINGS_STORAGE_KEY = 'toefl:settings';
const SECTIONS = ['reading', 'listening', 'writing', 'speaking'];

function clampVolume(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0.8;
}

function defaults() {
  return {
    volumes: Object.fromEntries(SECTIONS.map(section => [section, 0.8]))
  };
}

function loadSettings() {
  const fallback = defaults();
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const saved = readLocalJson(SETTINGS_STORAGE_KEY, {});
    return {
      ...fallback,
      ...(saved || {}),
      volumes: {
        ...fallback.volumes,
        ...Object.fromEntries(
          SECTIONS.map(section => [section, clampVolume(saved?.volumes?.[section])])
        )
      }
    };
  } catch {
    return fallback;
  }
}

export const useSettingsStore = defineStore('settings', {
  state: loadSettings,
  getters: {
    volume: state => section => state.volumes[section] ?? 0.8
  },
  actions: {
    setVolume(section, value) {
      this.volumes[String(section).toLowerCase()] = clampVolume(value);
      this.persist();
    },
    applyVolume(media, section) {
      if (media) media.volume = this.volume(section);
    },
    persist() {
      writeLocalJson(SETTINGS_STORAGE_KEY, { volumes: this.volumes });
    }
  }
});
