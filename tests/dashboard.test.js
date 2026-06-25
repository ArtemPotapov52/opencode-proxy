import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard } from '../src/dashboard.js';

describe('dashboard', () => {
  it('uses persisted daily usage for the main token card', () => {
    const html = renderDashboard();

    assert.match(html, /Токены сегодня/);
    assert.match(html, /todayUsage/);
    assert.match(html, /tokenRateText/);
  });

  it('renders a syntactically valid embedded script', () => {
    const html = renderDashboard();
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

    assert.ok(script);
    new Function(script);
  });

  it('pins the external Chart.js script with SRI', () => {
    const html = renderDashboard();

    assert.match(html, /chart\.js@4\.4\.7/);
    assert.match(html, /integrity="sha384-/);
    assert.match(html, /crossorigin="anonymous"/);
  });

  it('updates status text without assigning innerHTML', () => {
    const html = renderDashboard();
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || '';

    assert.match(script, /pill\.replaceChildren/);
    assert.doesNotMatch(script, /pill\.innerHTML =/);
  });
});
