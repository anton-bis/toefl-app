function wholeSeconds(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function twoDigits(value) {
  return String(value).padStart(2, '0');
}

export function formatMinutesSeconds(seconds) {
  const value = wholeSeconds(seconds);
  return `${twoDigits(Math.floor(value / 60))}:${twoDigits(value % 60)}`;
}

export function formatHoursMinutesSeconds(seconds) {
  const value = wholeSeconds(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(value % 60)}`;
}
