import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../src/router.js';
import { loadConfig, DEFAULT_MODELS } from '../src/config.js';
import { createProxy } from '../src/proxy.js';

describe('Router', () => {
  let router;

  beforeEach(() => {
    router = new Router(['model-a', 'model-b', 'model-c'], 'round-robin');
  });

  it('should return models in round-robin order', () => {
    assert.equal(router.next(), 'model-a');
    assert.equal(router.next(), 'model-b');
    assert.equal(router.next(), 'model-c');
    assert.equal(router.next(), 'model-a');
    assert.equal(router.next(), 'model-b');
  });

  it('should return null for empty models list', () => {
    const empty = new Router([], 'round-robin');
    assert.equal(empty.next(), null);
  });

  it('should return random model when strategy is random', () => {
    const rng = new Router(['x', 'y', 'z'], 'random');
    const results = new Set();
    for (let i = 0; i < 100; i++) {
      results.add(rng.next());
    }
    assert.ok(results.has('x'));
    assert.ok(results.has('y'));
    assert.ok(results.has('z'));
  });

  it('should honor requested model if in pool', () => {
    assert.equal(router.getModelForRequest('model-b'), 'model-b');
  });

  it('should fall back to round-robin if requested model not in pool', () => {
    assert.equal(router.getModelForRequest('unknown'), 'model-a');
    assert.equal(router.getModelForRequest('unknown'), 'model-b');
  });

  it('should route "auto" requests through round-robin', () => {
    assert.equal(router.getModelForRequest('auto'), 'model-a');
    assert.equal(router.getModelForRequest('auto'), 'model-b');
  });

  it('should route undefined requests through round-robin', () => {
    assert.equal(router.getModelForRequest(), 'model-a');
    assert.equal(router.getModelForRequest(), 'model-b');
  });

  it('should reset index', () => {
    router.next();
    router.next();
    router.reset();
    assert.equal(router.next(), 'model-a');
  });
});

describe('Config', () => {
  it('should load default free models', () => {
    const config = loadConfig();
    assert.deepEqual(config.models, DEFAULT_MODELS);
    assert.equal(config.host, '127.0.0.1');
    assert.equal(config.port, 3000);
    assert.equal(config.routing, 'round-robin');
    assert.equal(config.apiKey, 'public');
    assert.equal(config.timeout, 30000);
  });

  it('should parse MODELS from env', () => {
    process.env.MODELS = 'a,b,c';
    const config = loadConfig();
    assert.deepEqual(config.models, ['a', 'b', 'c']);
    delete process.env.MODELS;
  });

  it('should filter empty model names', () => {
    process.env.MODELS = 'a,,,b,';
    const config = loadConfig();
    assert.deepEqual(config.models, ['a', 'b']);
    delete process.env.MODELS;
  });

  it('should fall back to defaults if MODELS is all empty', () => {
    process.env.MODELS = ', ,';
    const config = loadConfig();
    assert.deepEqual(config.models, DEFAULT_MODELS);
    delete process.env.MODELS;
  });

  it('should parse PORT from env', () => {
    process.env.PORT = '4000';
    const config = loadConfig();
    assert.equal(config.port, 4000);
    delete process.env.PORT;
  });

  it('should parse ROUTING from env', () => {
    process.env.ROUTING = 'random';
    const config = loadConfig();
    assert.equal(config.routing, 'random');
    delete process.env.ROUTING;
  });
});

describe('createProxy', () => {
  it('should return proxyRequest, config, and router', () => {
    const testConfig = {
      port: 9999,
      host: '127.0.0.1',
      apiKey: 'test-key',
      models: ['m1', 'm2'],
      upstream: 'https://test.com/v1',
      routing: 'round-robin',
      timeout: 5000,
    };
    const { proxyRequest, config, router } = createProxy(testConfig);
    assert.ok(typeof proxyRequest === 'function');
    assert.equal(config.port, 9999);
    assert.equal(config.apiKey, 'test-key');
    assert.deepEqual(config.models, ['m1', 'm2']);
    assert.equal(config.timeout, 5000);
    assert.ok(router);
  });

  it('should handle requests to /health', async () => {
    const { proxyRequest } = createProxy({
      apiKey: 'key',
      models: ['m1', 'm2'],
      upstream: 'https://test.com/v1',
    });

    const req = { method: 'GET', url: '/health', headers: new Map() };
    const res = { headers: {} };
    res.writeHead = (status, headers) => {
      res.statusCode = status;
      if (headers) Object.assign(res.headers, headers);
    };
    res.end = (data) => {
      res.body = JSON.parse(data);
    };

    await proxyRequest(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.models, ['m1', 'm2']);
  });

  it('should handle requests to /v1/models', async () => {
    const { proxyRequest } = createProxy({
      apiKey: 'key',
      models: ['m1', 'm2'],
      upstream: 'https://test.com/v1',
    });

    const req = { method: 'GET', url: '/v1/models', headers: new Map() };
    const res = { headers: {} };
    res.writeHead = (status, headers) => {
      res.statusCode = status;
      if (headers) Object.assign(res.headers, headers);
    };
    res.end = (data) => {
      res.body = JSON.parse(data);
    };

    await proxyRequest(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.length, 2);
  });

  it('should expose dashboard and metrics endpoints', async () => {
    const { proxyRequest } = createProxy({
      apiKey: 'key',
      models: ['m1'],
      upstream: 'https://test.com/v1',
      timeout: 5000,
    });

    const dashboard = makeResponse();
    await proxyRequest({ method: 'GET', url: '/dashboard' }, dashboard);
    assert.equal(dashboard.statusCode, 200);
    assert.match(dashboard.body, /OpenCode Proxy Dashboard/);

    const metrics = makeResponse(true);
    await proxyRequest({ method: 'GET', url: '/metrics?window=60000' }, metrics);
    assert.equal(metrics.statusCode, 200);
    assert.equal(metrics.body.summary.window.requests, 0);
    assert.equal(metrics.body.privacy.stores_prompts, false);
  });

  it('should record privacy-safe metrics for chat completions', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      model: 'actual-model',
      choices: [{ finish_reason: 'stop', message: { content: 'do not store me' } }],
      usage: {
        prompt_tokens: 11,
        completion_tokens: 7,
        total_tokens: 18,
      },
      cost: '0',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const { proxyRequest, metrics } = createProxy({
        apiKey: 'key',
        models: ['m1'],
        upstream: 'https://test.com/v1',
        timeout: 5000,
      });

      const req = makeJSONRequest('/v1/chat/completions', {
        model: 'm1',
        messages: [{ role: 'user', content: 'do not store me either' }],
      });
      const res = makeResponse();
      await proxyRequest(req, res);

      assert.equal(res.statusCode, 200);
      const snapshot = metrics.snapshot({ windowMs: 60_000 });
      assert.equal(snapshot.summary.window.requests, 1);
      assert.equal(snapshot.summary.window.total_tokens, 18);
      assert.equal(snapshot.summary.window.by_model[0].model, 'm1');
      assert.equal(snapshot.recent[0].returned_model, 'actual-model');
      assert.equal(JSON.stringify(snapshot).includes('do not store me'), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function makeResponse(parseJSON = false) {
  return {
    headers: {},
    writeHead(status, headers) {
      this.statusCode = status;
      if (headers) Object.assign(this.headers, headers);
    },
    end(data) {
      this.body = parseJSON ? JSON.parse(data) : data;
    },
  };
}

function makeJSONRequest(url, body) {
  return {
    method: 'POST',
    url,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body));
    },
  };
}
