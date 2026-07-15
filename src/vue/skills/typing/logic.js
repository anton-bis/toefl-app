export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export const DIFFICULTY_CONFIG = {
  beginner: {
    label: 'Beginner',
    desc: 'Short passages, no time limit',
    color: '#34C759',
    rate: 20
  },
  intermediate: {
    label: 'Intermediate',
    desc: 'Medium length, target ~35 WPM',
    color: '#FF9500',
    rate: 35
  },
  advanced: { label: 'Advanced', desc: 'Long articles, target ~45 WPM', color: '#FF5252', rate: 45 }
};

export function createCharacters(content = '') {
  return [...content].map(expected => ({ expected, status: 'untouched', input: '' }));
}

export function classifyError(input = '', expected = '') {
  if (expected === ' ' || (input === ' ' && expected !== ' ')) return 'spacing';
  if (expected.toLowerCase() === input.toLowerCase() && expected !== input) return 'capitalization';
  if (/[^\w\s]/.test(expected) || /[^\w\s]/.test(input)) return 'punctuation';
  return 'spelling';
}

export function computeMetrics(result) {
  const chars = result?.chars || [];
  const correctCount =
    result?.correctCount ?? chars.filter(char => char.status === 'correct').length;
  const incorrectCount =
    result?.incorrectCount ?? chars.filter(char => char.status === 'incorrect').length;
  const totalChars = result?.totalChars ?? chars.length;
  const minutes = Math.max((result?.timeSpent || 0) / 60000, 0.01);
  const errors = { spacing: 0, capitalization: 0, spelling: 0, punctuation: 0 };
  chars.forEach(char => {
    if (char.status === 'incorrect') errors[classifyError(char.input, char.expected)] += 1;
  });
  const round = value => Math.round(value * 10) / 10;
  return {
    rawWpm: round(totalChars / 5 / minutes),
    netWpm: round((totalChars - incorrectCount) / 5 / minutes),
    accuracy: round(totalChars ? (correctCount / totalChars) * 100 : 0),
    errors,
    totalChars,
    correctCount,
    incorrectCount
  };
}

export function maxSecondsFor(article) {
  const rate = DIFFICULTY_CONFIG[article?.difficulty]?.rate;
  return rate ? Math.ceil((article.wordCount / rate) * 60) : null;
}

export function estimateLabel(article) {
  const config = DIFFICULTY_CONFIG[article.difficulty];
  const seconds = config.rate
    ? Math.ceil((article.wordCount / config.rate) * 60)
    : Math.min(article.wordCount * 2, 300);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 ? `${minutes}m${seconds % 60}s` : `${minutes}min`;
}
