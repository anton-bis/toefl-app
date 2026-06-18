export function computeListeningScores(correct, total) {
  const ratio = total > 0 ? correct / total : 0;
  const listening30 = Math.round(ratio * 30);
  const value6 = (listening30 / 30) * 6;
  const sixScore = Math.floor(value6 * 2 + 0.5) / 2;
  return { correct, total, ratio, listening30, sixScore };
}

export function formatListeningOutput(listening30, sixScore) {
  return `Listening 分数 ${listening30} / ${sixScore}`;
}
