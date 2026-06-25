import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.idea', '.vscode']);
const SKIP_EXTENSIONS = new Set(['.zip', '.7z', '.tar', '.gz', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf']);
const SENSITIVE_PATH_SEGMENTS = new Set(['.factory', '.aws', '.ssh']);
const SENSITIVE_FILENAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  'auth.json',
  'credentials.json',
  'token.json',
]);

const SECRET_PATTERNS = [
  {
    name: 'OpenAI-style API key',
    pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: 'GitHub token',
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  },
  {
    name: 'generic secret assignment',
    pattern: /\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|AUTHORIZATION)\b\s*[:=]\s*["']?([A-Za-z0-9._~+/=-]{12,})["']?/i,
    allowValue: (value) => /^(public|example|your_|your-|changeme|redacted|\[redacted\])$/i.test(value),
  },
];

function listGitFiles(root) {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function listFilesRecursive(root, dir = root) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...listFilesRecursive(root, path.join(dir, entry.name)));
    } else {
      files.push(path.relative(root, path.join(dir, entry.name)));
    }
  }
  return files;
}

function shouldScanContent(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  return !SKIP_EXTENSIONS.has(ext);
}

function isSensitivePath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  const filename = path.basename(normalized).toLowerCase();
  const parts = normalized.split('/').map((part) => part.toLowerCase());
  if (filename === '.env.example') return false;
  if (SENSITIVE_FILENAMES.has(filename)) return true;
  return parts.some((part) => SENSITIVE_PATH_SEGMENTS.has(part));
}

function scanText(text, relativePath) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/your_key|your-token|example|redacted|\[redacted\]/i.test(line)) continue;
    if (/process\.env|options\.|config\.|this\.|event\.|redact/i.test(line)) continue;
    for (const rule of SECRET_PATTERNS) {
      const match = line.match(rule.pattern);
      if (!match) continue;
      const value = match[1] || match[0];
      if (rule.allowValue?.(value)) continue;
      findings.push({
        file: relativePath,
        line: index + 1,
        rule: rule.name,
      });
    }
  }
  return findings;
}

function scanFiles(root, files) {
  const findings = [];
  for (const relativePath of files) {
    if (isSensitivePath(relativePath)) {
      findings.push({ file: relativePath, line: 0, rule: 'sensitive path' });
      continue;
    }
    if (!shouldScanContent(relativePath)) continue;

    const fullPath = path.join(root, relativePath);
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size > 1024 * 1024) continue;
    const text = fs.readFileSync(fullPath, 'utf8');
    findings.push(...scanText(text, relativePath));
  }
  return findings;
}

function runSecretScan(root = process.cwd()) {
  const files = listGitFiles(root) || listFilesRecursive(root);
  return scanFiles(root, files);
}

function main() {
  const root = path.resolve(process.argv[2] || process.cwd());
  const findings = runSecretScan(root);
  if (findings.length === 0) {
    console.log('[ok] Secret scan passed');
    return;
  }

  console.log('[fail] Secret scan found possible private data:');
  for (const finding of findings) {
    const location = finding.line > 0 ? `${finding.file}:${finding.line}` : finding.file;
    console.log(`  - ${location} (${finding.rule})`);
  }
  process.exitCode = 1;
}

const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (executedFile === fileURLToPath(import.meta.url)) {
  main();
}

export {
  isSensitivePath,
  runSecretScan,
  scanFiles,
  scanText,
};
