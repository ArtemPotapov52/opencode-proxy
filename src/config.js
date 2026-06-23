const DEFAULT_MODELS = [
  'big-pickle',
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'north-mini-code-free',
  'nemotron-3-ultra-free',
];

function loadConfig() {
  const models = process.env.MODELS
    ? process.env.MODELS.split(',').map(m => m.trim()).filter(Boolean)
    : DEFAULT_MODELS;

  return {
    host: process.env.HOST || '127.0.0.1',
    port: parseInt(process.env.PORT || '3000', 10),
    apiKey: process.env.OPENCODE_ZEN_API_KEY || 'public',
    models: models.length > 0 ? models : DEFAULT_MODELS,
    upstream: process.env.UPSTREAM_URL || 'https://opencode.ai/zen/v1',
    routing: process.env.ROUTING || 'round-robin',
    timeout: parseInt(process.env.UPSTREAM_TIMEOUT || '30000', 10),
    metricsMaxEvents: parseInt(process.env.METRICS_MAX_EVENTS || '2000', 10),
  };
}

export { loadConfig, DEFAULT_MODELS };
