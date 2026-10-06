import test from 'node:test';
import assert from 'node:assert/strict';
import {failOpenAI} from '../server/openai-errors.mjs';
import {enhanceContent} from '../server/generator.mjs';
import {demoLesson} from '../server/demo-lesson.mjs';
import {callStructured,qualityConfig} from '../server/pedagogy/provider.mjs';

const rejected = (error, headers = {}) => new Response(JSON.stringify({error}), {status: 429, headers});

test('quota errors explain credits or the specific limit, never a temporary retry', async () => {
  for (const [code, expected] of [
    ['credit_balance_exhausted', /Crédits API OpenAI épuisés/],
    ['organization_spend_limit_exceeded', /Plafond de dépenses.*organisation/],
    ['project_spend_limit_exceeded', /Plafond de dépenses.*projet/],
    ['organization_usage_limit_exceeded', /Limite d’utilisation.*organisation/],
    ['usage_limit_exceeded', /Limite d’utilisation API/],
    ['insufficient_quota', /Quota API OpenAI insuffisant/],
    [null, /Quota API OpenAI insuffisant/]
  ]) {
    await assert.rejects(failOpenAI(rejected({code, type: 'insufficient_quota'}, {'retry-after': '30'})), error => {
      assert.equal(error.status, 502);
      assert.equal(error.details.kind, 'quota');
      assert.equal(error.details.code, code);
      assert.equal(error.details.retryAfterSeconds, undefined);
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /Attendez|réessayez/);
      return true;
    });
  }
});

test('temporary limits preserve the minimum wait and specific codes override the broad type', async () => {
  for (const [code, type] of [['rate_limit_exceeded', 'tokens'], ['slow_down', 'rate_limit_error'], [null, 'rate_limit_error'], ['rate_limit_exceeded', 'insufficient_quota']]) {
    await assert.rejects(failOpenAI(rejected({code, type}, {'retry-after': '2.5', 'x-request-id': 'req_test'})), error => {
      assert.equal(error.details.kind, 'rate_limit');
      assert.equal(error.details.retryAfterSeconds, 3);
      assert.equal(error.details.requestId, 'req_test');
      assert.match(error.message, /au moins 3 secondes/);
      return true;
    });
  }
});

test('Retry-After accepts HTTP dates and handles missing or invalid values', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-06T12:00:00Z'));
  for (const [header, seconds] of [['Tue, 06 Oct 2026 12:01:00 GMT', 60], ['', undefined], ['invalid', undefined]]) {
    await assert.rejects(failOpenAI(rejected({code: 'rate_limit_exceeded'}, {'retry-after': header})), error => {
      assert.equal(error.details.retryAfterSeconds, seconds);
      assert.match(error.message, seconds ? /au moins 60 secondes/ : /réessayez plus tard/);
      return true;
    });
  }
});

test('unknown and non-JSON errors remain actionable without exposing upstream payloads', async () => {
  for (const response of [
    rejected({code: 'private-value', type: 'private-value', message: 'sk-secret prompt private-value'}),
    new Response('<html>sk-secret</html>', {status: 429}),
    new Response('null', {status: 429})
  ]) {
    await assert.rejects(failOpenAI(response), error => {
      assert.equal(error.details.kind, 'unknown');
      assert.match(error.message, /sans préciser la cause/);
      assert.doesNotMatch(JSON.stringify({message: error.message, details: error.details}), /sk-secret|private-value|<html>/);
      return true;
    });
  }
  await assert.rejects(failOpenAI(new Response('private-value', {status: 503})), /Génération OpenAI indisponible \(503\)/);
});

test('lesson generation reports exhausted credits and makes only one provider call', async t => {
  const originalKey = process.env.OPENAI_API_KEY, originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'test-only'; process.env.OPENAI_MODEL = 'test-model';
  t.after(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = originalModel;
  });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => rejected({code: 'credit_balance_exhausted', type: 'insufficient_quota'}));
  await assert.rejects(enhanceContent(demoLesson(), {}), error => {
    assert.match(error.message, /Crédits API OpenAI épuisés/);
    assert.match(error.message, /brouillon local/);
    return true;
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('preparation retains safe error details in its trace without retrying or creating content', async () => {
  let calls = 0;
  await assert.rejects(callStructured({
    role: 'write', input: {}, schema: {type: 'object'},
    config: qualityConfig({OPENAI_MODEL: 'gpt-5.4'}), apiKey: 'test-only',
    fetchImpl: async () => { calls++; return rejected({code: 'project_spend_limit_exceeded', type: 'insufficient_quota', message: 'sk-secret'}, {'x-request-id': 'req_test'}); }
  }), error => {
    assert.match(error.message, /Plafond de dépenses.*projet/);
    assert.equal(error.trace.status, 'failed');
    assert.equal(error.trace.providerError.code, 'project_spend_limit_exceeded');
    assert.equal(error.trace.providerError.requestId, 'req_test');
    assert.doesNotMatch(JSON.stringify(error.trace), /sk-secret/);
    return true;
  });
  assert.equal(calls, 1);
});
