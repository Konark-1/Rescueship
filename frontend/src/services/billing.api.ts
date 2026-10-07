/**
 * 🚢 RescueShip — Billing API Service
 * Centralized, interceptor-hardened billing client communicating via `src/services/api.ts`.
 * Eliminates un-intercepted raw fetch() calls and ensures automatic 401 redirection and retry backoff.
 */
import api from './api';
import type { Tier, Cycle } from '../config/pricing.config';

export const billingApi = {
  /** Returns { orderId, subscriptionId, amountInr, currency, keyId } to open Razorpay. */
  checkout: async (_token?: string, tier?: Tier, cycle?: Cycle) => {
    const res = await api.post('/api/billing/checkout', { tier, cycle });
    return res.data;
  },

  /** After Razorpay success — server verifies signature + provisions plan. */
  verify: async (_token?: string, payload?: any) => {
    const res = await api.post('/api/billing/checkout/verify', payload);
    return res.data;
  },

  status: async (_token?: string) => {
    const res = await api.get('/api/billing/status');
    return res.data;
  },

  /** Payment history — issued invoices (intro, renewals, credit top-ups). */
  invoices: async (_token?: string) => {
    const res = await api.get('/api/billing/invoices');
    return res.data;
  },

  /** Schedule cancel-at-cycle-end — access continues until the period ends. */
  cancel: async (_token?: string) => {
    const res = await api.post('/api/billing/cancel', {});
    return res.data;
  },

  /** Un-pause / clear a scheduled cancellation. */
  resume: async (_token?: string) => {
    const res = await api.post('/api/billing/resume', {});
    return res.data;
  },

  /** One-time Razorpay order for a rescue-credit pack. */
  creditCheckout: async (_token?: string, pack?: string) => {
    const res = await api.post('/api/billing/credits/checkout', { pack });
    return res.data;
  },

  /** Verify a credit-pack payment — server credits the account. */
  creditVerify: async (_token?: string, payload?: any) => {
    const res = await api.post('/api/billing/credits/verify', payload);
    return res.data;
  },
};

export const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
