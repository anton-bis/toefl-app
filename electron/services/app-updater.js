const ACTIVE_UPDATE_STATES = new Set([
  'checking',
  'available',
  'downloading',
  'downloaded',
  'installing'
]);
const MAX_RELEASE_NOTES_LENGTH = 420;

const HTML_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
};

export function normalizeReleaseNotes(value) {
  const notes = Array.isArray(value)
    ? value
        .map(item => item?.note || '')
        .filter(Boolean)
        .join('\n')
    : String(value || '');
  const withBreaks = notes
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(?:h[1-6]|li|p|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[\da-f]+|[a-z]+);/gi, (_match, entity) => {
      if (entity[0] === '#') {
        const hexadecimal = entity[1]?.toLowerCase() === 'x';
        const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
        return Number.isSafeInteger(codePoint) ? String.fromCodePoint(codePoint) : ' ';
      }
      return HTML_ENTITIES[entity.toLowerCase()] || ' ';
    })
    .replace(/\r/g, '');
  const withoutBuildDetails = withBreaks.split(/SHA-?256 Hashes|Full Changelog/i)[0];
  const plainText = withoutBuildDetails
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  if (plainText.length <= MAX_RELEASE_NOTES_LENGTH) return plainText;
  const shortened = plainText.slice(0, MAX_RELEASE_NOTES_LENGTH - 1);
  const boundary = shortened.lastIndexOf(' ');
  return `${shortened.slice(0, boundary > 300 ? boundary : shortened.length).trimEnd()}…`;
}

export function initialAppUpdateState() {
  return {
    revision: 0,
    status: 'idle',
    version: '',
    description: '',
    progress: 0,
    error: '',
    retryAction: '',
    notice: false,
    installBlocked: false,
    installMode: 'automatic'
  };
}

export function createAppUpdaterController({
  updater,
  emitState,
  prepareToInstall,
  downloadManualInstaller,
  manualArchitecture
}) {
  const manualInstall = typeof downloadManualInstaller === 'function';
  let manualAsset;
  let state = {
    ...initialAppUpdateState(),
    installMode: manualInstall ? 'manual' : 'automatic'
  };
  let operation = '';

  const snapshot = () => ({ ...state });
  const publish = patch => {
    state = { ...state, ...patch, revision: state.revision + 1 };
    emitState?.(snapshot());
    return snapshot();
  };
  const fail = error => {
    const retryAction =
      operation ||
      (state.status === 'downloading'
        ? 'download'
        : state.status === 'installing'
          ? 'install'
          : 'check');
    return publish({
      status: 'error',
      error: error?.message || String(error || 'Update failed.'),
      retryAction,
      notice: retryAction !== 'check' || state.notice
    });
  };

  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;

  updater.on('update-available', info => {
    const manualAssets =
      info?.files?.filter(file => String(file?.url || '').endsWith('.dmg')) || [];
    manualAsset =
      manualAssets.find(file => String(file.url).endsWith(`-${manualArchitecture}.dmg`)) ||
      manualAssets.find(file => String(file.url).endsWith('-universal.dmg')) ||
      manualAssets[0];
    publish({
      status: 'available',
      version: info?.version || '',
      description: normalizeReleaseNotes(info?.releaseNotes),
      progress: 0,
      error: '',
      retryAction: '',
      notice: true
    });
  });
  updater.on('update-not-available', () => {
    publish({
      status: 'up-to-date',
      error: '',
      retryAction: '',
      notice: state.notice
    });
  });
  updater.on('download-progress', progress => {
    publish({
      status: 'downloading',
      progress: Math.max(0, Math.min(100, Math.round(progress?.percent || 0))),
      error: '',
      retryAction: '',
      notice: true
    });
  });
  updater.on('update-downloaded', info => {
    publish({
      status: 'downloaded',
      version: info?.version || state.version,
      progress: 100,
      error: '',
      retryAction: '',
      notice: true
    });
  });
  updater.on('update-cancelled', () => {
    publish({ status: 'available', progress: 0, error: '', retryAction: '', notice: true });
  });
  updater.on('error', fail);

  async function check({ userInitiated = false } = {}) {
    if (ACTIVE_UPDATE_STATES.has(state.status)) {
      return userInitiated ? publish({ notice: true }) : snapshot();
    }
    operation = 'check';
    publish({
      status: 'checking',
      error: '',
      retryAction: '',
      notice: Boolean(userInitiated)
    });
    try {
      await updater.checkForUpdates();
    } catch (error) {
      if (state.status !== 'error') fail(error);
    } finally {
      operation = '';
    }
    return snapshot();
  }

  async function download() {
    if (state.status !== 'available' && state.retryAction !== 'download') return snapshot();
    operation = 'download';
    if (manualInstall) {
      publish({ status: 'downloading', progress: 0, error: '', retryAction: '', notice: true });
      try {
        await downloadManualInstaller({
          version: state.version,
          asset: manualAsset,
          onProgress: progress => publish({ progress })
        });
        return publish({
          status: 'available',
          progress: 100,
          error: '',
          retryAction: '',
          notice: false
        });
      } catch (error) {
        return fail(error);
      } finally {
        operation = '';
      }
    }
    publish({
      status: 'downloading',
      progress: 0,
      error: '',
      retryAction: '',
      notice: true
    });
    try {
      await updater.downloadUpdate();
      if (state.status === 'downloading') {
        publish({ status: 'downloaded', progress: 100, notice: true });
      }
    } catch (error) {
      if (state.status !== 'error') fail(error);
    } finally {
      operation = '';
    }
    return snapshot();
  }

  async function install() {
    if (state.status !== 'downloaded' && state.retryAction !== 'install') return snapshot();
    if (state.installBlocked) return publish({ notice: true });
    operation = 'install';
    publish({ status: 'installing', error: '', retryAction: '', notice: true });
    try {
      await prepareToInstall?.();
      updater.quitAndInstall();
    } catch (error) {
      fail(error);
    } finally {
      operation = '';
    }
    return snapshot();
  }

  async function retry() {
    if (state.retryAction === 'download') return download();
    if (state.retryAction === 'install') return install();
    return check({ userInitiated: true });
  }

  return {
    getState: snapshot,
    setInstallBlocked(value) {
      const installBlocked = Boolean(value);
      if (installBlocked === state.installBlocked) return snapshot();
      return publish({ installBlocked });
    },
    check,
    download,
    install,
    retry
  };
}
