import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  metricsURLFromBaseURL,
  normalizeBaseURL,
  shouldFail,
  summarizeSnapshot,
} from '../scripts/proxy-status.mjs';

describe('proxy-status', () => {
  it('derives metrics URL from OpenAI-compatible base URL', () => {
    assert.equal(normalizeBaseURL('http://127.0.0.1:3000/v1/'), 'http://127.0.0.1:3000/v1');
    assert.equal(
      metricsURLFromBaseURL('http://127.0.0.1:3000/v1/', 3),
      'http://127.0.0.1:3000/metrics?window=300000&days=3',
    );
  });

  it('summarizes healthy metrics snapshots', () => {
    const summary = summarizeSnapshot({
      generated_at: '2026-06-25T00:00:00.000Z',
      uptime_seconds: 10,
      summary: { window: { requests: 2, ok: 2, fail: 0, latency_ms_avg: 11, total_tokens: 50 } },
      usage: { totals: { requests: 5, total_tokens: 120, cost: 0 } },
      limits: [],
      model_status: {
        all: [
          { model: 'a', state: 'available' },
          { model: 'b', state: 'untested' },
        ],
      },
    });

    assert.equal(summary.level, 'ok');
    assert.equal(summary.requests_5m, 2);
    assert.equal(summary.usage_tokens, 120);
    assert.equal(summary.model_states.available, 1);
    assert.equal(summary.model_states.untested, 1);
  });

  it('marks active limits and model errors', () => {
    const limited = summarizeSnapshot({
      summary: { window: {} },
      usage: { totals: {} },
      limits: [{ model: 'a', limited: true, reset_in_seconds: 60 }],
      model_status: { all: [{ model: 'a', state: 'limited' }] },
    });
    assert.equal(limited.level, 'limited');
    assert.equal(limited.active_limits[0].model, 'a');

    const error = summarizeSnapshot({
      summary: { window: {} },
      usage: { totals: {} },
      limits: [],
      model_status: { all: [{ model: 'b', state: 'error' }] },
    });
    assert.equal(error.level, 'error');
  });

  it('applies fail-on levels', () => {
    assert.equal(shouldFail('ok', 'error'), false);
    assert.equal(shouldFail('limited', 'error'), false);
    assert.equal(shouldFail('limited', 'limited'), true);
    assert.equal(shouldFail('error', 'error'), true);
    assert.equal(shouldFail('error', 'never'), false);
  });
});
