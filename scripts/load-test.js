/**
 * load-test.js
 * ─────────────────────────────────────────────────────────────
 * k6 load testing script for RescueShip webhook ingestion.
 * Simulates 1000 concurrent Shopify order webhooks.
 *
 * Usage:
 *   k6 run scripts/load-test.js
 *   k6 run --vus 1000 --duration 60s scripts/load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics
const webhookSuccessRate = new Rate('webhook_success');
const webhookDuration = new Trend('webhook_duration', true);

export const options = {
  stages: [
    { duration: '10s', target: 100 },   // Ramp up to 100 VUs
    { duration: '30s', target: 500 },   // Ramp up to 500 VUs
    { duration: '30s', target: 1000 },  // Peak: 1000 concurrent
    { duration: '10s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],     // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],       // < 1% failure rate
    webhook_success: ['rate>0.99'],       // > 99% webhook success
  },
};

function generateShopifyPayload(orderId) {
  return JSON.stringify({
    id: orderId,
    order_number: orderId,
    email: `loadtest${orderId}@example.com`,
    phone: `+91${9000000000 + (orderId % 999999999)}`,
    total_price: (Math.random() * 5000 + 500).toFixed(2),
    financial_status: 'pending',
    fulfillment_status: null,
    customer: {
      first_name: 'Load',
      last_name: `Test${orderId}`,
      phone: `+91${9000000000 + (orderId % 999999999)}`,
    },
    shipping_address: {
      address1: `${orderId} Test Street`,
      city: 'Mumbai',
      province: 'Maharashtra',
      zip: `4000${(orderId % 99).toString().padStart(2, '0')}`,
      country: 'India',
    },
    line_items: [
      {
        title: 'Test Product',
        quantity: 1,
        price: (Math.random() * 5000 + 500).toFixed(2),
      },
    ],
    created_at: new Date().toISOString(),
  });
}

export default function () {
  const orderId = Math.floor(Math.random() * 999999999);
  const payload = generateShopifyPayload(orderId);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Topic': 'orders/create',
      'X-Shopify-Hmac-Sha256': 'test_hmac_signature',
      'X-Shopify-Shop-Domain': 'loadtest-store.myshopify.com',
    },
  };

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/webhooks/shopify`, payload, params);
  const duration = Date.now() - startTime;

  webhookDuration.add(duration);

  const success = check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response time < 500ms': () => duration < 500,
    'no server error': (r) => r.status < 500,
  });

  webhookSuccessRate.add(success);

  sleep(0.1); // 100ms think time between requests
}
