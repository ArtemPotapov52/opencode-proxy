import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MODELS = {
  'deepseek-v4-flash-free': { name: 'DeepSeek V4 Flash Free' },
  'mimo-v2.5-free': { name: 'MiMo v2.5 Free' },
  'north-mini-code-free': { name: 'North Mini Code Free' },
  'nemotron-3-ultra-free': { name: 'Nemotron 3 Ultra Free' },
  'big-pickle': { name: 'Big Pickle' },
};

function parseArgs(argv) {
  const options = {
    configDir: process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), '.config', 'opencode'),
    providerId: process.env.OPENCODE_PROXY_PROVIDER || 'zenproxy',
    baseURL: process.env.OPENCODE_PROXY_BASE_URL || 'http://127.0.0.1:3000/v1',
    apiKey: process.env.OPENCODE_PROXY_API_KEY || 'public',
    model: process.env.OPENCODE_PROXY_MODEL || 'deepseek-v4-flash-free',
    smallModel: process.env.OPENCODE_PROXY_SMALL_MODEL || 'mimo-v2.5-free',
    install: true,
    dryRun: false,
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
    else if (arg === '--api-key') options.apiKey = next();
    else if (arg === '--model') options.model = next();
    else if (arg === '--small-model') options.smallModel = next();
    else if (arg === '--no-install') options.install = false;
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
  console.log(`Usage: node scripts/setup-opencode.mjs [options]

Options:
  --config-dir <path>     OpenCode config directory
  --provider-id <id>      Provider id to add, default: zenproxy
  --base-url <url>        Proxy base URL, default: http://127.0.0.1:3000/v1
  --api-key <key>         API key sent to the local proxy, default: public
  --model <id>            Default model id, default: deepseek-v4-flash-free
  --small-model <id>      Small model id, default: mimo-v2.5-free
  --no-install            Do not run npm install for @ai-sdk/openai-compatible
  --dry-run               Print the resulting config without writing files
`);
}

function stripJsonComments(input) {
  let output = '';
  let inString = false;
  let quote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    output += char;
  }

  return output;
}

function removeTrailingCommas(input) {
  let output = '';
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      output += char;
      continue;
    }

    if (char === ',') {
      let j = i + 1;
      while (/\s/.test(input[j] || '')) j++;
      if (input[j] === '}' || input[j] === ']') continue;
    }

    output += char;
  }

  return output;
}

function parseJsonc(input, filePath) {
  const cleaned = removeTrailingCommas(stripJsonComments(input.replace(/^\uFEFF/, '')));
  try {
    return JSON.parse(cleaned || '{}');
  } catch (error) {
    throw new Error(`Cannot parse ${filePath}: ${error.message}`);
  }
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { '$schema': 'https://opencode.ai/config.json' };
  }
  return parseJsonc(fs.readFileSync(configPath, 'utf8'), configPath);
}

function modelRef(providerId, model) {
  return model.includes('/') ? model : `${providerId}/${model}`;
}

function applyProxyConfig(config, options) {
  const nextConfig = structuredClone(config);
  nextConfig.$schema ||= 'https://opencode.ai/config.json';
  nextConfig.provider ||= {};
  nextConfig.provider[options.providerId] = {
    npm: '@ai-sdk/openai-compatible',
    name: 'Local Zen Proxy',
    options: {
      baseURL: options.baseURL,
      apiKey: options.apiKey,
    },
    models: DEFAULT_MODELS,
  };
  nextConfig.model = modelRef(options.providerId, options.model);
  nextConfig.small_model = modelRef(options.providerId, options.smallModel);
  return nextConfig;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

function writeConfig(configPath, config, dryRun) {
  const json = `${JSON.stringify(config, null, 2)}\n`;
  if (dryRun) {
    console.log(json);
    return null;
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  let backupPath = null;
  if (fs.existsSync(configPath)) {
    backupPath = `${configPath}.bak-${timestamp()}`;
    fs.copyFileSync(configPath, backupPath);
  }
  fs.writeFileSync(configPath, json, 'utf8');
  return backupPath;
}

function installProviderPackage(configDir, dryRun) {
  const packagePath = path.join(configDir, 'node_modules', '@ai-sdk', 'openai-compatible', 'package.json');
  if (fs.existsSync(packagePath)) {
    console.log('[ok] @ai-sdk/openai-compatible is already installed.');
    return true;
  }

  if (dryRun) {
    console.log('[dry-run] Would run: npm install @ai-sdk/openai-compatible');
    return true;
  }

  console.log('[..] Installing @ai-sdk/openai-compatible in OpenCode config directory...');
  fs.mkdirSync(configDir, { recursive: true });
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['install', '@ai-sdk/openai-compatible'], {
    cwd: configDir,
    stdio: 'inherit',
    shell: false,
  });

  return result.status === 0;
}

async function checkProxy(baseURL) {
  const healthURL = baseURL.replace(/\/v1\/?$/, '/health');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(healthURL, { signal: controller.signal });
    if (!response.ok) return false;
    const body = await response.json();
    return body.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const configDir = path.resolve(options.configDir);
  const configPath = path.join(configDir, 'opencode.jsonc');

  console.log(`[opencode-proxy] Config directory: ${configDir}`);
  const config = readConfig(configPath);
  const nextConfig = applyProxyConfig(config, options);
  const backupPath = writeConfig(configPath, nextConfig, options.dryRun);

  if (!options.dryRun) {
    console.log(`[ok] Updated ${configPath}`);
    if (backupPath) console.log(`[ok] Backup: ${backupPath}`);
  }

  let installed = true;
  if (options.install) {
    installed = installProviderPackage(configDir, options.dryRun);
  }

  const proxyReady = await checkProxy(options.baseURL);
  if (proxyReady) {
    console.log(`[ok] Local proxy is reachable at ${options.baseURL}`);
  } else {
    console.log(`[info] Local proxy is not running yet. Start it with: start-proxy.cmd`);
  }

  console.log(`[ok] Default model: ${nextConfig.model}`);
  console.log(`[ok] Small model: ${nextConfig.small_model}`);
  console.log('[next] Restart OpenCode Desktop, then pick Local Zen Proxy models.');

  if (!installed) {
    console.error('[error] Could not install @ai-sdk/openai-compatible. Check npm/DNS/proxy settings and run this setup again.');
    process.exitCode = 1;
  }
}

const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (executedFile === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[error] ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  DEFAULT_MODELS,
  applyProxyConfig,
  parseJsonc,
  removeTrailingCommas,
  stripJsonComments,
};
