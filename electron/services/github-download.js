export const GITHUB_PROXY_PREFIX = 'https://v6.gh-proxy.org/';
export const DEFAULT_CONTENT_OSS_HOST = 'justtofu-downloads.oss-cn-hangzhou.aliyuncs.com';

const GITHUB_PROXY_HOSTS = new Set(['v6.gh-proxy.org', 'gh-proxy.org']);

const GITHUB_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'raw.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com'
]);

const ALIYUN_OSS_SUFFIX = '.aliyuncs.com';

function githubTargetUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('GitHub downloads must use HTTPS.');
  }
  if (!GITHUB_PROXY_HOSTS.has(url.hostname)) return url;
  if (url.port) throw new Error('Invalid GitHub proxy URL.');

  try {
    return new URL(`${url.pathname.slice(1)}${url.search}`);
  } catch {
    throw new Error('Invalid GitHub proxy target.');
  }
}

function trustedDownloadHost(hostname) {
  return (
    GITHUB_DOWNLOAD_HOSTS.has(hostname) ||
    GITHUB_PROXY_HOSTS.has(hostname) ||
    hostname === DEFAULT_CONTENT_OSS_HOST ||
    hostname.endsWith(ALIYUN_OSS_SUFFIX)
  );
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
  if (url.hostname === 'v6.gh-proxy.org') return url.toString();
  return `${GITHUB_PROXY_PREFIX}${githubTargetUrl(url).toString()}`;
}

export function validateContentDownloadUrl(value) {
  const url = new URL(value);
  const target = githubTargetUrl(url);
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    !trustedDownloadHost(target.hostname)
  ) {
    throw new Error(`Untrusted download host: ${target.hostname}`);
  }
  return url;
}

export function resolveContentDownloadUrl(value) {
  const url = validateContentDownloadUrl(value);
  if (url.hostname === 'v6.gh-proxy.org') return url.toString();
  if (GITHUB_PROXY_HOSTS.has(url.hostname)) {
    return `${GITHUB_PROXY_PREFIX}${githubTargetUrl(url).toString()}`;
  }
  if (GITHUB_DOWNLOAD_HOSTS.has(url.hostname)) {
    return `${GITHUB_PROXY_PREFIX}${url.toString()}`;
  }
  return url.toString();
}
