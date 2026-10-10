/**
 * step4-export-stream.test.ts
 * ─────────────────────────────────────────────────────────────
 * Verification test suite for STEP 4:
 * - TASK 4.1: CSV Export Stream Pagination (60,000 records without exceeding 100MB RAM)
 * - TASK 4.3: Razorpay Webhook Verification Probe
 */

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_test_key_123456';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';

import { Readable, Writable } from 'stream';
import {
  transformToExportFormat,
  ORDER_EXPORT_HEADERS,
  escapeCsvField,
  formatOrderExportRow,
} from '../src/services/export.service';

describe('STEP 4: Large-Scale Data Streaming & Webhook Probes', () => {
  describe('TASK 4.1: CSV Transformer & DDE Sanitization', () => {
    it('emits CSV header matching ORDER_EXPORT_HEADERS on first chunk', async () => {
      const transformer = transformToExportFormat();
      const chunks: string[] = [];

      const sink = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });

      transformer.pipe(sink);

      transformer.write({
        externalOrderId: 'TEST-101',
        customerName: 'Aarav Sharma',
        customerPhone: '+919876543210',
        orderValue: 1500,
        paymentMethod: 'cod',
        status: 'ndr',
      });
      transformer.end();

      await new Promise((resolve) => sink.on('finish', resolve));

      const output = chunks.join('');
      const expectedHeader = ORDER_EXPORT_HEADERS.map((h) => `"${h}"`).join(',');
      expect(output).toContain(expectedHeader);
      expect(output).toContain('"TEST-101"');
      expect(output).toContain('"Aarav Sharma"');
      expect(output).toContain('"1500"');
    });

    it('sanitizes CSV/DDE formula injection triggers (=, +, -, @)', () => {
      expect(escapeCsvField('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"');
      expect(escapeCsvField('+cmd|/c calc')).toBe('"\' +cmd|/c calc"'.replace(/\s+/, ''));
      expect(escapeCsvField('-12345')).toBe('"\'-12345"');
      expect(escapeCsvField('@danger')).toBe('"\'@danger"');
      expect(escapeCsvField('Safe text')).toBe('"Safe text"');
    });
  });

  describe('TASK 4.1: 60,000 Records Streaming Memory Test', () => {
    it('streams 60,000 orders through CSV pipeline under 100MB heap growth', async () => {
      const TOTAL_RECORDS = 60000;
      let recordIndex = 0;

      // Readable generator stream
      const orderSource = new Readable({
        objectMode: true,
        read() {
          const CHUNK_SIZE = 1000;
          let pushed = 0;
          while (recordIndex < TOTAL_RECORDS && pushed < CHUNK_SIZE) {
            const doc = {
              externalOrderId: `ORD-STREAM-${recordIndex}`,
              customerName: `Merchant Customer ${recordIndex}`,
              customerPhone: `+91987654${(10000 + (recordIndex % 90000)).toString()}`,
              orderValue: 999 + (recordIndex % 500),
              paymentMethod: recordIndex % 2 === 0 ? 'cod' : 'upi',
              status: recordIndex % 3 === 0 ? 'delivered' : 'ndr_rescue',
              carrier: 'delhivery',
              awb: `DLH${200000000 + recordIndex}`,
              platform: 'shopify',
              ndr: {
                reason: 'Customer requested reschedule',
                detectedAt: new Date(),
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            recordIndex++;
            pushed++;
            if (!this.push(doc)) {
              return; // respect downstream backpressure
            }
          }

          if (recordIndex >= TOTAL_RECORDS) {
            this.push(null); // End of stream
          }
        },
      });

      // Force GC if available or record baseline heap
      if (global.gc) {
        global.gc();
      }
      const initialHeap = process.memoryUsage().heapUsed;

      let totalBytesWritten = 0;
      let rowCount = 0;
      let maxHeapObserved = initialHeap;

      const transformer = transformToExportFormat();

      // Sink stream tracking backpressure, rows, and memory
      const memorySink = new Writable({
        write(chunk, _encoding, callback) {
          const str = chunk.toString();
          totalBytesWritten += chunk.length;
          // Count newlines
          for (let i = 0; i < str.length; i++) {
            if (str[i] === '\n') rowCount++;
          }

          // Sample heap usage during stream consumption
          const currentHeap = process.memoryUsage().heapUsed;
          if (currentHeap > maxHeapObserved) {
            maxHeapObserved = currentHeap;
          }

          callback();
        },
      });

      // Execute stream pipeline
      await new Promise<void>((resolve, reject) => {
        orderSource
          .pipe(transformer)
          .pipe(memorySink)
          .on('finish', () => resolve())
          .on('error', (err) => reject(err));
      });

      const heapDeltaBytes = maxHeapObserved - initialHeap;
      const heapDeltaMB = heapDeltaBytes / (1024 * 1024);

      console.log('--- 🚀 60,000 ORDER CSV STREAM EXECUTION LOGS ---');
      console.log(`• Records Streamed: ${TOTAL_RECORDS.toLocaleString()}`);
      console.log(`• Rows Emitted (Header + Data): ${rowCount.toLocaleString()}`);
      console.log(`• Total Output Payload: ${(totalBytesWritten / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`• Baseline Heap: ${(initialHeap / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`• Peak Stream Heap: ${(maxHeapObserved / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`• Peak Heap Delta: ${heapDeltaMB.toFixed(2)} MB (Max Allowed: 100.00 MB)`);
      console.log('--------------------------------------------------');

      // Assertions
      expect(recordIndex).toBe(TOTAL_RECORDS);
      // rowCount includes 1 header row + 60,000 data rows
      expect(rowCount).toBe(TOTAL_RECORDS + 1);
      expect(totalBytesWritten).toBeGreaterThan(5 * 1024 * 1024); // > 5MB CSV payload
      // Heap memory growth MUST NOT exceed 100MB (constant stream memory usage)
      expect(heapDeltaMB).toBeLessThan(100);
    });
  });

  describe('TASK 4.3: Razorpay Webhook Verification Probe', () => {
    let app: any;
    const redisStore = new Map<string, string>();

    beforeAll(async () => {
      const express = (await import('express')).default;
      const razorpayRouter = (await import('../src/webhooks/razorpay.webhook')).default;
      const { redisConnection } = await import('../src/config/redis');

      (redisConnection as any).get = jest.fn().mockImplementation(async (key: string) => redisStore.get(key) || null);
      (redisConnection as any).setex = jest.fn().mockImplementation(async (key: string, _ttl: number, val: string) => {
        redisStore.set(key, val);
        return 'OK';
      });
      (redisConnection as any).del = jest.fn().mockImplementation(async (key: string) => {
        redisStore.delete(key);
        return 1;
      });

      app = express();
      app.use(express.json());
      app.use('/webhooks/razorpay', razorpayRouter);
    });

    it('consumes verification_nonce from header and marks status verified', async () => {
      const request = (await import('supertest')).default;
      const merchantId = 'merchant_rz_123';
      const nonce = 'probe_test_nonce_abc';
      redisStore.set(`rz_verify_nonce:${nonce}`, merchantId);
      redisStore.set(`rz_verify:${merchantId}`, nonce);

      const res = await request(app)
        .post('/webhooks/razorpay/payment')
        .set('x-razorpay-verification-nonce', nonce)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('verified');
      expect(res.body.merchantId).toBe(merchantId);
      expect(redisStore.get(`rz_verify_status:${merchantId}`)).toBe('verified');
      expect(redisStore.has(`rz_verify_nonce:${nonce}`)).toBe(false);
    });

    it('consumes verification_nonce from body and marks status verified', async () => {
      const request = (await import('supertest')).default;
      const merchantId = 'merchant_rz_456';
      const nonce = 'probe_test_nonce_def';
      redisStore.set(`rz_verify_nonce:${nonce}`, merchantId);
      redisStore.set(`rz_verify:${merchantId}`, nonce);

      const res = await request(app)
        .post('/webhooks/razorpay/payment')
        .send({ verification_nonce: nonce });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('verified');
      expect(res.body.merchantId).toBe(merchantId);
      expect(redisStore.get(`rz_verify_status:${merchantId}`)).toBe('verified');
    });

    it('rejects unauthenticated non-probe webhook without signature with 401', async () => {
      const request = (await import('supertest')).default;
      const res = await request(app)
        .post('/webhooks/razorpay/payment')
        .send({ event: 'payment_link.paid' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Signature');
    });
  });
});
