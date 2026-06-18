import { loadConfig } from './config.js';
import { Router } from './router.js';

function createProxy(customConfig) {
  const config = customConfig || loadConfig();
  const router = new Router(config.models, config.routing);

  async function proxyRequest(req, res) {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', models: config.models }));
      return;
    }

    if (req.method === 'GET' && req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        object: 'list',
        data: config.models.map(m => ({
          id: m,
          object: 'model',
          created: Date.now(),
          owned_by: 'opencode-zen',
        })),
      }));
      return;
    }

    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const selectedModel = router.getModelForRequest(parsed.model);
    parsed.model = selectedModel;

    try {
      const upstreamUrl = `${config.upstream}/chat/completions`;
      const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(parsed),
      });

      res.writeHead(response.status, {
        'Content-Type': 'application/json',
        'X-Model-Used': selectedModel,
      });
      res.end(JSON.stringify(await response.json()));
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Upstream request failed', message: error.message }));
    }
  }

  return { proxyRequest, config, router };
}

export { createProxy };
