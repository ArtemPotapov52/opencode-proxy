import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OPENCODE_MODELS = [
  {
    id: 'custom:opencode-deepseek-v4-flash-free',
    model: 'deepseek-v4-flash-free',
    displayName: 'deepseek-v4-flash-free [OpenCode Proxy]',
    noImageSupport: false,
  },
  {
    id: 'custom:opencode-mimo-v2-5-free',
    model: 'mimo-v2.5-free',
    displayName: 'mimo-v2.5-free [OpenCode Proxy]',
    noImageSupport: true,
  },
  {
    id: 'custom:opencode-north-mini-code-free',
    model: 'north-mini-code-free',
    displayName: 'north-mini-code-free [OpenCode Proxy]',
    noImageSupport: true,
  },
  {
    id: 'custom:opencode-nemotron-3-ultra-free',
    model: 'nemotron-3-ultra-free',
    displayName: 'nemotron-3-ultra-free [OpenCode Proxy]',
    noImageSupport: true,
  },
];

function parseArgs(argv) {
  const options = {
    configDir: process.env.FACTORY_CONFIG_DIR || path.join(os.homedir(), '.factory'),
    baseUrl: process.env.FACTORY_OPENCODE_BASE_URL || 'http://127.0.0.1:3000/v1',
    apiKey: process.env.FACTORY_OPENCODE_API_KEY || 'public',
    chatModel: process.env.FACTORY_OPENCODE_CHAT_MODEL || 'custom:opencode-deepseek-v4-flash-free',
    workerModel: process.env.FACTORY_OPENCODE_WORKER_MODEL || 'custom:opencode-mimo-v2-5-free',
    validationModel: process.env.FACTORY_OPENCODE_VALIDATION_MODEL || 'custom:opencode-deepseek-v4-flash-free',
    updateMissions: true,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--config-dir') options.configDir = next();
    else if (arg === '--base-url') options.baseUrl = next();
    else if (arg === '--api-key') options.apiKey = next();
    else if (arg === '--chat-model') options.chatModel = next();
    else if (arg === '--worker-model') options.workerModel = next();
    else if (arg === '--validation-model') options.validationModel = next();
    else if (arg === '--no-missions') options.updateMissions = false;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/setup-factory-droid.mjs [options]

Options:
  --config-dir <path>         Factory config directory, default: %USERPROFILE%\\.factory
  --base-url <url>            Proxy base URL, default: http://127.0.0.1:3000/v1
  --api-key <key>             API key sent to the local proxy, default: public
  --chat-model <id>           Default chat model
  --worker-model <id>         Mission worker/subagent light model
  --validation-model <id>     Mission validation worker model
  --no-missions               Do not update existing missions/*/model-settings.json
  --dry-run                   Print planned changes without writing files
`);
}

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return structuredClone(fallback);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeJsonWithBackup(filePath, data, dryRun) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  if (dryRun) {
    console.log(`[dry-run] Would write ${filePath}`);
    console.log(`${JSON.stringify(redactSecrets(data), null, 2)}\n`);
    return null;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let backupPath = null;
  if (fs.existsSync(filePath)) {
    backupPath = `${filePath}.bak-${timestamp()}`;
    fs.copyFileSync(filePath, backupPath);
  }
  fs.writeFileSync(filePath, json, 'utf8');
  return backupPath;
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== 'object') return value;

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (/apiKey|token|secret|password|authorization/i.test(key)) {
      output[key] = child ? '[redacted]' : child;
    } else {
      output[key] = redactSecrets(child);
    }
  }
  return output;
}

function nextIndex(models) {
  return models.reduce((max, model) => Math.max(max, Number(model.index) || 0), -1) + 1;
}

function makeCustomModel(template, options, index) {
  return {
    id: template.id,
    index,
    model: template.model,
    displayName: template.displayName,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    provider: 'generic-chat-completion-api',
    maxContextLimit: 128000,
    maxOutputTokens: 8192,
    noImageSupport: template.noImageSupport,
  };
}

function ensureOpenCodeModels(config, options) {
  const next = structuredClone(config || {});
  const models = Array.isArray(next.customModels) ? [...next.customModels] : [];
  const byId = new Map(models.map((model, index) => [model.id, { model, index }]));
  let index = nextIndex(models);

  for (const template of OPENCODE_MODELS) {
    const existing = byId.get(template.id);
    const value = makeCustomModel(template, options, existing ? existing.model.index : index++);
    if (existing) {
      models[existing.index] = { ...existing.model, ...value };
    } else {
      models.push(value);
    }
  }

  next.customModels = models;
  next.sessionDefaultSettings = {
    ...(next.sessionDefaultSettings || {}),
    model: options.chatModel,
    reasoningEffort: 'medium',
    interactionMode: next.sessionDefaultSettings?.interactionMode || 'auto',
    autonomyLevel: next.sessionDefaultSettings?.autonomyLevel || 'medium',
    autonomyMode: next.sessionDefaultSettings?.autonomyMode || 'auto-medium',
  };
  next.general = {
    ...(next.general || {}),
    sessionDefaultSettings: {
      ...(next.general?.sessionDefaultSettings || {}),
      model: options.chatModel,
      reasoningEffort: 'medium',
      autonomyMode: next.general?.sessionDefaultSettings?.autonomyMode || 'normal',
    },
    subagentModelSettings: {
      ...(next.general?.subagentModelSettings || {}),
      lightModel: options.workerModel,
      lightReasoningEffort: 'none',
      mediumModel: options.chatModel,
      mediumReasoningEffort: 'none',
      heavyModel: options.validationModel,
      heavyReasoningEffort: 'none',
    },
    missionModelSettings: {
      ...(next.general?.missionModelSettings || {}),
      workerModel: options.workerModel,
      workerReasoningEffort: 'none',
      validationWorkerModel: options.validationModel,
      validationWorkerReasoningEffort: 'none',
    },
  };

  return next;
}

function missionModelSettings(options) {
  return {
    workerModel: options.workerModel,
    workerReasoningEffort: 'none',
    validationWorkerModel: options.validationModel,
    validationWorkerReasoningEffort: 'none',
  };
}

function updateExistingMissions(configDir, options) {
  const missionsDir = path.join(configDir, 'missions');
  const updates = [];
  if (!fs.existsSync(missionsDir)) return updates;

  for (const entry of fs.readdirSync(missionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const settingsPath = path.join(missionsDir, entry.name, 'model-settings.json');
    if (!fs.existsSync(settingsPath)) continue;

    const before = readJson(settingsPath, {});
    const after = { ...before, ...missionModelSettings(options) };
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    const backupPath = writeJsonWithBackup(settingsPath, after, options.dryRun);
    updates.push({ mission: entry.name, settingsPath, backupPath });
  }

  return updates;
}

function validateModelIds(options) {
  const ids = new Set(OPENCODE_MODELS.map((model) => model.id));
  for (const field of ['chatModel', 'workerModel', 'validationModel']) {
    if (!ids.has(options[field])) {
      throw new Error(`${field} must be one of: ${[...ids].join(', ')}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  validateModelIds(options);
  const configDir = path.resolve(options.configDir);
  const files = ['settings.json', 'factory-settings.json'];

  console.log(`[opencode-proxy] Factory config directory: ${configDir}`);
  for (const file of files) {
    const filePath = path.join(configDir, file);
    const config = readJson(filePath, {});
    const nextConfig = ensureOpenCodeModels(config, options);
    const backupPath = writeJsonWithBackup(filePath, nextConfig, options.dryRun);
    console.log(`[ok] Updated ${filePath}`);
    if (backupPath) console.log(`[ok] Backup: ${backupPath}`);
  }

  if (options.updateMissions) {
    const updates = updateExistingMissions(configDir, options);
    if (updates.length === 0) {
      console.log('[ok] No existing mission model-settings.json files needed changes.');
    } else {
      for (const update of updates) {
        console.log(`[ok] Updated mission ${update.mission}: ${update.settingsPath}`);
        if (update.backupPath) console.log(`[ok] Backup: ${update.backupPath}`);
      }
    }
  }

  console.log(`[ok] Default chat model: ${options.chatModel}`);
  console.log(`[ok] Mission worker model: ${options.workerModel}`);
  console.log(`[ok] Mission validation model: ${options.validationModel}`);
  console.log('[next] Restart Factory Droid/Desktop so it reloads the config files.');
}

const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (executedFile === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[error] ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  OPENCODE_MODELS,
  ensureOpenCodeModels,
  missionModelSettings,
  parseArgs,
  redactSecrets,
  validateModelIds,
};
