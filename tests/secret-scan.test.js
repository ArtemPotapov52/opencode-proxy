import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSensitivePath, scanFiles, scanText } from '../scripts/secret-scan.mjs';

describe('secret-scan', () => {
  it('allows examples but flags real-looking secret assignments', () => {
    assert.deepEqual(scanText('OPENCODE_ZEN_API_KEY=your_key', 'README.md'), []);

    const findings = scanText(`OPENCODE_ZEN_API_KEY=${'super-secret-value-123'}`, '.env');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].rule, 'generic secret assignment');
  });

  it('flags sensitive paths and ignores .env.example', () => {
    assert.equal(isSensitivePath('.env'), true);
    assert.equal(isSensitivePath('.env.example'), false);
    assert.equal(isSensitivePath('.factory/settings.json'), true);
  });

  it('reports sensitive candidate files before reading content', () => {
    const findings = scanFiles(process.cwd(), ['.env.example', '.factory/settings.json']);
    assert.deepEqual(findings, [
      { file: '.factory/settings.json', line: 0, rule: 'sensitive path' },
    ]);
  });
});
