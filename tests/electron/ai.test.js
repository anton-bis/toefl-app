import assert from 'node:assert/strict';
import test from 'node:test';
import { requestChatCompletion } from '../../electron/services/ai.js';
import { SCORING_RUBRICS } from '../../src/ai/rubrics.js';

const request = {
  apiKey: 'secret',
  model: 'meta/llama-3.1-8b-instruct',
  messages: [{ role: 'user', content: 'Assess this response.' }]
};

test('AI transport keeps endpoints trusted and returns normalized completions', async () => {
  let captured;
  const result = await requestChatCompletion(request, async (url, options) => {
    captured = { url, options };
    return new Response(
      JSON.stringify({
        model: request.model,
        choices: [{ message: { content: 'Clear and relevant.' } }],
        usage: { total_tokens: 12 }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  });

  assert.equal(captured.url, 'https://integrate.api.nvidia.com/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret');
  assert.deepEqual(JSON.parse(captured.options.body).messages, request.messages);
  assert.deepEqual(result, {
    content: 'Clear and relevant.',
    model: request.model,
    usage: { total_tokens: 12 }
  });
  assert.deepEqual(Object.keys(SCORING_RUBRICS), [
    'listen-repeat',
    'take-interview',
    'write-email',
    'academic-discussion'
  ]);
  Object.values(SCORING_RUBRICS).forEach(rubric => {
    assert.match(rubric.guide, /5:/);
    assert.match(rubric.guide, /0:/);
    assert.ok(Array.isArray(rubric.criteria));
  });
});

test('AI transport rejects oversized input before fetching', async () => {
  let calls = 0;
  const fetchImplementation = async () => {
    calls += 1;
    return new Response('{}');
  };

  await assert.rejects(
    requestChatCompletion(
      { ...request, messages: [{ role: 'user', content: 'x'.repeat(101 * 1024) }] },
      fetchImplementation
    ),
    /Invalid AI message content/
  );
  assert.equal(calls, 0);
});

test('AI transport rejects oversized and malformed service responses', async () => {
  await assert.rejects(
    requestChatCompletion(
      request,
      async () => new Response('ignored', { headers: { 'Content-Length': 3 * 1024 * 1024 } })
    ),
    /response is too large/
  );
  await assert.rejects(
    requestChatCompletion(request, async () => new Response('not-json', { status: 502 })),
    /invalid JSON \(HTTP 502\)/
  );
});
