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
    assert.equal(config.port, 3000);
    assert.equal(config.routing, 'round-robin');
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
      apiKey: 'test-key',
      models: ['m1', 'm2'],
      upstream: 'https://test.com/v1',
      routing: 'round-robin',
    };
    const { proxyRequest, config, router } = createProxy(testConfig);
    assert.ok(typeof proxyRequest === 'function');
    assert.equal(config.port, 9999);
    assert.equal(config.apiKey, 'test-key');
    assert.deepEqual(config.models, ['m1', 'm2']);
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
});
