import { normalizeApiBaseUrl } from './license-config.js';

/**
 * License HTTP client (license-protocol-v1). Talks to the Web license server
 * from the main process. Success responses use { data }, failures { error }.
 */

export class LicenseError extends Error {
  constructor({ code, status = 0, message = '许可证服务请求失败', requestId = '' } = {}) {
    super(message);
    this.name = 'LicenseError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export function createLicenseClient({
  baseUrl,
  fetchImplementation = globalThis.fetch,
  timeoutMs = 15_000
} = {}) {
  const apiBase = normalizeApiBaseUrl(baseUrl);
  if (!apiBase) {
    throw new LicenseError({ code: 'LICENSE:CONFIG', message: '许可证服务地址未配置' });
  }

  async function exchange(path, body) {
    const url = new URL(path, apiBase);
    const signal = AbortSignal.timeout(timeoutMs);
    let response;
    try {
      response = await fetchImplementation(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
        signal
      });
    } catch (error) {
      throw new LicenseError({
        code: 'LICENSE:NETWORK',
        message: '无法连接服务器，请检查网络后重试'
      });
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.ok) {
      return payload?.data ?? {};
    }
    const serverError = payload?.error;
    throw new LicenseError({
      code: serverError?.code || 'LICENSE:NETWORK',
      status: response.status,
      message: serverError?.message || `服务器返回错误（HTTP ${response.status}）`,
      requestId: serverError?.requestId || ''
    });
  }

  return {
    activate({ code, deviceFingerprint }) {
      return exchange('v1/licenses/devices/activate', { code, deviceFingerprint });
    },
    refresh({ deviceId, deviceFingerprint, activationToken }) {
      return exchange('v1/licenses/devices/refresh', {
        deviceId,
        deviceFingerprint,
        activationToken
      });
    },
    unbind({ deviceId, code, activationToken }) {
      return exchange(`v1/licenses/devices/${encodeURIComponent(deviceId)}/unbind`, {
        code,
        activationToken
      });
    }
  };
}
