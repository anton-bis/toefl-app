export const GITHUB_PROXY_PREFIX = 'https://gh-proxy.org/';

const GITHUB_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com'
]);

function githubTargetUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('GitHub downloads must use HTTPS.');
  }
  if (url.hostname !== 'gh-proxy.org') return url;
  if (url.port) throw new Error('Invalid GitHub proxy URL.');

  try {
    return new URL(`${url.pathname.slice(1)}${url.search}`);
  } catch {
    throw new Error('Invalid GitHub proxy target.');
  }
}

export function validateGitHubDownloadUrl(value) {
  const url = new URL(value);
  const target = githubTargetUrl(url);
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    !GITHUB_DOWNLOAD_HOSTS.has(target.hostname)
  ) {
    throw new Error(`Untrusted GitHub download host: ${target.hostname}`);
  }
  return url;
}

export function proxyGitHubDownloadUrl(value) {
  const url = validateGitHubDownloadUrl(value);
  if (url.hostname === 'gh-proxy.org') return url.toString();
  return `${GITHUB_PROXY_PREFIX}${url.toString()}`;
}
