export function computeReadingScores(correct1, total1, correct2, total2) {
  const p1 = total1 > 0 ? correct1 / total1 : 0;
  const p2 = total2 > 0 ? correct2 / total2 : 0;
  const total_reading_30 = 30 * (p1 * 0.4 + p2 * 0.6);
  const reading_120 = Math.floor(total_reading_30);
  const value6 = (total_reading_30 / 30) * 6;
  // 最近的 0.5 分段，遇到等距点向上取整
  const six_score = Math.floor(value6 * 2 + 0.5) / 2;
  return { total_reading_30, reading_120, value6, six_score };
}

export function formatReadingOutput(reading_120, six_score) {
  return `Reading 分数 ${reading_120} / ${six_score}`;
}
