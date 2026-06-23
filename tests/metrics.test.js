import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProxyMetrics, aggregateEvents, extractUsageFromBody } from '../src/metrics.js';

describe('ProxyMetrics', () => {
  it('aggregates token and latency rates by model', () => {
    const events = [
      { model: 'a', ok: true, latency_ms: 100, total_tokens: 60, prompt_tokens: 40, completion_tokens: 20, cost: 0 },
      { model: 'a', ok: false, latency_ms: 300, total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0 },
      { model: 'b', ok: true, latency_ms: 200, total_tokens: 120, prompt_tokens: 70, completion_tokens: 50, cost: 0.001 },
    ];

    const summary = aggregateEvents(events, 60_000);
    assert.equal(summary.requests, 3);
    assert.equal(summary.ok, 2);
    assert.equal(summary.fail, 1);
    assert.equal(summary.total_tokens, 180);
    assert.equal(summary.tokens_per_minute, 180);
    assert.equal(summary.latency_ms_avg, 200);
    assert.equal(summary.by_model[0].model, 'a');
    assert.equal(summary.by_model[0].requests, 2);
  });

  it('extracts usage without response text', () => {
    const usage = extractUsageFromBody({
      model: 'deepseek-v4-flash',
      choices: [{ finish_reason: 'stop', message: { content: 'secret text' } }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
      cost: '0',
    });

    assert.deepEqual(usage, {
      returned_model: 'deepseek-v4-flash',
      finish_reason: 'stop',
      total_tokens: 15,
      prompt_tokens: 10,
      completion_tokens: 5,
      cost: 0,
    });
    assert.equal(Object.hasOwn(usage, 'content'), false);
  });

  it('caps retained events', () => {
    const metrics = new ProxyMetrics({ maxEvents: 2 });
    metrics.record({ model: 'a', ok: true });
    metrics.record({ model: 'b', ok: true });
    metrics.record({ model: 'c', ok: true });

    const snapshot = metrics.snapshot();
    assert.equal(snapshot.total_events_kept, 2);
    assert.deepEqual(snapshot.recent.map((event) => event.model), ['c', 'b']);
  });
});
