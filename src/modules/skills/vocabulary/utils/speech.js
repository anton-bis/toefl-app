var audioCache = {};

export function playWord(word, accent) {
  var key = word + '_' + (accent || 'us');
  if (audioCache[key]) {
    audioCache[key].currentTime = 0;
    audioCache[key].play().catch(function () {});
    return;
  }
  var audioPath = 'assets/audio/vocab/' + key + '.mp3';
  if (window.location.protocol === 'file:' && typeof window.electronAPI !== 'undefined') {
    audioPath = '../' + audioPath;
  }
  var audio = new Audio(audioPath);
  audio.preload = 'auto';
  audioCache[key] = audio;
  audio.play().catch(function () {
    // silently fail if audio file not found
  });
}

export function preloadWord(word) {
  ['us', 'uk'].forEach(function (accent) {
    var key = word + '_' + accent;
    if (!audioCache[key]) {
      var audio = new Audio('assets/audio/vocab/' + key + '.mp3');
      audio.preload = 'auto';
      audioCache[key] = audio;
    }
  });
}
