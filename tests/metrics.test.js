import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ProxyMetrics,
  aggregateEvents,
  currentLimits,
  extractLimitFromHeaders,
  extractUsageFromBody,
  extractUsageFromText,
  parseRetryAfter,
  parseResetHeader,
  withEstimatedUsage,
} from '../src/metrics.js';

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
      usage_reported: true,
      usage_estimated: false,
      usage_source: 'api',
      cost: 0,
    });
    assert.equal(Object.hasOwn(usage, 'content'), false);
  });

  it('extracts usage from streaming SSE text without storing content', () => {
    const text = [
      'data: {"model":"stream-model","choices":[{"delta":{"content":"secret chunk"}}]}',
      'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":6,"total_tokens":10}}',
      'data: [DONE]',
      '',
    ].join('\n');

    const usage = extractUsageFromText(text);
    assert.deepEqual(usage, {
      returned_model: 'stream-model',
      finish_reason: 'stop',
      total_tokens: 10,
      prompt_tokens: 4,
      completion_tokens: 6,
      usage_reported: true,
      usage_estimated: false,
      usage_source: 'api',
      cost: null,
    });
    assert.equal(JSON.stringify(usage).includes('secret chunk'), false);
  });

  it('estimates usage from request and response text when upstream omits usage', () => {
    const raw = extractUsageFromBody({
      model: 'deepseek-v4-flash',
      choices: [{ finish_reason: 'stop', message: { content: 'answer text' } }],
    });
    const usage = withEstimatedUsage(
      raw,
      { messages: [{ role: 'user', content: 'a'.repeat(40) }] },
      '',
      { choices: [{ message: { content: 'b'.repeat(20) } }] },
    );

    assert.equal(usage.usage_reported, false);
    assert.equal(usage.usage_estimated, true);
    assert.equal(usage.usage_source, 'estimate_chars');
    assert.equal(usage.prompt_tokens, 10);
    assert.equal(usage.completion_tokens, 5);
    assert.equal(usage.total_tokens, 15);
    assert.equal(JSON.stringify(usage).includes('aaaa'), false);
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

  it('merges out-of-order events into existing minute buckets', () => {
    const metrics = new ProxyMetrics({ maxTimeseriesPoints: 10 });
    const base = Date.parse('2026-06-23T12:00:30.000Z');

    metrics.record({ ts: base + 60_000, model: 'a', ok: true, total_tokens: 10 });
    metrics.record({ ts: base, model: 'a', ok: true, total_tokens: 20 });
    metrics.record({ ts: base + 10_000, model: 'b', ok: false, total_tokens: 0 });

    const snapshot = metrics.snapshot();
    assert.equal(snapshot.timeseries.length, 2);
    assert.equal(snapshot.timeseries[0].requests, 2);
    assert.equal(snapshot.timeseries[0].total_tokens, 20);
    assert.equal(snapshot.timeseries[0].by_model.a.requests, 1);
    assert.equal(snapshot.timeseries[0].by_model.b.requests, 1);
    assert.equal(snapshot.timeseries[1].requests, 1);
  });

  it('parses retry-after seconds into reset time', () => {
    const now = Date.parse('2026-06-23T12:00:00.000Z');
    assert.deepEqual(parseRetryAfter('120', now), {
      retry_after_seconds: 120,
      reset_at_ts: now + 120_000,
      reset_at: '2026-06-23T12:02:00.000Z',
      source: 'retry-after',
    });
  });

  it('parses reset header seconds, epoch seconds, and dates', () => {
    const now = Date.parse('2026-06-23T12:00:00.000Z');
    assert.equal(parseResetHeader('60', now).reset_at, '2026-06-23T12:01:00.000Z');
    assert.equal(parseResetHeader('1782216000', now).reset_at, '2026-06-23T12:00:00.000Z');
    assert.equal(parseResetHeader('Tue, 23 Jun 2026 12:03:00 GMT', now).retry_after_seconds, 180);
  });

  it('extracts limit details from response headers', () => {
    const now = Date.parse('2026-06-23T12:00:00.000Z');
    const headers = new Headers({
      'Retry-After': '90',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Limit': '100',
    });

    assert.deepEqual(extractLimitFromHeaders(headers, 429, now), {
      rate_limited: true,
      retry_after_seconds: 90,
      limit_reset_at: '2026-06-23T12:01:30.000Z',
      limit_reset_at_ts: now + 90_000,
      limit_source: 'retry-after',
      rate_limit_remaining: 0,
      rate_limit_limit: 100,
    });
  });

  it('reports current active limits by model', () => {
    const now = Date.parse('2026-06-23T12:00:00.000Z');
    const limits = currentLimits([
      {
        ts: now - 1000,
        model: 'limited-model',
        status: 429,
        rate_limited: true,
        limit_reset_at: '2026-06-23T12:05:00.000Z',
        limit_reset_at_ts: now + 300_000,
        limit_source: 'retry-after',
        error_type: 'Rate limit exceeded',
      },
    ], now);

    assert.equal(limits.length, 1);
    assert.equal(limits[0].model, 'limited-model');
    assert.equal(limits[0].limited, true);
    assert.equal(limits[0].reset_in_seconds, 300);
  });

  it('reports primary model status with quota and daily usage', () => {
    const metrics = new ProxyMetrics({
      models: ['m1', 'm2'],
      primaryModels: ['m1', 'm2'],
    });
    const now = Date.now();

    metrics.record({
      ts: now - 2000,
      model: 'm1',
      status: 200,
      ok: true,
      total_tokens: 25,
      latency_ms: 100,
      rate_limit_remaining: 7,
      rate_limit_limit: 10,
    });
    metrics.record({
      ts: now - 1000,
      model: 'm2',
      status: 429,
      ok: false,
      latency_ms: 100,
      rate_limited: true,
      limit_reset_at: new Date(now + 60_000).toISOString(),
      limit_reset_at_ts: now + 60_000,
      limit_source: 'retry-after',
      error_type: 'Rate limit exceeded',
    });

    const snapshot = metrics.snapshot({ windowMs: 60_000, usageDays: 1 });
    const m1 = snapshot.model_status.primary.find((item) => item.model === 'm1');
    const m2 = snapshot.model_status.primary.find((item) => item.model === 'm2');

    assert.equal(snapshot.model_status.primary.length, 2);
    assert.equal(m1.state, 'available');
    assert.equal(m1.rate_limit_remaining, 7);
    assert.equal(m1.rate_limit_limit, 10);
    assert.equal(m1.today.total_tokens, 25);
    assert.equal(m2.state, 'limited');
    assert.ok(m2.reset_in_seconds <= 60);
    assert.equal(m2.today.rate_limited, 1);
  });
});
