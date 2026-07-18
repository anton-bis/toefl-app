const MAX_REQUEST_BYTES = 100 * 1024;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_MESSAGES = 64;
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);

// Providers are registered in trusted main-process code. Renderer input can select
// a provider, but it can never supply an arbitrary endpoint.
export const AI_PROVIDERS = Object.freeze({
  nvidia: Object.freeze({
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions'
  })
});

function boundedString(value, label, maximum) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new TypeError(`Invalid ${label}`);
  }
  return value;
}

function boundedNumber(value, label, minimum, maximum, integer = false) {
  if (
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new RangeError(`Invalid ${label}`);
  }
  return value;
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > MAX_MESSAGES) {
    throw new TypeError('Invalid AI messages');
  }
  return messages.map(message => {
    if (!message || typeof message !== 'object' || !ALLOWED_ROLES.has(message.role)) {
      throw new TypeError('Invalid AI message');
    }
    return {
      role: message.role,
      content: boundedString(message.content, 'AI message content', MAX_REQUEST_BYTES)
    };
  });
}

async function readBoundedResponse(response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new RangeError('The AI response is too large');
  }
  if (!response.body) {
    const body = await response.text();
    if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
      throw new RangeError('The AI response is too large');
    }
    return body;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (let item = await reader.read(); !item.done; item = await reader.read()) {
    const { value } = item;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RangeError('The AI response is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8');
}

function normalizeRequest(options, fetchImplementation) {
  const {
    apiKey,
    provider = 'nvidia',
    model,
    messages,
    temperature = 0.2,
    maxTokens = 2048,
    timeoutMs = 30_000,
    signal
  } = options || {};
  const configuration = AI_PROVIDERS[provider];
  if (!configuration) throw new TypeError('Unsupported AI provider');
  boundedString(apiKey, 'AI API key', 10_000);
  boundedString(model, 'AI model', 200);
  boundedNumber(temperature, 'AI temperature', 0, 2);
  boundedNumber(maxTokens, 'AI maxTokens', 1, 8192, true);
  boundedNumber(timeoutMs, 'AI timeout', 1_000, 120_000, true);
  if (typeof fetchImplementation !== 'function') throw new TypeError('Fetch is unavailable');

  const body = JSON.stringify({
    model,
    messages: normalizeMessages(messages),
    max_tokens: maxTokens,
    temperature,
    stream: false
  });
  if (Buffer.byteLength(body) > MAX_REQUEST_BYTES) {
    throw new RangeError('The AI request is too large');
  }
  return { apiKey, body, configuration, model, signal, timeoutMs };
}

function parseCompletion(body, response, requestedModel) {
  let result;
  try {
    result = JSON.parse(body);
  } catch {
    throw new Error(`The AI provider returned invalid JSON (HTTP ${response.status})`);
  }
  if (!response.ok) {
    throw new Error(
      result.error?.message || result.message || `The AI provider returned HTTP ${response.status}`
    );
  }
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) {
    throw new Error('The AI provider returned an unexpected response');
  }
  return {
    content,
    model: typeof result.model === 'string' ? result.model : requestedModel,
    usage: result.usage && typeof result.usage === 'object' ? result.usage : null
  };
}

/**
 * Main-process transport for future scoring features. This module is deliberately
 * not exposed through preload until a renderer feature has a concrete request contract.
 */
export async function requestChatCompletion(options, fetchImplementation = globalThis.fetch) {
  const request = normalizeRequest(options, fetchImplementation);
  const timeoutSignal = AbortSignal.timeout(request.timeoutMs);
  const requestSignal = request.signal
    ? AbortSignal.any([request.signal, timeoutSignal])
    : timeoutSignal;
  const response = await fetchImplementation(request.configuration.endpoint, {
    method: 'POST',
    signal: requestSignal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${request.apiKey}`
    },
    body: request.body
  });
  return parseCompletion(await readBoundedResponse(response), response, request.model);
}
