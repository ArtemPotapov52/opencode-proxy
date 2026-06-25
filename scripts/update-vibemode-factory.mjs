import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'https://r-api.vibemod.pro/v1';
const LEGACY_HOST_RE = /api\.neurogate\.space/i;
const VIBEMODE_HOST_RE = /(?:^|\.)vibemod\.pro/i;

function parseArgs(argv) {
  const options = {
    configDir: process.env.FACTORY_CONFIG_DIR || path.join(os.homedir(), '.factory'),
    baseUrl: process.env.FACTORY_VIBEMODE_BASE_URL || DEFAULT_BASE_URL,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--config-dir') options.configDir = next();
    else if (arg === '--base-url') options.baseUrl = normalizeBaseUrl(next());
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/update-vibemode-factory.mjs [options]

Options:
  --config-dir <path>         Factory config directory, default: %USERPROFILE%\\.factory
  --base-url <url>            VibeMode OpenAI-compatible base URL, default: ${DEFAULT_BASE_URL}
  --dry-run                   Print planned changes without writing files
`);
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/$/, '');
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
  if (dryRun) return null;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let backupPath = null;
  if (fs.existsSync(filePath)) {
    backupPath = `${filePath}.bak-${timestamp()}`;
    fs.copyFileSync(filePath, backupPath);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return backupPath;
}

function isVibemodeModel(model) {
  if (!model || typeof model !== 'object') return false;
  const displayName = String(model.displayName || '');
  const baseUrl = String(model.baseUrl || '');
  return /\[vibemode\]/i.test(displayName)
    || LEGACY_HOST_RE.test(baseUrl)
    || (/\bvibemode\b/i.test(displayName) && VIBEMODE_HOST_RE.test(baseUrl));
}

function migrateVibemodeModels(config, options) {
  const next = structuredClone(config || {});
  const models = Array.isArray(next.customModels) ? [...next.customModels] : [];
  let changedCount = 0;

  next.customModels = models.map((model) => {
    if (!isVibemodeModel(model)) return model;
    const baseUrl = normalizeBaseUrl(model.baseUrl);
    if (baseUrl === options.baseUrl) return model;
    changedCount += 1;
    return { ...model, baseUrl: options.baseUrl };
  });

  return { config: next, changedCount };
}

function updateConfigFile(filePath, options) {
  const before = readJson(filePath, {});
  const { config, changedCount } = migrateVibemodeModels(before, options);
  const backupPath = changedCount > 0
    ? writeJsonWithBackup(filePath, config, options.dryRun)
    : null;
  return { filePath, changedCount, backupPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const configDir = path.resolve(options.configDir);
  const files = ['settings.json', 'factory-settings.json'];

  console.log(`[vibemode] Factory config directory: ${configDir}`);
  console.log(`[vibemode] Target baseUrl: ${options.baseUrl}`);

  for (const file of files) {
    const filePath = path.join(configDir, file);
    const result = updateConfigFile(filePath, options);
    const action = options.dryRun ? 'Would update' : 'Updated';
    if (result.changedCount > 0) {
      console.log(`[ok] ${action} ${result.changedCount} model(s) in ${filePath}`);
      if (result.backupPath) console.log(`[ok] Backup: ${result.backupPath}`);
    } else {
      console.log(`[ok] No VibeMode URL changes needed in ${filePath}`);
    }
  }

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
  DEFAULT_BASE_URL,
  isVibemodeModel,
  migrateVibemodeModels,
  normalizeBaseUrl,
  parseArgs,
};
