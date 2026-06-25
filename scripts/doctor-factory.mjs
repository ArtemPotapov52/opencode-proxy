import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENCODE_MODELS, missionModelSettings } from './setup-factory-droid.mjs';

const MODEL_SETTING_FIELDS = [
  'model',
  'lightModel',
  'mediumModel',
  'heavyModel',
  'workerModel',
  'validationWorkerModel',
];

function parseArgs(argv) {
  const options = {
    configDir: process.env.FACTORY_CONFIG_DIR || path.join(os.homedir(), '.factory'),
    baseUrl: process.env.FACTORY_OPENCODE_BASE_URL || 'http://127.0.0.1:3000/v1',
    chatModel: process.env.FACTORY_OPENCODE_CHAT_MODEL || 'custom:opencode-deepseek-v4-flash-free',
    workerModel: process.env.FACTORY_OPENCODE_WORKER_MODEL || 'custom:opencode-mimo-v2-5-free',
    validationModel: process.env.FACTORY_OPENCODE_VALIDATION_MODEL || 'custom:opencode-deepseek-v4-flash-free',
    timeout: Number(process.env.FACTORY_DOCTOR_TIMEOUT || 3000),
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--config-dir') options.configDir = next();
    else if (arg === '--base-url') options.baseUrl = next();
    else if (arg === '--chat-model') options.chatModel = next();
    else if (arg === '--worker-model') options.workerModel = next();
    else if (arg === '--validation-model') options.validationModel = next();
    else if (arg === '--timeout') options.timeout = Number(next());
    else if (arg === '--json') options.json = true;
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

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/doctor-factory.mjs [options]

Options:
  --config-dir <path>         Factory config directory, default: %USERPROFILE%\\.factory
  --base-url <url>            Proxy base URL, default: http://127.0.0.1:3000/v1
  --chat-model <id>           Expected default chat model
  --worker-model <id>         Expected Mission worker model
  --validation-model <id>     Expected Validation worker model
  --timeout <ms>              HTTP timeout, default: 3000
  --json                      Print machine-readable result
`);
}

function ok(message, detail = '') {
  return { level: 'ok', message, detail };
}

function warn(message, detail = '') {
  return { level: 'warn', message, detail };
}

function fail(message, detail = '') {
  return { level: 'fail', message, detail };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }
}

function expectedModelIds() {
  return OPENCODE_MODELS.map((model) => model.id);
}

function expectedRawModels() {
  return OPENCODE_MODELS.map((model) => model.model);
}

function checkFactoryConfigFile(filePath, options) {
  const checks = [];
  if (!fs.existsSync(filePath)) {
    checks.push(fail(`${path.basename(filePath)} is missing`, filePath));
    return checks;
  }

  checks.push(ok(`${path.basename(filePath)} exists`, filePath));
  let config;
  try {
    config = readJson(filePath);
  } catch (error) {
    checks.push(fail(error.message));
    return checks;
  }

  checks.push(...checkOpenCodeModels(config, options, path.basename(filePath)));
  checks.push(...checkDefaults(config, options, path.basename(filePath)));
  return checks;
}

function checkOpenCodeModels(config, options, label = 'settings') {
  const checks = [];
  const models = Array.isArray(config.customModels) ? config.customModels : [];
  const byId = new Map(models.map((model) => [model.id, model]));

  for (const template of OPENCODE_MODELS) {
    const model = byId.get(template.id);
    if (!model) {
      checks.push(fail(`${label}: missing ${template.displayName}`, template.id));
      continue;
    }

    if (model.baseUrl !== options.baseUrl) {
      checks.push(fail(`${label}: ${template.id} uses wrong baseUrl`, `${model.baseUrl || '<missing>'} != ${options.baseUrl}`));
    } else if (model.model !== template.model) {
      checks.push(fail(`${label}: ${template.id} points to wrong upstream model`, `${model.model || '<missing>'} != ${template.model}`));
    } else {
      checks.push(ok(`${label}: ${template.displayName} is configured`));
    }
  }

  return checks;
}

function checkDefaults(config, options, label = 'settings') {
  const checks = [];
  const general = config.general || {};
  const sessionModel = config.sessionDefaultSettings?.model || general.sessionDefaultSettings?.model || '';
  if (sessionModel === options.chatModel) {
    checks.push(ok(`${label}: default chat model is OpenCode Proxy`, sessionModel));
  } else {
    checks.push(fail(`${label}: default chat model is not expected`, `${sessionModel || '<missing>'} != ${options.chatModel}`));
  }

  const subagent = general.subagentModelSettings || {};
  if (subagent.lightModel === options.workerModel && subagent.heavyModel === options.validationModel) {
    checks.push(ok(`${label}: subagent light/heavy models are configured`));
  } else {
    checks.push(fail(
      `${label}: subagent model settings need update`,
      `light=${subagent.lightModel || '<missing>'}, heavy=${subagent.heavyModel || '<missing>'}`,
    ));
  }

  const mission = general.missionModelSettings || {};
  if (mission.workerModel === options.workerModel && mission.validationWorkerModel === options.validationModel) {
    checks.push(ok(`${label}: Mission and Validation models are configured`));
  } else {
    checks.push(fail(
      `${label}: Mission/Validation model settings need update`,
      `worker=${mission.workerModel || '<missing>'}, validation=${mission.validationWorkerModel || '<missing>'}`,
    ));
  }

  return checks;
}

function checkMissionSettings(configDir, options) {
  const checks = [];
  const missionsDir = path.join(configDir, 'missions');
  if (!fs.existsSync(missionsDir)) {
    return [ok('No existing Factory missions found', missionsDir)];
  }

  const expected = missionModelSettings(options);
  let inspected = 0;
  for (const entry of fs.readdirSync(missionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const settingsPath = path.join(missionsDir, entry.name, 'model-settings.json');
    if (!fs.existsSync(settingsPath)) continue;
    inspected += 1;

    let settings;
    try {
      settings = readJson(settingsPath);
    } catch (error) {
      checks.push(fail(error.message));
      continue;
    }

    const stale = [];
    for (const [field, expectedValue] of Object.entries(expected)) {
      if (settings[field] !== expectedValue) {
        stale.push(`${field}=${settings[field] || '<missing>'}`);
      }
    }

    for (const issue of findUnexpectedModelValues(settings, expectedModelIds())) {
      if (!stale.includes(issue)) stale.push(issue);
    }

    if (stale.length > 0) {
      checks.push(fail(`Mission ${entry.name} has stale model settings`, `${settingsPath}: ${stale.join(', ')}`));
    } else {
      checks.push(ok(`Mission ${entry.name} uses OpenCode Proxy models`, settingsPath));
    }
  }

  if (inspected === 0) checks.push(ok('No mission model-settings.json files found', missionsDir));
  return checks;
}

function findUnexpectedModelValues(value, allowedIds, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  const output = [];

  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (MODEL_SETTING_FIELDS.includes(key) && typeof child === 'string' && child && !allowedIds.includes(child)) {
      output.push(`${childPath}=${child}`);
    } else if (child && typeof child === 'object') {
      output.push(...findUnexpectedModelValues(child, allowedIds, childPath));
    }
  }

  return output;
}

function proxyUrls(baseUrl) {
  const normalized = baseUrl.replace(/\/$/, '');
  return {
    modelsUrl: `${normalized}/models`,
    healthUrl: normalized.replace(/\/v1$/, '/health'),
  };
}

async function fetchJSON(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 300) };
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkProxy(options) {
  const checks = [];
  const { healthUrl, modelsUrl } = proxyUrls(options.baseUrl);
  const health = await fetchJSON(healthUrl, options.timeout);
  if (health.ok && health.body?.status === 'ok') {
    checks.push(ok('Proxy health is ok', healthUrl));
  } else {
    checks.push(fail('Proxy is not reachable', `${healthUrl}: ${health.error || `HTTP ${health.status}`}`));
    return checks;
  }

  const models = await fetchJSON(modelsUrl, options.timeout);
  if (!models.ok || !Array.isArray(models.body?.data)) {
    checks.push(fail('Proxy models endpoint failed', `${modelsUrl}: ${models.error || `HTTP ${models.status}`}`));
    return checks;
  }

  const available = new Set(models.body.data.map((model) => model.id).filter(Boolean));
  const missing = expectedRawModels().filter((model) => !available.has(model));
  if (missing.length > 0) {
    checks.push(fail('Proxy does not expose all Factory upstream models', missing.join(', ')));
  } else {
    checks.push(ok(`Proxy exposes ${models.body.data.length} model(s)`, modelsUrl));
  }

  return checks;
}

async function runDoctor(options) {
  const configDir = path.resolve(options.configDir);
  const checks = [];
  checks.push(fs.existsSync(configDir) ? ok('Factory config directory exists', configDir) : fail('Factory config directory is missing', configDir));
  checks.push(...checkFactoryConfigFile(path.join(configDir, 'settings.json'), options));

  const factorySettingsPath = path.join(configDir, 'factory-settings.json');
  if (fs.existsSync(factorySettingsPath)) {
    checks.push(...checkFactoryConfigFile(factorySettingsPath, options));
  } else {
    checks.push(warn('factory-settings.json is missing', 'Run setup-factory-droid.cmd if Factory uses this file on your version.'));
  }

  checks.push(...checkMissionSettings(configDir, options));
  checks.push(...await checkProxy(options));
  return {
    ok: !checks.some((check) => check.level === 'fail'),
    checks,
  };
}

function printChecks(configDir, result) {
  console.log(`[factory-doctor] Factory config directory: ${configDir}`);
  for (const check of result.checks) {
    const suffix = check.detail ? ` - ${check.detail}` : '';
    console.log(`[${check.level}] ${check.message}${suffix}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runDoctor(options);
  if (options.json) {
    console.log(JSON.stringify({ configDir: path.resolve(options.configDir), ...result }, null, 2));
  } else {
    printChecks(path.resolve(options.configDir), result);
    if (!result.ok) console.log('[next] Run setup-factory-droid.cmd, start-proxy.cmd, then run doctor-factory.cmd again.');
  }
  process.exitCode = result.ok ? 0 : 1;
}

const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (executedFile === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[error] ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  checkDefaults,
  checkMissionSettings,
  checkOpenCodeModels,
  expectedModelIds,
  expectedRawModels,
  findUnexpectedModelValues,
  parseArgs,
  proxyUrls,
  runDoctor,
};
