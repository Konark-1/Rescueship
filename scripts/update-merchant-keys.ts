#!/usr/bin/env ts-node
/**
 * scripts/update-merchant-keys.ts
 * Thin wrapper to execute src/scripts/updateMerchantKeys.ts from repo root.
 *
 * Usage:
 *   MERCHANT_ID=<id> RZP_TEST_KEY_ID=rzp_test_... RZP_TEST_KEY_SECRET=... npx ts-node scripts/update-merchant-keys.ts
 */
require('../src/scripts/updateMerchantKeys');
