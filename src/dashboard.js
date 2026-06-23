function renderDashboard() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenCode Proxy Dashboard</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, Segoe UI, system-ui, -apple-system, sans-serif;
      background: #f6f7f9;
      color: #16202a;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f6f7f9; color: #16202a; }
    main { max-width: 1180px; margin: 0 auto; padding: 24px; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
    h1 { font-size: 24px; margin: 0 0 6px; font-weight: 700; letter-spacing: 0; }
    p { margin: 0; color: #667085; }
    .status { padding: 8px 10px; border: 1px solid #cdd5df; border-radius: 8px; color: #344054; background: #eef6f4; white-space: nowrap; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .card { border: 1px solid #d7dde5; border-radius: 8px; background: #ffffff; padding: 14px; min-width: 0; }
    .label { color: #667085; font-size: 12px; margin-bottom: 8px; }
    .value { font-size: 28px; line-height: 1.1; font-weight: 750; }
    .sub { color: #667085; font-size: 12px; margin-top: 8px; }
    section { margin-top: 16px; }
    h2 { font-size: 16px; margin: 0 0 10px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #d7dde5; border-radius: 8px; overflow: hidden; background: #ffffff; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #eef2f6; text-align: left; font-size: 13px; }
    th { color: #667085; font-weight: 650; background: #f1f4f8; }
    tr:last-child td { border-bottom: none; }
    .ok { color: #0f8b6f; }
    .fail { color: #c2410c; }
    .muted { color: #667085; }
    .right { text-align: right; }
    .privacy { margin-top: 16px; border: 1px solid #d7dde5; border-radius: 8px; padding: 12px; color: #344054; background: #ffffff; }
    @media (max-width: 860px) {
      main { padding: 16px; }
      header { flex-direction: column; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      table { display: block; overflow-x: auto; }
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
      .value { font-size: 24px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>OpenCode Proxy Dashboard</h1>
        <p>Local, in-memory usage analytics for the Zen proxy.</p>
      </div>
      <div class="status" id="status">Loading...</div>
    </header>

    <div class="grid">
      <div class="card"><div class="label">Requests, 5 min</div><div class="value" id="requests">0</div><div class="sub" id="rpm">0 rpm</div></div>
      <div class="card"><div class="label">Tokens / min</div><div class="value" id="tpm">0</div><div class="sub" id="tokens">0 tokens</div></div>
      <div class="card"><div class="label">Avg latency</div><div class="value" id="latency">0ms</div><div class="sub" id="maxLatency">max 0ms</div></div>
      <div class="card"><div class="label">Errors, 5 min</div><div class="value" id="errors">0</div><div class="sub" id="success">0 ok</div></div>
    </div>

    <section>
      <h2>By Model</h2>
      <table>
        <thead><tr><th>Model</th><th class="right">Req</th><th class="right">OK</th><th class="right">Fail</th><th class="right">Tokens</th><th class="right">Avg ms</th><th class="right">Cost</th></tr></thead>
        <tbody id="models"><tr><td colspan="7" class="muted">No requests yet.</td></tr></tbody>
      </table>
    </section>

    <section>
      <h2>Recent Requests</h2>
      <table>
        <thead><tr><th>Time</th><th>Model</th><th>Status</th><th class="right">Latency</th><th class="right">Tokens</th><th>Finish/Error</th></tr></thead>
        <tbody id="recent"><tr><td colspan="6" class="muted">No requests yet.</td></tr></tbody>
      </table>
    </section>

    <div class="privacy" id="privacy"></div>
  </main>

  <script>
    const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    const money = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
    const $ = (id) => document.getElementById(id);
    function setText(id, text) { $(id).textContent = text; }
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }
    function renderRows(rows, empty, mapper) {
      if (!rows.length) return empty;
      return rows.map(mapper).join('');
    }
    async function refresh() {
      try {
        const res = await fetch('/metrics?window=300000', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const s = data.summary.window;
        setText('status', 'Updated ' + new Date(data.generated_at).toLocaleTimeString() + ' · uptime ' + data.uptime_seconds + 's');
        setText('requests', fmt.format(s.requests));
        setText('rpm', fmt.format(s.requests_per_minute) + ' rpm');
        setText('tpm', fmt.format(s.tokens_per_minute));
        setText('tokens', fmt.format(s.total_tokens) + ' tokens');
        setText('latency', fmt.format(s.latency_ms_avg) + 'ms');
        setText('maxLatency', 'max ' + fmt.format(s.latency_ms_max) + 'ms');
        setText('errors', fmt.format(s.fail));
        setText('success', fmt.format(s.ok) + ' ok');
        $('models').innerHTML = renderRows(s.by_model, '<tr><td colspan="7" class="muted">No requests yet.</td></tr>', (m) =>
          '<tr><td>' + escapeHtml(m.model) + '</td><td class="right">' + fmt.format(m.requests) + '</td><td class="right ok">' + fmt.format(m.ok) + '</td><td class="right fail">' + fmt.format(m.fail) + '</td><td class="right">' + fmt.format(m.total_tokens) + '</td><td class="right">' + fmt.format(m.latency_ms_avg) + '</td><td class="right">' + money.format(m.cost || 0) + '</td></tr>'
        );
        $('recent').innerHTML = renderRows(data.recent, '<tr><td colspan="6" class="muted">No requests yet.</td></tr>', (e) => {
          const statusClass = e.ok ? 'ok' : 'fail';
          const detail = e.ok ? e.finish_reason : e.error_type;
          return '<tr><td>' + new Date(e.ts).toLocaleTimeString() + '</td><td>' + escapeHtml(e.model) + '</td><td class="' + statusClass + '">' + e.status + '</td><td class="right">' + fmt.format(e.latency_ms) + 'ms</td><td class="right">' + fmt.format(e.total_tokens) + '</td><td>' + escapeHtml(detail || '') + '</td></tr>';
        });
        $('privacy').textContent = data.privacy.note;
      } catch (error) {
        setText('status', 'Dashboard error: ' + error.message);
      }
    }
    refresh();
    setInterval(refresh, 3000);
  </script>
</body>
</html>`;
}

export { renderDashboard };
