import http from 'node:http';
import { createProxy } from './proxy.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { proxyRequest, metrics } = createProxy(config);
const server = http.createServer(proxyRequest);

server.listen(config.port, config.host, () => {
  console.log(`OpenCode Proxy running on http://${config.host}:${config.port}`);
  console.log(`Models: ${config.models.join(', ')}`);
  console.log(`Routing: ${config.routing}`);
  console.log(`Upstream: ${config.upstream}`);
  for (const warning of config.warnings || []) {
    console.warn(`[warn] ${warning}`);
  }
});

server.on('error', (error) => {
  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'error',
    event: 'server_error',
    message: error?.message || String(error),
  }));
  process.exitCode = 1;
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    event: 'shutdown_start',
    signal,
  }));

  const timeout = setTimeout(() => {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      event: 'shutdown_timeout',
      timeout_ms: config.shutdownTimeoutMs,
    }));
    process.exit(1);
  }, config.shutdownTimeoutMs);

  server.close(async (error) => {
    if (error) {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        event: 'shutdown_close_error',
        message: error.message,
      }));
      process.exitCode = 1;
    }

    await metrics.flush();
    clearTimeout(timeout);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      event: 'shutdown_complete',
    }));
    process.exit();
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
