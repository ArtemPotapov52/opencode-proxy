const DEFAULT_MODELS = [
  'big-pickle',
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'north-mini-code-free',
  'nemotron-3-ultra-free',
];

const DEFAULT_PRIMARY_MODELS = [
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'north-mini-code-free',
  'nemotron-3-ultra-free',
];

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const DEFAULT_UPSTREAM = 'https://opencode.ai/zen/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_METRICS_MAX_EVENTS = 2000;
const DEFAULT_USAGE_RETENTION_DAYS = 30;
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;
const ROUTING_STRATEGIES = new Set(['round-robin', 'random']);
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

function loadConfig(env = process.env) {
  const models = env.MODELS
    ? parseList(env.MODELS)
    : DEFAULT_MODELS;
  const activeModels = models.length > 0 ? models : DEFAULT_MODELS;
  const requestedPrimaryModels = env.PRIMARY_MODELS
    ? parseList(env.PRIMARY_MODELS)
    : DEFAULT_PRIMARY_MODELS;
  const primaryModels = normalizePrimaryModels(requestedPrimaryModels, activeModels);
  const host = trimOrDefault(env.HOST, DEFAULT_HOST);
  const port = integerInRange(env.PORT, DEFAULT_PORT, 1, 65_535);
  const routing = ROUTING_STRATEGIES.has(String(env.ROUTING || '').trim())
    ? String(env.ROUTING).trim()
    : 'round-robin';
  const upstream = normalizeUpstream(env.UPSTREAM_URL, DEFAULT_UPSTREAM);
  const apiKey = env.OPENCODE_ZEN_API_KEY || 'public'; // process.env-compatible value.
  const managementToken = trimString(env.MANAGEMENT_TOKEN || env.OPENCODE_PROXY_TOKEN || '');
  const warnings = [];

  if (isExposedHost(host) && !managementToken) {
    warnings.push('HOST exposes management endpoints; set MANAGEMENT_TOKEN to enable /dashboard, /metrics, /usage, /limits, and /export.');
  }

  return {
    host,
    port,
    apiKey,
    models: activeModels,
    primaryModels,
    upstream,
    routing,
    timeout: positiveInteger(env.UPSTREAM_TIMEOUT, DEFAULT_TIMEOUT_MS),
    metricsMaxEvents: positiveInteger(env.METRICS_MAX_EVENTS, DEFAULT_METRICS_MAX_EVENTS),
    usageDbPath: env.USAGE_DB_PATH || '',
    usageRetentionDays: positiveInteger(env.USAGE_RETENTION_DAYS, DEFAULT_USAGE_RETENTION_DAYS),
    maxBodyBytes: positiveInteger(env.MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES),
    managementToken,
    managementAuthRequired: Boolean(managementToken) || isExposedHost(host),
    accessLog: !isOffValue(env.ACCESS_LOG),
    shutdownTimeoutMs: positiveInteger(env.SHUTDOWN_TIMEOUT_MS, DEFAULT_SHUTDOWN_TIMEOUT_MS),
    warnings,
  };
}

function normalizePrimaryModels(primaryModels, activeModels) {
  const output = [];
  for (const model of primaryModels) {
    if (activeModels.includes(model) && !output.includes(model)) output.push(model);
  }
  for (const model of activeModels) {
    if (output.length >= 4) break;
    if (!output.includes(model)) output.push(model);
  }
  return output.slice(0, 4);
}

function parseList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function trimString(value) {
  return String(value || '').trim();
}

function trimOrDefault(value, fallback) {
  const trimmed = trimString(value);
  return trimmed || fallback;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function integerInRange(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const integer = Math.floor(number);
  return integer >= min && integer <= max ? integer : fallback;
}

function normalizeUpstream(value, fallback) {
  const candidate = trimOrDefault(value, fallback);
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

function isOffValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no';
}

function isExposedHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return Boolean(normalized) && !LOCAL_HOSTS.has(normalized);
}

export {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_MODELS,
  DEFAULT_PRIMARY_MODELS,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  loadConfig,
  normalizePrimaryModels,
};
