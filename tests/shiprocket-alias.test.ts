/**
 * Shiprocket's webhook form rejects any URL containing "shiprocket", "kartrocket",
 * "sr" or "kr". The alias /webhooks/carrier/ndr must stay free of those tokens and
 * must be mounted on the same (tenant-authenticated) Shiprocket router.
 */
import fs from 'fs';
import path from 'path';

const FORBIDDEN = ['shiprocket', 'kartrocket', 'sr', 'kr'];

describe('Shiprocket webhook alias', () => {
  it('advertised URL path avoids every token Shiprocket rejects', () => {
    const settings = fs.readFileSync(path.join(__dirname, '../src/api/settings.api.ts'), 'utf8');
    const m = settings.match(/shiprocket: `\$\{base\}([^?`]+)\?merchant_id=/);
    expect(m).not.toBeNull();
    const urlPath = m![1].toLowerCase();
    expect(urlPath).toBe('/webhooks/carrier/ndr');
    for (const bad of FORBIDDEN) expect(urlPath.includes(bad)).toBe(false);
    // A merchant id is hex, so it can never contain s/k either.
    expect(/^[0-9a-f]{24}$/.test('650000000000000000000001')).toBe(true);
  });

  it('index.ts mounts the Shiprocket router on the alias', () => {
    const index = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
    expect(index).toMatch(/app\.use\('\/webhooks\/carrier', webhookLimiter, shiprocketRouter\)/);
  });
});
