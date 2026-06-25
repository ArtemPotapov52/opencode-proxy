import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_FILES = [
  'settings.json',
  'factory-settings.json',
  'host.json',
  'computer.json',
];

function parseArgs(argv) {
  const options = {
    command: 'backup',
    backupId: '',
    configDir: process.env.FACTORY_CONFIG_DIR || path.join(os.homedir(), '.factory'),
    backupDir: process.env.FACTORY_BACKUP_DIR || '',
    label: '',
    dryRun: false,
    yes: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };

    if (arg === '--config-dir') options.configDir = next();
    else if (arg === '--backup-dir') options.backupDir = next();
    else if (arg === '--label') options.label = next();
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) options.command = positional[0];
  if (positional.length > 1) options.backupId = positional[1];
  if (positional.length > 2) throw new Error(`Unexpected argument: ${positional[2]}`);
  if (!['backup', 'list', 'restore'].includes(options.command)) {
    throw new Error('Command must be one of: backup, list, restore');
  }

  options.configDir = path.resolve(options.configDir);
  options.backupDir = path.resolve(options.backupDir || path.join(options.configDir, 'backups'));
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-settings-backup.mjs [command] [backup-id] [options]

Commands:
  backup                    Save Factory settings into a timestamped local backup
  list                      List saved backups
  restore <backup-id>       Restore a backup; requires --yes

Options:
  --config-dir <path>       Factory config directory, default: %USERPROFILE%\\.factory
  --backup-dir <path>       Backup directory, default: %USERPROFILE%\\.factory\\backups
  --label <text>            Optional backup label
  --dry-run                 Show what would happen
  --yes, -y                 Required for restore
`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function safeRelativePath(relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) return false;
  const normalized = path.normalize(relativePath);
  return normalized === relativePath && !normalized.startsWith('..') && !normalized.includes(`..${path.sep}`);
}

function collectFactoryFiles(configDir) {
  const files = [];

  for (const relativePath of DEFAULT_FILES) {
    const absolutePath = path.join(configDir, relativePath);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      files.push(relativePath);
    }
  }

  const missionsDir = path.join(configDir, 'missions');
  if (fs.existsSync(missionsDir)) {
    for (const entry of fs.readdirSync(missionsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const relativePath = path.join('missions', entry.name, 'model-settings.json');
      const absolutePath = path.join(configDir, relativePath);
      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        files.push(relativePath);
      }
    }
  }

  return files.sort();
}

function createBackup(options) {
  const files = collectFactoryFiles(options.configDir);
  const id = `${timestamp()}${options.label ? `-${slug(options.label)}` : ''}`;
  const targetDir = path.join(options.backupDir, id);
  const manifest = {
    version: 1,
    id,
    label: options.label || '',
    createdAt: new Date().toISOString(),
    configDir: options.configDir,
    files: [],
  };

  for (const relativePath of files) {
    const sourcePath = path.join(options.configDir, relativePath);
    const stat = fs.statSync(sourcePath);
    manifest.files.push({
      path: relativePath.replaceAll(path.sep, '/'),
      bytes: stat.size,
      sha256: hashFile(sourcePath),
    });
  }

  if (options.dryRun) {
    return { id, targetDir, files: manifest.files, dryRun: true };
  }

  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of manifest.files) {
    const relativePath = file.path.split('/').join(path.sep);
    const sourcePath = path.join(options.configDir, relativePath);
    const targetPath = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
  fs.writeFileSync(path.join(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return { id, targetDir, files: manifest.files, dryRun: false };
}

function listBackups(options) {
  if (!fs.existsSync(options.backupDir)) return [];
  const backups = [];

  for (const entry of fs.readdirSync(options.backupDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(options.backupDir, entry.name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      backups.push({
        id: entry.name,
        createdAt: manifest.createdAt || '',
        label: manifest.label || '',
        files: Array.isArray(manifest.files) ? manifest.files.length : 0,
      });
    } catch {
      backups.push({ id: entry.name, createdAt: '', label: '<invalid manifest>', files: 0 });
    }
  }

  return backups.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function resolveBackupPath(options) {
  if (!options.backupId) throw new Error('restore requires <backup-id>');
  const backupPath = path.resolve(options.backupDir, options.backupId);
  const root = `${path.resolve(options.backupDir)}${path.sep}`;
  if (!backupPath.startsWith(root)) throw new Error('Backup id resolves outside backup directory');
  return backupPath;
}

function readManifest(backupPath) {
  const manifestPath = path.join(backupPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Backup manifest is missing: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.files)) throw new Error('Backup manifest files must be an array');
  return manifest;
}

function restoreBackup(options) {
  if (!options.yes && !options.dryRun) throw new Error('restore requires --yes');

  const backupPath = resolveBackupPath(options);
  const manifest = readManifest(backupPath);
  const files = manifest.files.map((file) => {
    const relativePath = String(file.path || '').split('/').join(path.sep);
    if (!safeRelativePath(relativePath)) throw new Error(`Unsafe backup path: ${file.path}`);
    return { ...file, relativePath };
  });

  if (options.dryRun) {
    return { id: options.backupId, files, preRestore: null, dryRun: true };
  }

  const preRestore = createBackup({ ...options, label: `pre-restore-${options.backupId}`, dryRun: false });
  for (const file of files) {
    const sourcePath = path.join(backupPath, file.relativePath);
    if (!fs.existsSync(sourcePath)) throw new Error(`Backup file is missing: ${sourcePath}`);
    if (file.sha256 && hashFile(sourcePath) !== file.sha256) {
      throw new Error(`Backup checksum mismatch: ${file.path}`);
    }
    const targetPath = path.join(options.configDir, file.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }

  return { id: options.backupId, files, preRestore, dryRun: false };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === 'backup') {
    const result = createBackup(options);
    const action = result.dryRun ? 'Would save' : 'Saved';
    console.log(`[factory-backup] ${action} ${result.files.length} file(s)`);
    console.log(`[factory-backup] Backup: ${result.targetDir}`);
    return;
  }

  if (options.command === 'list') {
    const backups = listBackups(options);
    console.log(`[factory-backup] Backup directory: ${options.backupDir}`);
    if (backups.length === 0) {
      console.log('[factory-backup] No backups found');
      return;
    }
    for (const backup of backups) {
      const label = backup.label ? ` ${backup.label}` : '';
      console.log(`${backup.id}\t${backup.files} file(s)${label}`);
    }
    return;
  }

  const result = restoreBackup(options);
  const action = result.dryRun ? 'Would restore' : 'Restored';
  console.log(`[factory-backup] ${action} ${result.files.length} file(s) from ${result.id}`);
  if (result.preRestore) {
    console.log(`[factory-backup] Pre-restore backup: ${result.preRestore.targetDir}`);
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
  collectFactoryFiles,
  createBackup,
  listBackups,
  parseArgs,
  restoreBackup,
  safeRelativePath,
};
