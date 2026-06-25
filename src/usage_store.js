import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  promises as fsPromises,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const DEFAULT_USAGE_RETENTION_DAYS = 30;
const DEFAULT_USAGE_READ_LIMIT_BYTES = 5 * 1024 * 1024;

function defaultUsageDbPath() {
  return join(homedir(), '.config', 'opencode-proxy', 'usage.jsonl');
}

class UsageStore {
  constructor(options = {}) {
    const configuredPath = options.path || defaultUsageDbPath();
    this.enabled = options.enabled !== false && !isOffValue(configuredPath);
    this.path = this.enabled ? configuredPath : '';
    this.retentionDays = positiveInteger(options.retentionDays, DEFAULT_USAGE_RETENTION_DAYS);
    this.maxReadBytes = positiveInteger(options.maxReadBytes, DEFAULT_USAGE_READ_LIMIT_BYTES);
    this.pruneIntervalMs = positiveInteger(options.pruneIntervalMs, 60 * 60 * 1000);
    this.lastPruneTs = 0;
    this.lastError = '';
    this.writeQueue = Promise.resolve();
    this.pendingEvents = [];
  }

  record(event) {
    if (!this.enabled) return false;

    const safeEvent = sanitizeUsageEvent(event);
    const line = `${JSON.stringify(safeEvent)}\n`;
    this.pendingEvents.push(safeEvent);

    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fsPromises.mkdir(dirname(this.path), { recursive: true });
        await fsPromises.appendFile(this.path, line, 'utf8');
        removePendingEvent(this.pendingEvents, safeEvent);
        this.pruneIfNeeded(safeEvent.ts);
        this.lastError = '';
      } catch (error) {
        removePendingEvent(this.pendingEvents, safeEvent);
        this.lastError = error?.message || String(error);
      }
    });

    return true;
  }

  async flush() {
    try {
      await this.writeQueue;
      return true;
    } catch (error) {
      this.lastError = error?.message || String(error);
      return false;
    }
  }

  summary(options = {}) {
    const days = positiveInteger(options.days, 7);
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const events = this.enabled ? [...this.readEvents(), ...this.pendingEvents] : [];
    return summarizeUsageEvents(events, {
      days,
      models: options.models || [],
      now,
      enabled: this.enabled,
      path: this.path,
      retentionDays: this.retentionDays,
      lastError: this.lastError,
    });
  }

  readEvents() {
    if (!this.enabled || !existsSync(this.path)) return [];

    try {
      const text = readTextTail(this.path, this.maxReadBytes);
      this.lastError = '';
      return parseJsonLines(text);
    } catch (error) {
      this.lastError = error?.message || String(error);
      return [];
    }
  }

  pruneIfNeeded(now = Date.now()) {
    if (!this.enabled || this.retentionDays <= 0) return false;
    if (now - this.lastPruneTs < this.pruneIntervalMs) return false;
    this.lastPruneTs = now;
    return this.pruneOldEvents(now);
  }

  pruneOldEvents(now = Date.now()) {
    if (!this.enabled || !existsSync(this.path)) return false;
    const cutoffTs = localDayStartTs(now, this.retentionDays - 1);
    const events = this.readEvents();
    const kept = events
      .map(normalizeStoredEvent)
      .filter((event) => event.ts >= cutoffTs);

    try {
      const text = kept.length ? `${kept.map((event) => JSON.stringify(event)).join('\n')}\n` : '';
      atomicWriteFile(this.path, text);
      this.lastError = '';
      return true;
    } catch (error) {
      this.lastError = error?.message || String(error);
      return false;
    }
  }
}

function removePendingEvent(pendingEvents, event) {
  const index = pendingEvents.indexOf(event);
  if (index >= 0) pendingEvents.splice(index, 1);
}

function atomicWriteFile(filePath, text) {
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  try {
    writeFileSync(tmpPath, text, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      // Keep the original write error as the caller-visible failure.
    }
    throw error;
  }
}

function sanitizeUsageEvent(event = {}) {
  const ts = numberOrFallback(event.ts, Date.now());
  const status = Math.max(0, Math.round(numberOrFallback(event.status, 0)));
  const ok = Boolean(event.ok);

  return {
    v: 1,
    ts,
    day: localDay(ts),
    model: cleanString(event.model || 'unknown', 120),
    returned_model: cleanString(event.returned_model || '', 120),
    status,
    ok,
    latency_ms: nonNegativeInteger(event.latency_ms),
    total_tokens: nonNegativeInteger(event.total_tokens),
    prompt_tokens: nonNegativeInteger(event.prompt_tokens),
    completion_tokens: nonNegativeInteger(event.completion_tokens),
    usage_reported: Boolean(event.usage_reported),
    usage_estimated: Boolean(event.usage_estimated),
    usage_source: cleanString(event.usage_source || '', 40),
    cost: numberOrNull(event.cost),
    rate_limited: Boolean(event.rate_limited || status === 429),
    retry_after_seconds: nonNegativeNumberOrNull(event.retry_after_seconds),
    limit_reset_at: cleanString(event.limit_reset_at || '', 64),
    limit_reset_at_ts: numberOrNull(event.limit_reset_at_ts),
    limit_source: cleanString(event.limit_source || '', 40),
    rate_limit_remaining: numberOrNull(event.rate_limit_remaining),
    rate_limit_limit: numberOrNull(event.rate_limit_limit),
    error_class: ok ? '' : classifyError(event, status),
  };
}

function summarizeUsageEvents(events = [], options = {}) {
  const days = positiveInteger(options.days, 7);
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const dayList = lastLocalDays(days, now);
  const daySet = new Set(dayList);
  const today = localDay(now);
  const since24h = now - 24 * 60 * 60 * 1000;
  const knownModels = uniqueStrings(options.models || []);

  const totals = emptyUsageAggregate();
  const byDay = new Map(dayList.map((day) => [day, {
    day,
    aggregate: emptyUsageAggregate(),
    byModel: new Map(),
  }]));
  const byModelToday = new Map(knownModels.map((model) => [model, emptyUsageAggregate(model)]));
  const byModel24h = new Map(knownModels.map((model) => [model, emptyUsageAggregate(model)]));

  for (const rawEvent of events) {
    const event = normalizeStoredEvent(rawEvent);
    const day = event.day || localDay(event.ts);

    if (daySet.has(day)) {
      addUsageEvent(totals, event);
      const dayBucket = byDay.get(day);
      addUsageEvent(dayBucket.aggregate, event);
      addUsageEvent(mapAggregate(dayBucket.byModel, event.model), event);
    }

    if (day === today) {
      addUsageEvent(mapAggregate(byModelToday, event.model), event);
    }

    if (event.ts >= since24h && event.ts <= now + 60_000) {
      addUsageEvent(mapAggregate(byModel24h, event.model), event);
    }
  }

  return {
    version: 1,
    enabled: Boolean(options.enabled),
    path: options.enabled ? options.path || '' : '',
    retention_days: positiveInteger(options.retentionDays, DEFAULT_USAGE_RETENTION_DAYS),
    read_window_days: days,
    generated_at: new Date(now).toISOString(),
    today,
    totals: finalizeUsageAggregate(totals),
    by_day: dayList.map((day) => {
      const bucket = byDay.get(day);
      return {
        day,
        ...finalizeUsageAggregate(bucket.aggregate),
        by_model: sortedAggregates(bucket.byModel),
      };
    }),
    by_model_today: sortedAggregates(byModelToday, { keepEmpty: true }),
    by_model_24h: sortedAggregates(byModel24h, { keepEmpty: true }),
    last_error: options.lastError || '',
  };
}

function readTextTail(filePath, maxBytes) {
  const stats = statSync(filePath);
  if (stats.size <= maxBytes) {
    return readFileSync(filePath, 'utf8');
  }

  const fd = openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes);
    readSync(fd, buffer, 0, maxBytes, stats.size - maxBytes);
    const text = buffer.toString('utf8');
    const firstNewline = text.indexOf('\n');
    return firstNewline >= 0 ? text.slice(firstNewline + 1) : text;
  } finally {
    closeSync(fd);
  }
}

function parseJsonLines(text) {
  const events = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // Ignore partial or corrupt lines; the next append remains readable.
    }
  }
  return events;
}

function normalizeStoredEvent(rawEvent = {}) {
  return sanitizeUsageEvent({
    ...rawEvent,
    ts: numberOrFallback(rawEvent.ts, Date.now()),
    ok: rawEvent.ok,
  });
}

function emptyUsageAggregate(model = '') {
  const aggregate = {
    requests: 0,
    ok: 0,
    fail: 0,
    total_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    usage_reported: 0,
    usage_estimated: 0,
    cost: 0,
    rate_limited: 0,
    latency_ms_sum: 0,
    latency_ms_avg: 0,
    latency_ms_max: 0,
    last_seen_ts: 0,
    last_seen_at: '',
  };
  if (model) aggregate.model = model;
  return aggregate;
}

function addUsageEvent(aggregate, event) {
  aggregate.requests += 1;
  if (event.ok) aggregate.ok += 1;
  else aggregate.fail += 1;
  aggregate.total_tokens += event.total_tokens || 0;
  aggregate.prompt_tokens += event.prompt_tokens || 0;
  aggregate.completion_tokens += event.completion_tokens || 0;
  if (event.usage_reported) aggregate.usage_reported += 1;
  if (event.usage_estimated) aggregate.usage_estimated += 1;
  aggregate.cost += event.cost || 0;
  if (event.rate_limited) aggregate.rate_limited += 1;
  aggregate.latency_ms_sum += event.latency_ms || 0;
  aggregate.latency_ms_max = Math.max(aggregate.latency_ms_max, event.latency_ms || 0);
  aggregate.last_seen_ts = Math.max(aggregate.last_seen_ts || 0, event.ts || 0);
}

function finalizeUsageAggregate(aggregate) {
  const output = { ...aggregate };
  output.latency_ms_avg = output.requests > 0
    ? round(output.latency_ms_sum / output.requests, 0)
    : 0;
  output.cost = round(output.cost, 6);
  output.last_seen_at = output.last_seen_ts
    ? new Date(output.last_seen_ts).toISOString()
    : '';
  delete output.latency_ms_sum;
  delete output.last_seen_ts;
  return output;
}

function sortedAggregates(map, options = {}) {
  return Array.from(map.values())
    .filter((aggregate) => options.keepEmpty || aggregate.requests > 0)
    .map(finalizeUsageAggregate)
    .sort((a, b) => b.requests - a.requests || String(a.model || '').localeCompare(String(b.model || '')));
}

function mapAggregate(map, model) {
  const key = model || 'unknown';
  if (!map.has(key)) {
    map.set(key, emptyUsageAggregate(key));
  }
  return map.get(key);
}

function lastLocalDays(days, now = Date.now()) {
  const anchor = new Date(now);
  const result = [];
  for (let index = 0; index < days; index += 1) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - index);
    result.push(localDay(date.getTime()));
  }
  return result;
}

function localDayStartTs(now = Date.now(), offsetDays = 0) {
  const date = new Date(now);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offsetDays).getTime();
}

function localDay(ts = Date.now()) {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function classifyError(event, status) {
  const type = String(event.error_type || '').toLowerCase();
  if (status === 429 || event.rate_limited) return 'rate_limit';
  if (type.includes('timeout') || status === 408 || status === 504) return 'timeout';
  if (type.includes('network')) return 'network';
  if (status >= 500) return 'http_5xx';
  if (status >= 400) return 'http_4xx';
  return 'unknown';
}

function cleanString(value, maxLength) {
  return String(value || '').replace(/[\r\n\t]/g, ' ').slice(0, maxLength);
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.round(numberOrFallback(value, 0)));
}

function nonNegativeNumberOrNull(value) {
  const number = numberOrNull(value);
  return number === null ? null : Math.max(0, number);
}

function numberOrFallback(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function isOffValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'off' || normalized === 'false' || normalized === '0';
}

export {
  DEFAULT_USAGE_RETENTION_DAYS,
  UsageStore,
  defaultUsageDbPath,
  localDay,
  localDayStartTs,
  sanitizeUsageEvent,
  summarizeUsageEvents,
};
