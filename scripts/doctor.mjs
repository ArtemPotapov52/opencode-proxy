import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseJsonc } from './setup-opencode.mjs';

function ok(message) {
  console.log(`[ok] ${message}`);
}

function warn(message) {
  console.log(`[warn] ${message}`);
}

function fail(message) {
  console.log(`[fail] ${message}`);
}

function parseArgs(argv) {
  const options = {
    configDir: process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), '.config', 'opencode'),
    providerId: process.env.OPENCODE_PROXY_PROVIDER || 'zenproxy',
    baseURL: process.env.OPENCODE_PROXY_BASE_URL || 'http://127.0.0.1:3000/v1',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--config-dir') options.configDir = next();
    else if (arg === '--provider-id') options.providerId = next();
    else if (arg === '--base-url') options.baseURL = next();
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/doctor.mjs [--config-dir <path>] [--provider-id <id>] [--base-url <url>]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    return { ok: response.ok, status: response.status, body: text ? JSON.parse(text) : null };
  } catch (error) {
    return { ok: false, status: 0, error };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const configDir = path.resolve(options.configDir);
  const configPath = path.join(configDir, 'opencode.jsonc');
  let hasFailure = false;

  console.log(`[doctor] OpenCode config directory: ${configDir}`);

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) ok(`Node.js ${process.version}`);
  else {
    fail(`Node.js ${process.version}; Node.js 18+ is required`);
    hasFailure = true;
  }

  const providerPackage = path.join(configDir, 'node_modules', '@ai-sdk', 'openai-compatible', 'package.json');
  if (fs.existsSync(providerPackage)) ok('@ai-sdk/openai-compatible is installed');
  else {
    fail('@ai-sdk/openai-compatible is missing; run install-opencode.cmd');
    hasFailure = true;
  }

  if (!fs.existsSync(configPath)) {
    fail(`OpenCode config is missing: ${configPath}`);
    hasFailure = true;
  } else {
    try {
      const config = parseJsonc(fs.readFileSync(configPath, 'utf8'), configPath);
      const provider = config.provider?.[options.providerId];
      if (provider) ok(`Provider ${options.providerId} exists`);
      else {
        fail(`Provider ${options.providerId} is missing`);
        hasFailure = true;
      }

      if (provider?.options?.baseURL === options.baseURL) ok(`Provider baseURL is ${options.baseURL}`);
      else {
        warn(`Provider baseURL is ${provider?.options?.baseURL || '<missing>'}; expected ${options.baseURL}`);
      }

      if (String(config.model || '').startsWith(`${options.providerId}/`)) ok(`Default model is ${config.model}`);
      else warn(`Default model is ${config.model || '<missing>'}; expected ${options.providerId}/...`);

      if (String(config.small_model || '').startsWith(`${options.providerId}/`)) ok(`Small model is ${config.small_model}`);
      else warn(`Small model is ${config.small_model || '<missing>'}; expected ${options.providerId}/...`);
    } catch (error) {
      fail(error.message);
      hasFailure = true;
    }
  }

  const healthURL = options.baseURL.replace(/\/v1\/?$/, '/health');
  const modelsURL = `${options.baseURL.replace(/\/$/, '')}/models`;
  const health = await fetchJSON(healthURL);
  if (health.ok && health.body?.status === 'ok') ok(`Proxy health is ok: ${healthURL}`);
  else {
    fail(`Proxy is not reachable at ${healthURL}; run start-proxy.cmd`);
    hasFailure = true;
  }

  const models = await fetchJSON(modelsURL);
  if (models.ok && Array.isArray(models.body?.data)) {
    ok(`Proxy exposes ${models.body.data.length} model(s)`);
  } else if (health.ok) {
    warn(`Proxy health works, but models endpoint failed: ${modelsURL}`);
  }

  process.exitCode = hasFailure ? 1 : 0;
}

main().catch((error) => {
  fail(error.message);
  process.exitCode = 1;
});
