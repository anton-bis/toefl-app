import { resolveAssetUrl } from '../../platform/contentRepository.js';

let currentAudio;

export function stopWordAudio() {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.removeAttribute?.('src');
  currentAudio.load?.();
  currentAudio = undefined;
}

export function audioPath(word, accent = 'us') {
  const relative = `assets/audio/vocab/${word}_${accent}.mp3`;
  return resolveAssetUrl(relative);
}

export function playWord(word, accent = 'us') {
  if (typeof Audio === 'undefined') return Promise.resolve(false);
  stopWordAudio();
  currentAudio = new Audio(audioPath(word, accent));
  currentAudio.preload = 'auto';
  return currentAudio
    .play()
    .then(() => true)
    .catch(() => false);
}
