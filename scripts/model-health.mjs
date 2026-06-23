function parseArgs(argv) {
  const options = {
    baseURL: process.env.OPENCODE_PROXY_BASE_URL || 'http://127.0.0.1:3000/v1',
    timeout: Number(process.env.OPENCODE_PROXY_HEALTH_TIMEOUT || 20_000),
    failOn: process.env.OPENCODE_PROXY_HEALTH_FAIL_ON || 'fail',
    json: false,
    compact: false,
    models: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--base-url') options.baseURL = next();
    else if (arg === '--timeout') options.timeout = Number(next());
    else if (arg === '--fail-on') options.failOn = next();
    else if (arg === '--model') options.models.push(next());
    else if (arg === '--json') options.json = true;
    else if (arg === '--compact') options.compact = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.timeout) || options.timeout <= 0) {
    throw new Error('--timeout must be a positive number of milliseconds');
  }
  if (!['warning', 'fail', 'never'].includes(options.failOn)) {
    throw new Error('--fail-on must be one of: warning, fail, never');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/model-health.mjs [options]

Options:
  --base-url <url>   OpenAI-compatible base URL, default: http://127.0.0.1:3000/v1
  --model <id>       Test only this model. May be passed more than once
  --timeout <ms>     Per-model timeout, default: 20000
  --fail-on <level>  Exit non-zero on warning, fail, or never. Default: fail
  --json             Print JSON
  --compact          Print one-line status
`);
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

async function fetchJSON(url, options = {}, timeoutMs = 20_000) {
  const timeout = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal });
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

function normalizeBaseURL(baseURL) {
  return baseURL.replace(/\/$/, '');
}

async function listModels(baseURL, timeoutMs) {
  const result = await fetchJSON(`${normalizeBaseURL(baseURL)}/models`, {}, timeoutMs);
  if (!result.ok || !Array.isArray(result.body?.data)) {
    return [];
  }
  return result.body.data.map((model) => model.id).filter(Boolean);
}

function errorMessage(result) {
  if (result.error) return result.error;
  const body = result.body;
  if (!body) return `HTTP ${result.status}`;
  if (typeof body.error === 'string') return body.error;
  if (body.error?.message) return body.error.message;
  if (body.message) return body.message;
  if (body.raw) return body.raw;
  return `HTTP ${result.status}`;
}

async function testModel(baseURL, model, timeoutMs) {
  const startedAt = Date.now();
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: 'Return only OK.',
      },
    ],
    max_tokens: 8,
    temperature: 0,
  };

  const result = await fetchJSON(
    `${normalizeBaseURL(baseURL)}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  const latency_ms = Date.now() - startedAt;

  if (!result.ok) {
    return {
      model,
      level: 'fail',
      status: result.status,
      latency_ms,
      error: errorMessage(result),
    };
  }

  return {
    model,
    level: 'ok',
    status: result.status,
    latency_ms,
    returned_model: result.body?.model || '',
    finish_reason: result.body?.choices?.[0]?.finish_reason || '',
    cost: result.body?.cost ?? null,
    total_tokens: result.body?.usage?.total_tokens ?? null,
  };
}

function summarize(results) {
  const ok = results.filter((result) => result.level === 'ok').length;
  const fail = results.length - ok;
  return {
    total: results.length,
    ok,
    fail,
    level: fail === 0 ? 'ok' : ok > 0 ? 'warning' : 'fail',
  };
}

function printHuman(baseURL, summary, results) {
  console.log(`Model health for ${baseURL}`);
  console.log(`  ${summary.ok}/${summary.total} ok`);
  for (const result of results) {
    if (result.level === 'ok') {
      const cost = result.cost == null ? '' : ` cost=${result.cost}`;
      const tokens = result.total_tokens == null ? '' : ` tokens=${result.total_tokens}`;
      console.log(`  ok    ${result.model} (${result.latency_ms}ms)${cost}${tokens}`);
    } else {
      console.log(`  fail  ${result.model} (${result.latency_ms}ms) ${result.error}`);
    }
  }
}

function printCompact(summary, results) {
  const failed = results.filter((result) => result.level !== 'ok').map((result) => result.model);
  if (failed.length === 0) {
    console.log(`models ok ${summary.ok}/${summary.total}`);
  } else {
    console.log(`models ${summary.ok}/${summary.total} ok; failed: ${failed.join(', ')}`);
  }
}

function shouldFail(summary, failOn) {
  if (failOn === 'never') return false;
  if (failOn === 'warning') return summary.fail > 0;
  return summary.ok === 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseURL = normalizeBaseURL(options.baseURL);
  const models = options.models.length > 0 ? options.models : await listModels(baseURL, options.timeout);

  if (models.length === 0) {
    throw new Error(`No models found at ${baseURL}/models. Is the proxy running?`);
  }

  const results = [];
  for (const model of models) {
    results.push(await testModel(baseURL, model, options.timeout));
  }

  const summary = summarize(results);
  if (options.json) {
    console.log(JSON.stringify({ baseURL, summary, results }, null, 2));
  } else if (options.compact) {
    printCompact(summary, results);
  } else {
    printHuman(baseURL, summary, results);
  }

  process.exitCode = shouldFail(summary, options.failOn) ? 1 : 0;
}

const executedFile = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (executedFile) {
  main().catch((error) => {
    console.error(`[error] ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  errorMessage,
  normalizeBaseURL,
  shouldFail,
  summarize,
};
import { fileURLToPath } from 'node:url';
