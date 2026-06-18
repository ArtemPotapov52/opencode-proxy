import http from 'node:http';
import { createProxy } from './proxy.js';
import { loadConfig } from './config.js';

const config = loadConfig();

if (!config.apiKey) {
  console.error('Error: OPENCODE_ZEN_API_KEY environment variable is required');
  process.exit(1);
}

const { proxyRequest } = createProxy(config);
const server = http.createServer(proxyRequest);

server.listen(config.port, () => {
  console.log(`OpenCode Proxy running on http://localhost:${config.port}`);
  console.log(`Models: ${config.models.join(', ')}`);
  console.log(`Routing: ${config.routing}`);
  console.log(`Upstream: ${config.upstream}`);
});
