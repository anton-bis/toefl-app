import {
  removeLocalValue,
  readLocalJson,
  scheduleLocalJson,
  writeLocalJson
} from '../../platform/localPersistence.js';

export const VOCAB_SETTINGS_KEY = 'toefl:vocabulary:settings';
export const VOCAB_SESSION_KEY = 'toefl:vocabulary:session';

const DEFAULT_SETTINGS = {
  mode: 'random',
  reminderEnabled: true,
  reminderDate: '',
  preferredAccent: 'us'
};
const plainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const loadSettings = () => {
  const value = readLocalJson(VOCAB_SETTINGS_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...(plainObject(value) ? value : {}),
    mode: value?.mode === 'root' ? 'root' : 'random',
    preferredAccent: value?.preferredAccent === 'uk' ? 'uk' : 'us',
    reminderEnabled: value?.reminderEnabled !== false
  };
};
export const saveSettings = settings => writeLocalJson(VOCAB_SETTINGS_KEY, settings);
export const loadSession = () => {
  const value = readLocalJson(VOCAB_SESSION_KEY, null);
  if (!plainObject(value) || !Array.isArray(value.queueIds) || value.queueIds.length > 200)
    return null;
  const pages = [
    'subject-select',
    'set-list',
    'nine-grid',
    'card-learning',
    'audio-learning',
    'review'
  ];
  return {
    ...value,
    page: pages.includes(value.page) ? value.page : 'set-list',
    queueIds: value.queueIds
      .filter(
        entry =>
          typeof entry === 'string' ||
          (Array.isArray(entry) &&
            entry.length === 2 &&
            entry.every(item => typeof item === 'string'))
      )
      .slice(0, 200),
    unknownIds: Array.isArray(value.unknownIds)
      ? value.unknownIds.filter(id => typeof id === 'string').slice(0, 200)
      : [],
    currentIndex: Math.max(0, Number(value.currentIndex) || 0),
    currentSetIndex: Math.max(0, Number(value.currentSetIndex) || 0),
    nineGridPage: Math.max(0, Number(value.nineGridPage) || 0)
  };
};
export const saveSession = session => scheduleLocalJson(VOCAB_SESSION_KEY, session, 300);
export const clearSession = () => removeLocalValue(VOCAB_SESSION_KEY);
