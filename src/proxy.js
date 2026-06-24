import { loadConfig } from './config.js';
import { renderDashboard } from './dashboard.js';
import { ProxyMetrics, extractLimitFromHeaders, extractUsageFromBody, extractUsageFromText, withEstimatedUsage } from './metrics.js';
import { Router } from './router.js';
import { UsageStore } from './usage_store.js';

const SAFE_UPSTREAM_HEADERS = [
  'retry-after',
  'ratelimit-reset',
  'rate-limit-reset',
  'x-ratelimit-reset',
  'x-rate-limit-reset',
  'ratelimit-remaining',
  'rate-limit-remaining',
  'x-ratelimit-remaining',
  'x-rate-limit-remaining',
  'ratelimit-limit',
  'rate-limit-limit',
  'x-ratelimit-limit',
  'x-rate-limit-limit',
];

function createProxy(customConfig) {
  const config = customConfig || loadConfig();
  const router = new Router(config.models, config.routing);
  const usageStore = Object.hasOwn(config, 'usageDbPath')
    ? new UsageStore({ path: config.usageDbPath, retentionDays: config.usageRetentionDays })
    : null;
  const metrics = new ProxyMetrics({
    maxEvents: config.metricsMaxEvents,
    models: config.models,
    primaryModels: config.primaryModels,
    usageStore,
  });

  async function proxyRequest(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', models: config.models }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderDashboard());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/metrics') {
      const windowMs = parseInt(url.searchParams.get('window') || '', 10);
      const usageDays = parseInt(url.searchParams.get('days') || '', 10);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metrics.snapshot({ windowMs, usageDays })));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/usage') {
      const usageDays = parseInt(url.searchParams.get('days') || '', 10);
      const snapshot = metrics.snapshot({ usageDays });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        generated_at: snapshot.generated_at,
        usage: snapshot.usage,
        model_status: snapshot.model_status,
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/limits') {
      const snapshot = metrics.snapshot();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        generated_at: snapshot.generated_at,
        limits: snapshot.limits,
        model_status: snapshot.model_status,
      }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        object: 'list',
        data: config.models.map(m => ({
          id: m,
          object: 'model',
          created: Date.now(),
          owned_by: 'opencode-zen',
        })),
      }));
      return;
    }

    if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const selectedModel = router.getModelForRequest(parsed.model);
    parsed.model = selectedModel;
    const startedAt = Date.now();
    let timer;

    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), config.timeout);

      const upstreamUrl = `${config.upstream}/chat/completions`;
      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(parsed),
      });
      clearTimeout(timer);

      const text = await response.text();
      const parsedResponse = safeParseJSON(text);
      const rawUsage = parsedResponse
        ? extractUsageFromBody(parsedResponse)
        : extractUsageFromText(text);
      const usage = withEstimatedUsage(rawUsage, parsed, text, parsedResponse);
      const limit = extractLimitFromHeaders(response.headers, response.status, Date.now());
      metrics.record({
        model: selectedModel,
        status: response.status,
        ok: response.ok,
        latency_ms: Date.now() - startedAt,
        error_type: response.ok ? '' : upstreamErrorType(parsedResponse, response.status),
        ...usage,
        ...limit,
      });

      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'X-Model-Used': selectedModel,
        ...safeUpstreamHeaders(response.headers),
      });

      res.end(text);
    } catch (error) {
      if (timer) clearTimeout(timer);
      const message = error.name === 'AbortError'
        ? 'Upstream timeout'
        : error.message;
      metrics.record({
        model: selectedModel,
        status: 502,
        ok: false,
        latency_ms: Date.now() - startedAt,
        error_type: error.name === 'AbortError' ? 'timeout' : 'network',
      });
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upstream request failed', message }));
    }
  }

  return { proxyRequest, config, router, metrics };
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function upstreamErrorType(body, status) {
  if (body?.error?.message) return body.error.message;
  if (body?.error) return String(body.error);
  if (body?.message) return String(body.message);
  return `HTTP ${status}`;
}

function safeUpstreamHeaders(headers) {
  const output = {};
  for (const name of SAFE_UPSTREAM_HEADERS) {
    const value = headers.get(name);
    if (value) output[name] = value;
  }
  return output;
}

export { createProxy };
