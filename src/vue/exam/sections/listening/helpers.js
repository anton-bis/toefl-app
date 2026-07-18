export function listeningResponseSeconds(task) {
  return task?.type === 'academic-talk' ? 30 : 20;
}

export function segmentDuration(media, nativeDuration = 0) {
  const start = Number(media?.start || 0);
  const end = Number(media?.end);
  return Number.isFinite(end) ? Math.max(0, end - start) : Math.max(0, nativeDuration - start);
}
