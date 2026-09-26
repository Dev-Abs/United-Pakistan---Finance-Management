const assert = require('node:assert/strict');
const test = require('node:test');

const deepseek = require('../services/deepseek');

function withEnv(values, task) {
  const before = {};
  for (const [key, value] of Object.entries(values)) {
    before[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(task()).finally(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('disabled integration fails closed without making a request', async () => {
  await withEnv({ AI_FEATURES_ENABLED: 'false', DEEPSEEK_API_KEY: undefined, DEEPSEEK_MODEL: undefined }, async () => {
    let called = false;
    await assert.rejects(
      deepseek.generate({ operation: 'briefing', facts: {}, role: 'admin', ip: 'test', instructions: 'test', fetchImpl: async () => { called = true; } }),
      (error) => error.code === 'AI_DISABLED' && error.status === 503,
    );
    assert.equal(called, false);
  });
});

test('successful response returns only the assistant content and safe metadata', async () => {
  await withEnv({ AI_FEATURES_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model' }, async () => {
    const result = await deepseek.generate({
      operation: 'briefing', facts: { collected: 1000 }, role: 'reader', ip: '127.0.0.1', instructions: 'test',
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.model, 'test-model');
        assert.match(body.user_id, /^[a-f0-9]{24}$/);
        assert.doesNotMatch(body.user_id, /reader|127/);
        return { ok: true, json: async () => ({ choices: [{ message: { content: '  Verified briefing  ' } }], usage: { prompt_tokens: 10 } }) };
      },
    });
    assert.equal(result.content, 'Verified briefing');
    assert.equal(result.model, 'test-model');
    assert.equal(result.requestId.length, 24);
  });
});

test('transient provider error is retried once', async () => {
  await withEnv({ AI_FEATURES_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model' }, async () => {
    let calls = 0;
    const result = await deepseek.generate({
      operation: 'report-summary', facts: {}, role: 'admin', ip: 'test', instructions: 'test',
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return { ok: false, status: 429, json: async () => ({}) };
        return { ok: true, json: async () => ({ choices: [{ message: { content: 'Recovered' } }] }) };
      },
    });
    assert.equal(calls, 2);
    assert.equal(result.content, 'Recovered');
  });
});

test('empty provider output is rejected', async () => {
  await withEnv({ AI_FEATURES_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model' }, async () => {
    await assert.rejects(
      deepseek.generate({ operation: 'briefing', facts: {}, role: 'admin', ip: 'test', instructions: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [] }) }) }),
      (error) => error.code === 'AI_EMPTY_OUTPUT',
    );
  });
});

test('oversized input is rejected before provider access', async () => {
  await withEnv({ AI_FEATURES_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model', AI_MAX_INPUT_CHARS: '1000' }, async () => {
    let called = false;
    await assert.rejects(
      deepseek.generate({ operation: 'briefing', facts: { value: 'x'.repeat(2000) }, role: 'admin', ip: 'test', instructions: 'test', fetchImpl: async () => { called = true; } }),
      (error) => error.code === 'AI_INPUT_TOO_LARGE',
    );
    assert.equal(called, false);
  });
});

test('structured responses request JSON mode and parse one object', async () => {
  await withEnv({ AI_FEATURES_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model' }, async () => {
    const result = await deepseek.generateJson({
      operation: 'parse-entry', facts: { text: 'printing 3500' }, role: 'admin', ip: 'test', instructions: 'Return an expense.',
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.deepEqual(body.response_format, { type: 'json_object' });
        return { ok: true, json: async () => ({ choices: [{ message: { content: '{"type":"expense","amount":3500}' } }] }) };
      },
    });
    assert.equal(result.value.type, 'expense');
    assert.equal(result.value.amount, 3500);
  });
});

test('malformed structured response is rejected', async () => {
  await withEnv({ AI_FEATURES_ENABLED: 'true', DEEPSEEK_API_KEY: 'test-key', DEEPSEEK_MODEL: 'test-model' }, async () => {
    await assert.rejects(
      deepseek.generateJson({ operation: 'parse-entry', facts: {}, role: 'admin', ip: 'test', instructions: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'not-json' } }] }) }) }),
      (error) => error.code === 'AI_INVALID_JSON' && error.status === 502,
    );
  });
});
