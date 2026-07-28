/**
 * startup-validator.ts
 * Validates all critical env vars at startup. Crashes if missing.
 */

import { logger } from '../utils/logger';

interface EnvRequirement {
  key: string;
  required: boolean;
  description: string;
}

const REQUIRED_VARS: EnvRequirement[] = [
  { key: 'PORT', required: true, description: 'Server port (default: 3000)' },
  { key: 'NODE_ENV', required: true, description: 'Environment: development | production' },
  { key: 'MONGODB_URI', required: true, description: 'MongoDB connection string' },
  { key: 'REDIS_HOST', required: true, description: 'Redis host' },
  { key: 'REDIS_PORT', required: true, description: 'Redis port' },
  { key: 'JWT_SECRET', required: true, description: 'JWT signing secret (min 32 chars)' },
  { key: 'ENCRYPTION_KEY', required: true, description: 'AES-256 encryption key (min 32 chars)' },
  { key: 'FRONTEND_URL', required: true, description: 'Frontend origin for CORS' },
];

const OPTIONAL_VARS: EnvRequirement[] = [
  { key: 'RAZORPAY_KEY_ID', required: false, description: 'Razorpay Key ID' },
  { key: 'RAZORPAY_KEY_SECRET', required: false, description: 'Razorpay Key Secret' },
  { key: 'CASHFREE_CLIENT_ID', required: false, description: 'Cashfree Client ID' },
  { key: 'CASHFREE_CLIENT_SECRET', required: false, description: 'Cashfree Client Secret' },
  { key: 'WHATSAPP_APP_SECRET', required: false, description: 'Meta WhatsApp App Secret' },
  { key: 'WHATSAPP_VERIFY_TOKEN', required: false, description: 'Meta WhatsApp Verify Token' },
  { key: 'SMTP_HOST', required: false, description: 'Email SMTP host' },
  { key: 'SMTP_PORT', required: false, description: 'Email SMTP port' },
  { key: 'SMTP_USER', required: false, description: 'Email SMTP user' },
  { key: 'SMTP_PASS', required: false, description: 'Email SMTP password' },
  { key: 'META_APP_ID', required: false, description: 'Meta app id (Embedded Signup)' },
  { key: 'META_APP_SECRET', required: false, description: 'Meta app secret' },
  { key: 'META_CONFIG_ID', required: false, description: 'Meta Embedded Signup config_id' },
  { key: 'META_REDIRECT_URI', required: false, description: 'Must equal the page that loads the FB SDK (e.g. FRONTEND_URL/onboarding)' },
  { key: 'SHOPIFY_API_KEY', required: false, description: 'Shopify app API key' },
  { key: 'SHOPIFY_API_SECRET', required: false, description: 'Shopify app secret' },
  { key: 'SHOPIFY_SCOPES', required: false, description: 'OAuth scopes (default read/write orders+fulfillments)' },
  { key: 'API_PUBLIC_URL', required: false, description: 'Public backend URL Shopify/Meta callbacks hit (e.g. https://api.rescueship.io)' },
];

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const env of REQUIRED_VARS) {
    const value = process.env[env.key];
    if (!value || value.trim() === '') {
      errors.push(`  ❌ ${env.key} — ${env.description}`);
    }
  }

  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push('  ❌ JWT_SECRET must be at least 32 characters long');
  }

  const encKey = process.env.ENCRYPTION_KEY || '';
  if (encKey && encKey.length < 32) {
    errors.push('  ❌ ENCRYPTION_KEY must be at least 32 characters long');
  }

  for (const env of OPTIONAL_VARS) {
    const value = process.env[env.key];
    if (!value || value.trim() === '') {
      warnings.push(`  ⚠️  ${env.key} — ${env.description} (feature disabled)`);
    }
  }

  if (warnings.length > 0) {
    logger.warn('Optional environment variables not set:');
    warnings.forEach((w) => console.log(w));
  }

  if (errors.length > 0) {
    console.error('\n🚨 FATAL: Missing required environment variables:\n');
    errors.forEach((e) => console.error(e));
    console.error('\nPlease set these in your .env file and restart.\n');
    process.exit(1);
  }

  logger.info('✅ Environment validation passed', {
    requiredVars: REQUIRED_VARS.length,
    optionalVarsSet: OPTIONAL_VARS.filter((v) => process.env[v.key]).length,
    optionalVarsTotal: OPTIONAL_VARS.length,
  });
}
