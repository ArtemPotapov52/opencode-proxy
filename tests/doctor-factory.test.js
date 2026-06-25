import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkDefaults,
  checkMissionSettings,
  checkOpenCodeModels,
  findUnexpectedModelValues,
  proxyUrls,
} from '../scripts/doctor-factory.mjs';
import { ensureOpenCodeModels, missionModelSettings } from '../scripts/setup-factory-droid.mjs';

const tempDirs = [];
const options = {
  baseUrl: 'http://127.0.0.1:3000/v1',
  chatModel: 'custom:opencode-deepseek-v4-flash-free',
  workerModel: 'custom:opencode-mimo-v2-5-free',
  validationModel: 'custom:opencode-deepseek-v4-flash-free',
};

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('doctor-factory', () => {
  it('accepts Factory config created by setup-factory-droid', () => {
    const config = ensureOpenCodeModels({}, { ...options, apiKey: 'public' });

    const modelChecks = checkOpenCodeModels(config, options);
    const defaultChecks = checkDefaults(config, options);

    assert.equal(modelChecks.every((check) => check.level === 'ok'), true);
    assert.equal(defaultChecks.every((check) => check.level === 'ok'), true);
  });

  it('flags missing OpenCode models and wrong Mission defaults', () => {
    const checks = [
      ...checkOpenCodeModels({ customModels: [] }, options),
      ...checkDefaults({ general: { missionModelSettings: { workerModel: 'gpt-old' } } }, options),
    ];

    assert.equal(checks.some((check) => check.level === 'fail'), true);
    assert.match(checks.map((check) => check.message).join('\n'), /missing/);
    assert.match(checks.map((check) => check.message).join('\n'), /Mission\/Validation/);
  });

  it('flags stale models in existing mission settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'opencode-proxy-factory-'));
    tempDirs.push(dir);
    const missionDir = join(dir, 'missions', 'abc');
    mkdirSync(missionDir, { recursive: true });
    writeFileSync(join(missionDir, 'model-settings.json'), JSON.stringify({
      workerModel: 'custom:old-model',
      validationWorkerModel: options.validationModel,
    }));

    const checks = checkMissionSettings(dir, options);
    assert.equal(checks.length, 1);
    assert.equal(checks[0].level, 'fail');
    assert.match(checks[0].detail, /custom:old-model/);
  });

  it('accepts current mission model settings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'opencode-proxy-factory-'));
    tempDirs.push(dir);
    const missionDir = join(dir, 'missions', 'abc');
    mkdirSync(missionDir, { recursive: true });
    writeFileSync(join(missionDir, 'model-settings.json'), JSON.stringify(missionModelSettings(options)));

    const checks = checkMissionSettings(dir, options);
    assert.equal(checks.every((check) => check.level === 'ok'), true);
  });

  it('finds nested unexpected model values', () => {
    assert.deepEqual(findUnexpectedModelValues({
      nested: { heavyModel: 'custom:old' },
    }, [options.validationModel]), ['nested.heavyModel=custom:old']);
  });

  it('derives health and models URLs from OpenAI-compatible base URL', () => {
    assert.deepEqual(proxyUrls('http://127.0.0.1:3000/v1/'), {
      healthUrl: 'http://127.0.0.1:3000/health',
      modelsUrl: 'http://127.0.0.1:3000/v1/models',
    });
  });
});
