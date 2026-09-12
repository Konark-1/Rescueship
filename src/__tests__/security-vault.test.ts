process.env.ENCRYPTION_KEY = 'this_is_a_very_secret_encryption_key_32';

import fs from 'fs';
import path from 'path';
import { encryptionService } from '../services/encryption.service';

describe('Security Vault & Credentials Discipline', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const srcDir = path.join(rootDir, 'src');
  const frontendSrcDir = path.join(rootDir, 'frontend', 'src');

  const SECRET_PATTERNS = [
    { name: 'Shopify Secret Key Literal', regex: /shpss_[a-f0-9]{20,}/i },
    { name: 'Shopify Access Token Literal', regex: /shpat_[a-f0-9]{20,}/i },
    { name: 'Private Key Block', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { name: 'Live Razorpay Secret Literal', regex: /rzp_live_[a-zA-Z0-9]{14,}/ },
    { name: 'Live Stripe Secret Literal', regex: /sk_live_[a-zA-Z0-9]{20,}/ },
    { name: 'AWS Access Key Literal', regex: /AKIA[0-9A-Z]{16}/ },
  ];

  const IGNORED_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg',
    '.woff', '.woff2', '.ttf', '.eot', '.webm', '.mp4',
  ]);

  function scanDir(dir: string, violations: string[]) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'dist-ssr' && entry.name !== '.git') {
          scanDir(fullPath, violations);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IGNORED_EXTS.has(ext) || entry.name.startsWith('.env') || entry.name === 'security-vault.test.ts') continue;

        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const lines = fileContent.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('starts with') || line.includes('placeholder=') || line.includes('shpss_…') || line.includes('shpat_…')) {
            continue;
          }
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.regex.test(line)) {
              violations.push(`[${pattern.name}] in ${path.relative(rootDir, fullPath)}:${i + 1}`);
            }
          }
        }
      }
    }
  }

  it('ensures zero hardcoded secret keys or tokens exist in source code', () => {
    const violations: string[] = [];
    scanDir(srcDir, violations);
    scanDir(frontendSrcDir, violations);
    expect(violations).toEqual([]);
  });

  it('ensures .gitignore strictly excludes .env and credential notes', () => {
    const gitignorePath = path.join(rootDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    expect(gitignoreContent).toMatch(/^\.env/m);
    expect(gitignoreContent).toMatch(/CREDENTIALS\.md/i);
  });

  it('verifies AES-256-GCM encryption service properly secures values', () => {
    const secret = 'super_secret_merchant_token_12345';
    const encrypted = encryptionService.encrypt(secret);
    expect(encrypted).not.toEqual(secret);
    expect(encrypted).toMatch(/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+/);
    const decrypted = encryptionService.decrypt(encrypted);
    expect(decrypted).toEqual(secret);
  });
});
