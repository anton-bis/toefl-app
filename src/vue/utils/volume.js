export function normalizeVolume(value, fallback = 0.8) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}
