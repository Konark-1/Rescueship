import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { Merchant, AuditLog } from '../src/models';
import { generateToken } from '../src/middleware/auth';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function runPhase5Verification() {
  console.log('\n🔒 ==========================================');
  console.log('🔒 RESCUESHIP PHASE 5 IDENTITY & OPS VERIFICATION');
  console.log('🔒 ==========================================\n');

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rescueship');

  let passed = 0;
  let failed = 0;

  try {
    // 1. Setup Test Merchant
    const testEmail = `phase5_test_${Date.now()}@example.com`;
    const merchant = await Merchant.create({
      name: 'Phase 5 Tester',
      email: testEmail,
      password: 'InitialPassword123!',
      platform: 'custom',
      tokenVersion: 1,
    });

    const initialToken = generateToken(merchant._id.toString(), 1);

    // Test 1: Verify Initial Token Access
    const res1 = await axios.get(`${BASE_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${initialToken}` },
    });
    if (res1.status === 200) {
      console.log('✅ [PASS] 1. Initial Token Authentication: HTTP 200 OK');
      passed++;
    } else {
      console.error('❌ [FAIL] 1. Initial Token Authentication failed');
      failed++;
    }

    // Test 2: Logout and Instant Token Revocation
    const logoutRes = await axios.post(
      `${BASE_URL}/api/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${initialToken}` } }
    );
    if (logoutRes.status === 200) {
      console.log('✅ [PASS] 2. Logout Endpoint: Token version incremented');
      passed++;
    } else {
      console.error('❌ [FAIL] 2. Logout Endpoint failed');
      failed++;
    }

    // Test 3: Verify Old Token is Immediately Rejected (HTTP 401)
    try {
      await axios.get(`${BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${initialToken}` },
      });
      console.error('❌ [FAIL] 3. Revoked Token Access: Should have been rejected!');
      failed++;
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        console.log('✅ [PASS] 3. Revoked Token Access Blocked: Expected 401 Unauthorized, got HTTP 401');
        passed++;
      } else {
        console.error(`❌ [FAIL] 3. Expected 401, got ${err.response?.status}`);
        failed++;
      }
    }

    // Test 4: Change Password & New Token Issuance
    const freshMerchant = await Merchant.findById(merchant._id);
    const validToken = generateToken(merchant._id.toString(), freshMerchant!.tokenVersion ?? 2);

    const changePassRes = await axios.post(
      `${BASE_URL}/api/auth/change-password`,
      {
        currentPassword: 'InitialPassword123!',
        newPassword: 'NewSuperPassword456!',
      },
      { headers: { Authorization: `Bearer ${validToken}` } }
    );

    if (changePassRes.status === 200 && changePassRes.data.token) {
      console.log('✅ [PASS] 4. Change Password: Password updated and new session token issued');
      passed++;
    } else {
      console.error('❌ [FAIL] 4. Change Password failed');
      failed++;
    }

    // Test 5: Verify AuditLog Immutability (Delete / Update Prohibited)
    const logDoc = await AuditLog.create({
      merchantId: merchant._id,
      action: 'phase5_immutability_test',
      source: 'test_runner',
      payload: { test: true },
      status: 'success',
    });

    let deleteBlocked = false;
    try {
      await AuditLog.deleteOne({ _id: logDoc._id });
    } catch (err: any) {
      if (err.message.includes('immutable and cannot be deleted')) {
        deleteBlocked = true;
      }
    }

    let updateBlocked = false;
    try {
      await AuditLog.updateOne({ _id: logDoc._id }, { status: 'failed' });
    } catch (err: any) {
      if (err.message.includes('immutable and cannot be updated')) {
        updateBlocked = true;
      }
    }

    if (deleteBlocked && updateBlocked) {
      console.log('✅ [PASS] 5. AuditLog Immutability: Delete and Update operations strictly rejected');
      passed++;
    } else {
      console.error('❌ [FAIL] 5. AuditLog Immutability failed: deleteBlocked=' + deleteBlocked + ' updateBlocked=' + updateBlocked);
      failed++;
    }

    // Cleanup merchant
    await Merchant.deleteOne({ _id: merchant._id });

  } catch (err: any) {
    console.error('Unexpected error during Phase 5 verification:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n🔒 ==========================================');
  console.log(`🔒 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('🔒 ==========================================\n');

  if (failed > 0) process.exit(1);
}

runPhase5Verification();
