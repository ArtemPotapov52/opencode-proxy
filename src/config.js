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
    port: parseInt(process.env.PORT || '3000', 10),
    apiKey: process.env.OPENCODE_ZEN_API_KEY,
    models: models.length > 0 ? models : DEFAULT_MODELS,
    upstream: process.env.UPSTREAM_URL || 'https://opencode.ai/zen/v1',
    routing: process.env.ROUTING || 'round-robin',
  };
}

export { loadConfig, DEFAULT_MODELS };
