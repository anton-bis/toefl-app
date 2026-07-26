export function listeningResponseSeconds(task) {
  return task?.type === 'academic-talk' ? 30 : 20;
}

export function segmentDuration(media, nativeDuration = 0) {
  const start = Number(media?.start || 0);
  const end = Number(media?.end);
  const duration = Number(nativeDuration);
  return Number.isFinite(end)
    ? Math.max(0, end - start)
    : Number.isFinite(duration)
      ? Math.max(0, duration - start)
      : 0;
}
