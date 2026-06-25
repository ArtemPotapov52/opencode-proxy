import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectFactoryFiles,
  createBackup,
  listBackups,
  restoreBackup,
  safeRelativePath,
} from '../scripts/factory-settings-backup.mjs';

function tempFactoryDir() {
  return mkdtempSync(join(tmpdir(), 'opencode-proxy-factory-backup-'));
}

describe('factory-settings-backup', () => {
  it('backs up Factory settings and mission model settings', () => {
    const configDir = tempFactoryDir();
    try {
      mkdirSync(join(configDir, 'missions', 'abc'), { recursive: true });
      writeFileSync(join(configDir, 'settings.json'), '{"ok":true}\n');
      writeFileSync(join(configDir, 'host.json'), '{"host":true}\n');
      writeFileSync(join(configDir, 'missions', 'abc', 'model-settings.json'), '{"model":"m1"}\n');

      const result = createBackup({ configDir, backupDir: join(configDir, 'backups'), label: 'test', dryRun: false });
      const paths = result.files.map((file) => file.path).sort();

      assert.deepEqual(paths, [
        'host.json',
        'missions/abc/model-settings.json',
        'settings.json',
      ]);
      assert.equal(listBackups({ backupDir: join(configDir, 'backups') }).length, 1);
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('restores a backup and creates a pre-restore backup', () => {
    const configDir = tempFactoryDir();
    try {
      const backupDir = join(configDir, 'backups');
      writeFileSync(join(configDir, 'settings.json'), '{"version":1}\n');
      const backup = createBackup({ configDir, backupDir, label: 'good', dryRun: false });
      writeFileSync(join(configDir, 'settings.json'), '{"version":2}\n');

      const restored = restoreBackup({ configDir, backupDir, backupId: backup.id, yes: true, dryRun: false });

      assert.equal(JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf8')).version, 1);
      assert.ok(restored.preRestore.targetDir.includes('pre-restore'));
      assert.equal(listBackups({ backupDir }).length, 2);
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('rejects unsafe restore paths and restore without confirmation', () => {
    assert.equal(safeRelativePath('settings.json'), true);
    assert.equal(safeRelativePath('../settings.json'), false);
    assert.equal(safeRelativePath('/tmp/settings.json'), false);

    const configDir = tempFactoryDir();
    try {
      writeFileSync(join(configDir, 'settings.json'), '{}\n');
      const backup = createBackup({ configDir, backupDir: join(configDir, 'backups'), label: 'safe', dryRun: false });
      assert.throws(
        () => restoreBackup({ configDir, backupDir: join(configDir, 'backups'), backupId: backup.id, yes: false, dryRun: false }),
        /requires --yes/,
      );
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it('collects only known Factory config files', () => {
    const configDir = tempFactoryDir();
    try {
      writeFileSync(join(configDir, 'settings.json'), '{}\n');
      writeFileSync(join(configDir, 'auth.v2.file'), 'secret\n');

      assert.deepEqual(collectFactoryFiles(configDir), ['settings.json']);
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });
});
