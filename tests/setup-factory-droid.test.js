import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureOpenCodeModels,
  missionModelSettings,
  redactSecrets,
  validateModelIds,
} from '../scripts/setup-factory-droid.mjs';

const options = {
  baseUrl: 'http://127.0.0.1:3000/v1',
  apiKey: 'public',
  chatModel: 'custom:opencode-deepseek-v4-flash-free',
  workerModel: 'custom:opencode-mimo-v2-5-free',
  validationModel: 'custom:opencode-deepseek-v4-flash-free',
};

describe('setup-factory-droid', () => {
  it('adds OpenCode models without removing existing custom models', () => {
    const existing = {
      customModels: [
        {
          id: 'custom:existing-paid-model',
          index: 12,
          model: 'existing-paid-model',
          displayName: 'Existing paid model',
          baseUrl: 'https://api.example.test/v1',
          apiKey: 'keep-me',
          provider: 'generic-chat-completion-api',
        },
      ],
    };

    const next = ensureOpenCodeModels(existing, options);
    const ids = next.customModels.map((model) => model.id);

    assert.ok(ids.includes('custom:existing-paid-model'));
    assert.ok(ids.includes('custom:opencode-deepseek-v4-flash-free'));
    assert.ok(ids.includes('custom:opencode-mimo-v2-5-free'));
    assert.equal(next.customModels.find((model) => model.id === 'custom:existing-paid-model').apiKey, 'keep-me');
    assert.equal(
      next.customModels.find((model) => model.id === 'custom:opencode-deepseek-v4-flash-free').baseUrl,
      'http://127.0.0.1:3000/v1',
    );
  });

  it('sets chat, subagent, mission, and validation defaults', () => {
    const next = ensureOpenCodeModels({}, options);

    assert.equal(next.sessionDefaultSettings.model, options.chatModel);
    assert.equal(next.general.sessionDefaultSettings.model, options.chatModel);
    assert.equal(next.general.subagentModelSettings.lightModel, options.workerModel);
    assert.equal(next.general.subagentModelSettings.heavyModel, options.validationModel);
    assert.equal(next.general.missionModelSettings.workerModel, options.workerModel);
    assert.equal(next.general.missionModelSettings.validationWorkerModel, options.validationModel);
    assert.equal(next.general.missionModelSettings.validationWorkerReasoningEffort, 'none');
  });

  it('returns per-mission model settings for existing missions', () => {
    assert.deepEqual(missionModelSettings(options), {
      workerModel: options.workerModel,
      workerReasoningEffort: 'none',
      validationWorkerModel: options.validationModel,
      validationWorkerReasoningEffort: 'none',
    });
  });

  it('rejects model ids that are not installed by this setup', () => {
    assert.throws(
      () => validateModelIds({ ...options, validationModel: 'minimax-m2.7' }),
      /validationModel must be one of/,
    );
  });

  it('redacts existing BYOK secrets in dry-run output data', () => {
    const redacted = redactSecrets({
      customModels: [
        {
          id: 'custom:existing',
          apiKey: 'redact-me',
        },
      ],
      nested: {
        accessToken: 'token-secret',
      },
    });

    assert.equal(redacted.customModels[0].apiKey, '[redacted]');
    assert.equal(redacted.nested.accessToken, '[redacted]');
  });
});
