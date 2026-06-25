import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UsageStore, localDay } from '../src/usage_store.js';
import { cleanupUsage } from '../scripts/cleanup-usage.mjs';

const tempDirs = [];

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('UsageStore', () => {
  it('records privacy-safe JSONL rows without prompts or responses', () => {
    const { store, path } = makeStore();
    const now = new Date(2026, 5, 23, 12, 0, 0).getTime();

    assert.equal(store.record({
      ts: now,
      model: 'm1',
      status: 200,
      ok: true,
      latency_ms: 123,
      total_tokens: 15,
      prompt_tokens: 10,
      completion_tokens: 5,
      cost: '0',
      messages: [{ role: 'user', content: 'secret prompt' }],
      response: 'secret response',
    }), true);

    const text = readFileSync(path, 'utf8');
    const row = JSON.parse(text.trim());
    assert.equal(row.model, 'm1');
    assert.equal(row.total_tokens, 15);
    assert.equal(row.day, localDay(now));
    assert.equal(text.includes('secret prompt'), false);
    assert.equal(text.includes('secret response'), false);
    assert.equal(Object.hasOwn(row, 'messages'), false);
    assert.equal(Object.hasOwn(row, 'response'), false);
  });

  it('aggregates usage by local day and model', () => {
    const { store } = makeStore();
    const today = new Date(2026, 5, 23, 12, 0, 0).getTime();
    const yesterday = new Date(2026, 5, 22, 12, 0, 0).getTime();

    store.record({ ts: yesterday, model: 'm1', status: 200, ok: true, total_tokens: 100, latency_ms: 20 });
    store.record({ ts: today, model: 'm1', status: 429, ok: false, rate_limited: true, total_tokens: 0, latency_ms: 40 });
    store.record({ ts: today, model: 'm2', status: 200, ok: true, total_tokens: 50, latency_ms: 60 });

    const summary = store.summary({ days: 2, models: ['m1', 'm2'], now: today });
    assert.equal(summary.enabled, true);
    assert.equal(summary.by_day.length, 2);
    assert.equal(summary.by_day[0].day, localDay(today));
    assert.equal(summary.by_day[0].requests, 2);
    assert.equal(summary.by_day[0].rate_limited, 1);
    assert.equal(summary.by_day[1].day, localDay(yesterday));
    assert.equal(summary.by_day[1].total_tokens, 100);
    assert.equal(summary.by_model_today.find((item) => item.model === 'm1').fail, 1);
    assert.equal(summary.by_model_today.find((item) => item.model === 'm2').total_tokens, 50);
  });

  it('prunes events outside the retention window', () => {
    const { dir, store, path } = makeStore({ retentionDays: 2, pruneIntervalMs: 1 });
    const today = new Date(2026, 5, 23, 12, 0, 0).getTime();
    const old = new Date(2026, 5, 20, 12, 0, 0).getTime();

    store.record({ ts: old, model: 'old-model', status: 200, ok: true, total_tokens: 10 });
    store.record({ ts: today, model: 'new-model', status: 200, ok: true, total_tokens: 20 });
    store.pruneOldEvents(today);

    const text = readFileSync(path, 'utf8');
    assert.equal(text.includes('old-model'), false);
    assert.equal(text.includes('new-model'), true);
    assert.equal(readdirSync(dir).some((name) => name.includes('.tmp.')), false);
  });

  it('cleans usage log through the command helper', () => {
    const { store, path } = makeStore({ retentionDays: 30, pruneIntervalMs: Number.MAX_SAFE_INTEGER });
    const today = Date.now();
    const old = today - 5 * 24 * 60 * 60 * 1000;

    store.record({ ts: old, model: 'old-model', status: 200, ok: true, total_tokens: 10 });
    store.record({ ts: today, model: 'new-model', status: 200, ok: true, total_tokens: 20 });

    const result = cleanupUsage({ path, days: 2 });
    const text = readFileSync(path, 'utf8');

    assert.equal(result.before, 2);
    assert.equal(result.after, 1);
    assert.equal(text.includes('old-model'), false);
    assert.equal(text.includes('new-model'), true);
  });
});

function makeStore(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'opencode-proxy-usage-'));
  tempDirs.push(dir);
  const path = join(dir, 'usage.jsonl');
  return {
    dir,
    path,
    store: new UsageStore({ path, retentionDays: 7, ...options }),
  };
}
