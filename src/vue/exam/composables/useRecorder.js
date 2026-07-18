import { onBeforeUnmount, ref, shallowRef, toValue } from 'vue';
import { recordingRepository as defaultRepository } from '../../platform/dataRepository.js';

export function selectRecordingMimeType(Recorder = globalThis.MediaRecorder) {
  if (!Recorder) return '';
  const supported =
    typeof Recorder.isTypeSupported === 'function'
      ? value => Recorder.isTypeSupported(value)
      : () => true;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(supported) || '';
}

export function useRecorder({ sessionId, repository = defaultRepository } = {}) {
  const status = ref('idle');
  const error = shallowRef(null);
  const blob = shallowRef(null);
  const playing = ref(false);
  let stream;
  let streamPromise;
  let recorder;
  let chunks = [];
  let stopPromise;
  let stopResolve;
  let playback;
  let playbackUrl;
  let disposed = false;
  let generation = 0;
  let loadGeneration = 0;

  function abortError() {
    return new DOMException('Recording was cancelled', 'AbortError');
  }

  function streamIsLive() {
    return stream?.getAudioTracks?.().some(track => track.readyState !== 'ended');
  }

  async function getStream() {
    if (disposed) throw abortError();
    if (streamIsLive()) return stream;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported in this browser');
    }
    const currentGeneration = generation;
    streamPromise ||= navigator.mediaDevices.getUserMedia({ audio: true });
    try {
      const resolved = await streamPromise;
      if (disposed || currentGeneration !== generation) {
        resolved?.getTracks?.().forEach(track => track.stop());
        throw abortError();
      }
      stream = resolved;
      return stream;
    } finally {
      streamPromise = undefined;
    }
  }

  async function load(questionId) {
    const currentLoad = ++loadGeneration;
    error.value = null;
    try {
      const loaded = await repository.load(toValue(sessionId), questionId);
      if (disposed || currentLoad !== loadGeneration) return loaded;
      blob.value = loaded;
      status.value = loaded ? 'recorded' : 'idle';
    } catch (cause) {
      if (disposed || currentLoad !== loadGeneration) return null;
      error.value = cause;
      status.value = 'error';
    }
    return blob.value;
  }

  async function start(questionId) {
    if (disposed || status.value === 'requesting' || status.value === 'recording') return false;
    const currentGeneration = generation;
    loadGeneration += 1;
    stopPlayback();
    status.value = 'requesting';
    error.value = null;
    chunks = [];
    try {
      const activeStream = await getStream();
      if (disposed || currentGeneration !== generation) {
        activeStream?.getTracks?.().forEach(track => track.stop());
        return false;
      }
      const mimeType = selectRecordingMimeType();
      recorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = event => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onerror = event => {
        error.value = event.error || new Error('Recording failed');
        status.value = 'error';
      };
      recorder.onstop = async () => {
        const recording = chunks.length
          ? new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
          : null;
        chunks = [];
        if (recording) {
          try {
            await repository.save(toValue(sessionId), questionId, recording);
            blob.value = recording;
            status.value = 'recorded';
          } catch (cause) {
            blob.value = null;
            error.value = cause;
            status.value = 'error';
          }
        } else {
          status.value = 'idle';
        }
        stopResolve?.(status.value === 'recorded' ? recording : null);
        stopResolve = undefined;
        stopPromise = undefined;
      };
      recorder.start();
      status.value = 'recording';
      return true;
    } catch (cause) {
      error.value = cause;
      status.value = 'error';
      return false;
    }
  }

  function stop() {
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(blob.value);
    if (stopPromise) return stopPromise;
    stopPromise = new Promise(resolve => {
      stopResolve = resolve;
    });
    recorder.stop();
    return stopPromise;
  }

  async function clear(questionId) {
    loadGeneration += 1;
    if (status.value === 'recording') await stop();
    stopPlayback();
    blob.value = null;
    error.value = null;
    status.value = 'idle';
    try {
      await repository.remove(toValue(sessionId), questionId);
    } catch (cause) {
      error.value = cause;
      status.value = 'error';
    }
  }

  function stopPlayback() {
    if (playback) {
      playback.pause();
      playback.currentTime = 0;
      playback = undefined;
    }
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    playbackUrl = undefined;
    playing.value = false;
  }

  function play() {
    if (!blob.value) return false;
    if (playing.value) {
      stopPlayback();
      return false;
    }
    stopPlayback();
    playbackUrl = URL.createObjectURL(blob.value);
    playback = new Audio(playbackUrl);
    playback.onended = stopPlayback;
    playback.onerror = () => {
      error.value = new Error('The recorded response could not be played');
      stopPlayback();
    };
    playback
      .play()
      .then(() => {
        playing.value = true;
      })
      .catch(cause => {
        error.value = cause;
        stopPlayback();
      });
    return true;
  }

  function releaseStream() {
    stream?.getTracks?.().forEach(track => track.stop());
    stream = undefined;
    streamPromise = undefined;
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    generation += 1;
    loadGeneration += 1;
    if (recorder?.state === 'recording') await stop();
    stopPlayback();
    releaseStream();
  }

  onBeforeUnmount(dispose);
  return {
    status,
    error,
    blob,
    playing,
    load,
    start,
    stop,
    clear,
    play,
    stopPlayback,
    releaseStream,
    dispose
  };
}
