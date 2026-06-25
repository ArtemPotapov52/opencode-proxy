import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const options = {
    baseURL: process.env.OPENCODE_PROXY_BASE_URL || 'http://127.0.0.1:3000/v1',
    timeout: Number(process.env.OPENCODE_PROXY_STATUS_TIMEOUT || 5000),
    days: Number(process.env.OPENCODE_PROXY_STATUS_DAYS || 7),
    failOn: process.env.OPENCODE_PROXY_STATUS_FAIL_ON || 'error',
    managementToken: process.env.MANAGEMENT_TOKEN || process.env.OPENCODE_PROXY_TOKEN || '',
    json: false,
    compact: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--base-url') options.baseURL = next();
    else if (arg === '--timeout') options.timeout = Number(next());
    else if (arg === '--days') options.days = Number(next());
    else if (arg === '--fail-on') options.failOn = next();
    else if (arg === '--token') options.managementToken = next();
    else if (arg === '--json') options.json = true;
    else if (arg === '--compact') options.compact = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.json && options.compact) {
    throw new Error('--json and --compact are mutually exclusive');
  }
  if (!Number.isFinite(options.timeout) || options.timeout <= 0) {
    throw new Error('--timeout must be a positive number of milliseconds');
  }
  if (!Number.isFinite(options.days) || options.days <= 0) {
    throw new Error('--days must be a positive number');
  }
  if (!['limited', 'error', 'never'].includes(options.failOn)) {
    throw new Error('--fail-on must be one of: limited, error, never');
  }

  options.days = Math.floor(options.days);
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/proxy-status.mjs [options]

Options:
  --base-url <url>   OpenAI-compatible base URL, default: http://127.0.0.1:3000/v1
  --days <n>         Usage window in days, default: 7
  --timeout <ms>     Metrics request timeout, default: 5000
  --fail-on <level>  Exit non-zero on limited, error, or never. Default: error
  --token <token>    Management token for protected /metrics
  --json             Print JSON
  --compact          Print one-line status
`);
}

function normalizeBaseURL(baseURL) {
  return String(baseURL || '').replace(/\/$/, '');
}

function metricsURLFromBaseURL(baseURL, days = 7) {
  const normalized = normalizeBaseURL(baseURL);
  const root = normalized.replace(/\/v1$/, '');
  return `${root}/metrics?window=300000&days=${Math.max(1, Math.floor(days))}`;
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function fetchJSON(url, options = {}) {
  const timeout = withTimeout(options.timeout || 5000);
  const headers = {};
  if (options.managementToken) {
    headers.Authorization = `Bearer ${options.managementToken}`;
  }

  try {
    const response = await fetch(url, { signal: timeout.signal, headers });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  } finally {
    timeout.done();
  }
}

function summarizeSnapshot(snapshot = {}) {
  const window = snapshot.summary?.window || {};
  const usage = snapshot.usage || {};
  const models = snapshot.model_status?.all || [];
  const limits = (snapshot.limits || []).filter((limit) => limit.limited);
  const states = countModelStates(models);
  const errorModels = models.filter((model) => model.state === 'error');
  const retryModels = models.filter((model) => model.state === 'retry');
  const limitedModels = models.filter((model) => model.state === 'limited');

  const level = errorModels.length > 0
    ? 'error'
    : limits.length > 0 || limitedModels.length > 0 || retryModels.length > 0
      ? 'limited'
      : 'ok';

  return {
    level,
    generated_at: snapshot.generated_at || '',
    uptime_seconds: snapshot.uptime_seconds || 0,
    requests_5m: window.requests || 0,
    ok_5m: window.ok || 0,
    fail_5m: window.fail || 0,
    latency_ms_avg_5m: window.latency_ms_avg || 0,
    tokens_5m: window.total_tokens || 0,
    usage_requests: usage.totals?.requests || 0,
    usage_tokens: usage.totals?.total_tokens || 0,
    usage_cost: usage.totals?.cost || 0,
    models_total: models.length,
    model_states: states,
    active_limits: limits.map((limit) => ({
      model: limit.model,
      reset_in_seconds: limit.reset_in_seconds ?? null,
      reset_at: limit.reset_at || null,
      error_type: limit.error_type || '',
    })),
  };
}

function countModelStates(models) {
  const states = {
    available: 0,
    limited: 0,
    retry: 0,
    error: 0,
    untested: 0,
  };
  for (const model of models || []) {
    const state = model.state || 'untested';
    if (Object.hasOwn(states, state)) states[state] += 1;
    else states.untested += 1;
  }
  return states;
}

function summarizeFetchError(baseURL, metricsURL, result) {
  return {
    baseURL,
    metricsURL,
    level: 'error',
    error: result.error || result.body?.error || result.body?.message || `HTTP ${result.status}`,
    status: result.status,
  };
}

function shouldFail(level, failOn) {
  if (failOn === 'never') return false;
  if (failOn === 'limited') return level === 'limited' || level === 'error';
  return level === 'error';
}

function printHuman(baseURL, status) {
  console.log(`Proxy status for ${baseURL}`);
  if (status.error) {
    console.log(`  ${status.level}: ${status.error}`);
    return;
  }

  console.log(`  level: ${status.level}`);
  console.log(`  requests 5m: ${status.requests_5m} (${status.ok_5m} ok, ${status.fail_5m} fail), avg ${status.latency_ms_avg_5m}ms`);
  console.log(`  usage ${status.usage_requests} request(s), ${status.usage_tokens} token(s), cost ${status.usage_cost}`);
  console.log(`  models: ${status.models_total} total, ${status.model_states.available} available, ${status.model_states.limited} limited, ${status.model_states.retry} retry, ${status.model_states.error} error`);
  if (status.active_limits.length > 0) {
    console.log('  active limits:');
    for (const limit of status.active_limits) {
      const reset = limit.reset_in_seconds == null ? 'unknown reset' : `${limit.reset_in_seconds}s`;
      console.log(`    ${limit.model}: ${reset}${limit.error_type ? ` (${limit.error_type})` : ''}`);
    }
  }
}

function printCompact(status) {
  if (status.error) {
    console.log(`proxy ${status.level} ${status.error}`);
    return;
  }

  console.log([
    `proxy:${status.level}`,
    `req5m:${status.requests_5m}`,
    `fail5m:${status.fail_5m}`,
    `tokens:${status.usage_tokens}`,
    `models:${status.models_total}`,
    `available:${status.model_states.available}`,
    `limited:${status.model_states.limited + status.model_states.retry}`,
    `error:${status.model_states.error}`,
  ].join(' '));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseURL = normalizeBaseURL(options.baseURL);
  const metricsURL = metricsURLFromBaseURL(baseURL, options.days);
  const result = await fetchJSON(metricsURL, {
    timeout: options.timeout,
    managementToken: options.managementToken,
  });
  const status = result.ok
    ? { baseURL, metricsURL, ...summarizeSnapshot(result.body) }
    : summarizeFetchError(baseURL, metricsURL, result);

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
  } else if (options.compact) {
    printCompact(status);
  } else {
    printHuman(baseURL, status);
  }

  process.exitCode = shouldFail(status.level, options.failOn) ? 1 : 0;
}

const executedFile = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (executedFile) {
  main().catch((error) => {
    console.error(`[error] ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  metricsURLFromBaseURL,
  normalizeBaseURL,
  shouldFail,
  summarizeSnapshot,
};
