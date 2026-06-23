const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_EVENTS = 2000;

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function emptyAggregate(model) {
  return {
    model,
    requests: 0,
    ok: 0,
    fail: 0,
    total_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost: 0,
    latency_ms_sum: 0,
    latency_ms_avg: 0,
    latency_ms_max: 0,
  };
}

class ProxyMetrics {
  constructor(options = {}) {
    this.maxEvents = Number.isFinite(options.maxEvents) ? options.maxEvents : DEFAULT_MAX_EVENTS;
    this.startedAt = Date.now();
    this.events = [];
  }

  record(event) {
    const safeEvent = {
      ts: event.ts || Date.now(),
      model: String(event.model || 'unknown'),
      returned_model: event.returned_model ? String(event.returned_model) : '',
      status: Number(event.status || 0),
      ok: Boolean(event.ok),
      latency_ms: Number(event.latency_ms || 0),
      total_tokens: Number(event.total_tokens || 0),
      prompt_tokens: Number(event.prompt_tokens || 0),
      completion_tokens: Number(event.completion_tokens || 0),
      cost: numberOrNull(event.cost),
      finish_reason: event.finish_reason ? String(event.finish_reason) : '',
      error_type: event.error_type ? String(event.error_type) : '',
    };

    this.events.push(safeEvent);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  snapshot(options = {}) {
    const now = Date.now();
    const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0
      ? options.windowMs
      : DEFAULT_WINDOW_MS;
    const since = now - windowMs;
    const windowEvents = this.events.filter((event) => event.ts >= since);
    const allSummary = aggregateEvents(this.events, Math.max(1, now - this.startedAt));
    const windowSummary = aggregateEvents(windowEvents, windowMs);

    return {
      version: 1,
      generated_at: new Date(now).toISOString(),
      started_at: new Date(this.startedAt).toISOString(),
      uptime_seconds: Math.floor((now - this.startedAt) / 1000),
      privacy: {
        stores_prompts: false,
        stores_responses: false,
        stores_api_keys: false,
        note: 'Only model, status, latency, token usage, cost, and error class are kept in memory.',
      },
      window_ms: windowMs,
      total_events_kept: this.events.length,
      summary: {
        all: allSummary,
        window: windowSummary,
      },
      recent: this.events.slice(-20).reverse(),
    };
  }
}

function aggregateEvents(events, durationMs) {
  const durationMinutes = Math.max(durationMs / 60_000, 1 / 60);
  const summary = {
    requests: events.length,
    ok: 0,
    fail: 0,
    total_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost: 0,
    requests_per_minute: 0,
    tokens_per_minute: 0,
    latency_ms_avg: 0,
    latency_ms_max: 0,
    by_model: {},
  };

  let latencySum = 0;
  for (const event of events) {
    const model = event.model || 'unknown';
    const modelAggregate = summary.by_model[model] || emptyAggregate(model);
    summary.by_model[model] = modelAggregate;

    if (event.ok) {
      summary.ok++;
      modelAggregate.ok++;
    } else {
      summary.fail++;
      modelAggregate.fail++;
    }

    summary.total_tokens += event.total_tokens || 0;
    summary.prompt_tokens += event.prompt_tokens || 0;
    summary.completion_tokens += event.completion_tokens || 0;
    summary.cost += event.cost || 0;
    summary.latency_ms_max = Math.max(summary.latency_ms_max, event.latency_ms || 0);
    latencySum += event.latency_ms || 0;

    modelAggregate.requests++;
    modelAggregate.total_tokens += event.total_tokens || 0;
    modelAggregate.prompt_tokens += event.prompt_tokens || 0;
    modelAggregate.completion_tokens += event.completion_tokens || 0;
    modelAggregate.cost += event.cost || 0;
    modelAggregate.latency_ms_sum += event.latency_ms || 0;
    modelAggregate.latency_ms_max = Math.max(modelAggregate.latency_ms_max, event.latency_ms || 0);
  }

  summary.requests_per_minute = round(summary.requests / durationMinutes, 2);
  summary.tokens_per_minute = round(summary.total_tokens / durationMinutes, 2);
  summary.latency_ms_avg = summary.requests > 0 ? round(latencySum / summary.requests, 0) : 0;
  summary.cost = round(summary.cost, 6);

  for (const aggregate of Object.values(summary.by_model)) {
    aggregate.latency_ms_avg = aggregate.requests > 0
      ? round(aggregate.latency_ms_sum / aggregate.requests, 0)
      : 0;
    aggregate.cost = round(aggregate.cost, 6);
    delete aggregate.latency_ms_sum;
  }

  summary.by_model = Object.values(summary.by_model)
    .sort((a, b) => b.requests - a.requests || a.model.localeCompare(b.model));

  return summary;
}

function extractUsageFromBody(body) {
  if (!body || typeof body !== 'object') {
    return {
      returned_model: '',
      finish_reason: '',
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost: null,
    };
  }

  return {
    returned_model: body.model || '',
    finish_reason: body.choices?.[0]?.finish_reason || '',
    total_tokens: Number(body.usage?.total_tokens || 0),
    prompt_tokens: Number(body.usage?.prompt_tokens || 0),
    completion_tokens: Number(body.usage?.completion_tokens || 0),
    cost: numberOrNull(body.cost),
  };
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export {
  DEFAULT_MAX_EVENTS,
  DEFAULT_WINDOW_MS,
  ProxyMetrics,
  aggregateEvents,
  extractUsageFromBody,
};
