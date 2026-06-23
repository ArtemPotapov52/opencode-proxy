import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { errorMessage, normalizeBaseURL, summarize } from '../scripts/model-health.mjs';

describe('model-health', () => {
  it('normalizes trailing slash in base URL', () => {
    assert.equal(normalizeBaseURL('http://127.0.0.1:3000/v1/'), 'http://127.0.0.1:3000/v1');
  });

  it('summarizes mixed model results', () => {
    const summary = summarize([
      { model: 'a', level: 'ok' },
      { model: 'b', level: 'fail' },
    ]);

    assert.deepEqual(summary, {
      total: 2,
      ok: 1,
      fail: 1,
      level: 'warning',
    });
  });

  it('extracts useful error messages', () => {
    assert.equal(errorMessage({ error: 'timeout' }), 'timeout');
    assert.equal(errorMessage({ status: 401, body: { error: { message: 'unauthorized' } } }), 'unauthorized');
    assert.equal(errorMessage({ status: 500, body: { raw: 'oops' } }), 'oops');
  });
});
