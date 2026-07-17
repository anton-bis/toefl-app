export const SUBJECTS = ['reading', 'listening', 'speaking', 'writing'];
export const SUBJECT_LABELS = {
  reading: 'Reading',
  listening: 'Listening',
  speaking: 'Speaking',
  writing: 'Writing'
};

export function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
export const RECOMMENDED_ROOTS = [
  'struct',
  'aud',
  'rupt',
  'spect',
  'grad',
  'mut',
  'facere',
  'videre',
  'cord',
  'habilis',
  'tenere',
  'lect',
  'vertere',
  'pict',
  'duct',
  'port',
  'cap',
  'fer',
  'press',
  'form',
  'sign',
  'ven',
  'spir',
  'tract',
  'dare'
];

const QUIZ_RATIOS = {
  reading: { 'lookup-zh': 0.5, 'lookup-en': 0.3, spell: 0.2 },
  writing: { spell: 0.45, 'lookup-en': 0.3, 'lookup-zh': 0.25 },
  listening: { 'audio-zh': 1 },
  speaking: { 'audio-zh': 1 }
};
const REVIEW_RATIOS = {
  reading: { 'lookup-zh': 0.4, 'lookup-en': 0.35, spell: 0.25 },
  writing: { spell: 0.4, 'lookup-en': 0.35, 'lookup-zh': 0.25 },
  listening: { 'audio-zh': 0.5, 'lookup-zh': 0.25, 'lookup-en': 0.25 },
  speaking: { 'audio-zh': 0.5, 'lookup-zh': 0.25, 'lookup-en': 0.25 }
};

export function scheduleReview(quality, previous = {}, today = new Date()) {
  let ef = previous.ef || 2.5;
  let interval = previous.interval || 0;
  let repetitions = previous.repetitions || 0;
  if (quality >= 3) {
    interval = repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval * ef);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }
  ef = Math.max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const next = new Date(today);
  next.setDate(next.getDate() + interval);
  return {
    ef: Math.round(ef * 100) / 100,
    interval,
    repetitions,
    nextReview: dateKey(next),
    lastQ: quality
  };
}

export function pickWeighted(ratios, random = Math.random()) {
  let total = 0;
  for (const [type, weight] of Object.entries(ratios)) {
    total += weight;
    if (random <= total) return type;
  }
  return Object.keys(ratios)[0];
}

export const pickQuizType = (subject, review = false, random) =>
  pickWeighted((review ? REVIEW_RATIOS : QUIZ_RATIOS)[subject] || QUIZ_RATIOS.reading, random);

export function wordMeaning(word) {
  const value = word?.pos?.[0]?.translation || word?.pos?.[0]?.chinese || word?.word || '';
  return value.split(/[；;]/).slice(0, 2).join('；');
}

export function makeOptions(correct, queue, bank, mode = 'meaning', random = Math.random) {
  const unique = new Map();
  [...queue, ...bank].forEach(word => {
    if (word.id !== correct.id) unique.set(word.id, word);
  });
  const distractors = [...unique.values()].sort(() => random() - 0.5).slice(0, 3);
  return [correct, ...distractors]
    .map(word => ({
      id: word.id,
      text: mode === 'meaning' ? wordMeaning(word) : word.word,
      correct: word.id === correct.id
    }))
    .sort(() => random() - 0.5);
}

function extractEtymologyPart(etymology, key) {
  if (!etymology || typeof etymology === 'string') return null;
  const part = etymology[key];
  if (typeof part === 'string') return part.trim() || null;
  return part && typeof part === 'object' ? (part.form || part.text || '').trim() || null : null;
}

export function buildRootCategories(words) {
  const buckets = { prefix: {}, root: {}, suffix: {} };
  const other = [];
  words.forEach(word => {
    let found = false;
    Object.keys(buckets).forEach(key => {
      const title = extractEtymologyPart(word.etymology, key);
      if (!title) return;
      found = true;
      (buckets[key][title] ||= { title, words: [] }).words.push(word);
    });
    if (!found) other.push(word);
  });
  const groups = key =>
    Object.values(buckets[key])
      .filter(group => group.words.length >= 2)
      .sort((a, b) => b.words.length - a.words.length);
  const roots = groups('root');
  const recommended = roots.filter(group => RECOMMENDED_ROOTS.includes(group.title)).slice(0, 25);
  const more = roots.filter(group => !recommended.includes(group));
  const category = (id, title, values) => ({
    id,
    type: 'category',
    title,
    groups: values,
    groupCount: values.length,
    wordCount: values.reduce((sum, group) => sum + group.words.length, 0)
  });
  return [
    category('prefix', 'Prefixes', groups('prefix')),
    category('suffix', 'Suffixes', groups('suffix')),
    { ...category('root', 'Roots', roots), recommendedGroups: recommended, moreGroups: more },
    { id: 'other', type: 'category', title: 'Other', words: other, wordCount: other.length }
  ];
}

export function dueWordIds(progress, subject, wordIds, today = dateKey()) {
  const allowed = new Set(wordIds);
  const seen = new Set();
  const due = [];
  Object.values(progress[subject] || {}).forEach(set => {
    Object.entries(set.words || {}).forEach(([id, record]) => {
      if (
        !seen.has(id) &&
        allowed.has(id) &&
        record.nextReview &&
        record.nextReview <= today &&
        record.lastQ < 5
      )
        due.push(id);
      seen.add(id);
    });
  });
  return due;
}
