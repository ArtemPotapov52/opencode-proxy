import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyProxyConfig, parseJsonc } from '../scripts/setup-opencode.mjs';

describe('setup-opencode', () => {
  it('parses JSONC with comments and trailing commas', () => {
    const parsed = parseJsonc(`{
      // existing OpenCode config
      "$schema": "https://opencode.ai/config.json",
      "provider": {
        "opencode": {
          "options": {
            "apiKey": "keep-me",
          },
        },
      },
    }`, 'inline.jsonc');

    assert.equal(parsed.provider.opencode.options.apiKey, 'keep-me');
  });

  it('adds a dedicated zenproxy provider without removing existing providers', () => {
    const config = {
      provider: {
        opencode: {
          options: {
            apiKey: 'keep-me',
          },
        },
      },
      model: 'opencode/deepseek-v4-flash-free',
    };

    const next = applyProxyConfig(config, {
      providerId: 'zenproxy',
      baseURL: 'http://127.0.0.1:3000/v1',
      apiKey: 'public',
      model: 'deepseek-v4-flash-free',
      smallModel: 'mimo-v2.5-free',
    });

    assert.equal(next.provider.opencode.options.apiKey, 'keep-me');
    assert.equal(next.provider.zenproxy.npm, '@ai-sdk/openai-compatible');
    assert.equal(next.provider.zenproxy.options.baseURL, 'http://127.0.0.1:3000/v1');
    assert.equal(next.model, 'zenproxy/deepseek-v4-flash-free');
    assert.equal(next.small_model, 'zenproxy/mimo-v2.5-free');
  });
});
