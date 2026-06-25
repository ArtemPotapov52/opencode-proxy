import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BASE_URL,
  isVibemodeModel,
  migrateVibemodeModels,
  normalizeBaseUrl,
} from '../scripts/update-vibemode-factory.mjs';

describe('update-vibemode-factory', () => {
  it('updates legacy NeuroGate VibeMode models without touching keys', () => {
    const config = {
      customModels: [
        {
          id: 'custom:mimo-v2-5-7',
          displayName: 'mimo-v2.5 [Vibemode]',
          baseUrl: 'https://api.neurogate.space/v1',
          apiKey: 'keep-me',
        },
        {
          id: 'custom:opencode-mimo-v2-5-free',
          displayName: 'mimo-v2.5-free [OpenCode Proxy]',
          baseUrl: 'http://127.0.0.1:3000/v1',
          apiKey: 'public',
        },
      ],
    };

    const { config: next, changedCount } = migrateVibemodeModels(config, { baseUrl: DEFAULT_BASE_URL });

    assert.equal(changedCount, 1);
    assert.equal(next.customModels[0].baseUrl, DEFAULT_BASE_URL);
    assert.equal(next.customModels[0].apiKey, 'keep-me');
    assert.equal(next.customModels[1].baseUrl, 'http://127.0.0.1:3000/v1');
  });

  it('detects VibeMode models by display name or legacy host', () => {
    assert.equal(isVibemodeModel({ displayName: 'glm [Vibemode]', baseUrl: 'https://example.test/v1' }), true);
    assert.equal(isVibemodeModel({ displayName: 'glm', baseUrl: 'https://api.neurogate.space/v1' }), true);
    assert.equal(isVibemodeModel({ displayName: 'glm [OpenCode Proxy]', baseUrl: 'http://127.0.0.1:3000/v1' }), false);
  });

  it('normalizes trailing slashes', () => {
    assert.equal(normalizeBaseUrl('https://r-api.vibemod.pro/v1/'), 'https://r-api.vibemod.pro/v1');
  });
});
