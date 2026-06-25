import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageStore, defaultUsageDbPath } from '../src/usage_store.js';

function parseArgs(argv) {
  const options = {
    path: process.env.USAGE_DB_PATH || defaultUsageDbPath(),
    days: Number(process.env.USAGE_RETENTION_DAYS || 30),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--path') options.path = next();
    else if (arg === '--days') options.days = Number(next());
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.days) || options.days <= 0) {
    throw new Error('--days must be a positive number');
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/cleanup-usage.mjs [--path <usage.jsonl>] [--days <n>]

Keeps only the configured number of local-day rows in the privacy-safe usage log.
Default path: ${defaultUsageDbPath()}
`);
}

function cleanupUsage(options) {
  const store = new UsageStore({
    path: options.path,
    retentionDays: Math.floor(options.days),
    pruneIntervalMs: 1,
  });
  const before = store.readEvents().length;
  const pruned = store.pruneOldEvents(Date.now());
  const after = store.readEvents().length;
  return { path: store.path, before, after, pruned, error: store.lastError };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = cleanupUsage(options);
  if (result.error) {
    console.error(`[fail] ${result.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[ok] Usage log cleaned: ${result.path}`);
  console.log(`[ok] Rows kept: ${result.after}/${result.before}`);
}

const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (executedFile === fileURLToPath(import.meta.url)) {
  main();
}

export { cleanupUsage, parseArgs };
