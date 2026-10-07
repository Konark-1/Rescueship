/**
 * connect.ts
 * ─────────────────────────────────────────────────────────────
 * Centralized connector API client using standardized Axios instance.
 * Automatically inherits 401 token handling and 502/503/504 retry backoffs.
 */

import api from '../services/api';

const call = async (token: string, path: string, body?: any) => {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  try {
    if (body !== undefined) {
      const res = await api.post(`/api/connect${path}`, body, config);
      return res.data;
    }
    const res = await api.get(`/api/connect${path}`, config);
    return res.data;
  } catch (err: any) {
    const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Request failed';
    throw new Error(message);
  }
};

export const connectApi = {
  state: (t: string) => call(t, '/state'),
  shopifyUrl: (t: string, shop: string) => call(t, `/shopify/url?shop=${encodeURIComponent(shop)}`),
  shopifyDemoConnect: (t: string, shop: string) => call(t, '/shopify/demo-connect', { shop }),
  shopifyToken: (t: string, shop: string, accessToken: string, apiSecret: string) => call(t, '/shopify/token', { shop, accessToken, apiSecret }),
  woocommerce: (t: string, url: string, consumerKey: string, consumerSecret: string) => call(t, '/woocommerce', { url, consumerKey, consumerSecret }),
  whatsappSignup: (t: string, code: string, businessId?: string) => call(t, '/whatsapp/signup', { code, businessId }),
  whatsappManual: (t: string, phoneNumberId: string, wabaId: string, accessToken: string) => call(t, '/whatsapp/manual', { phoneNumberId, wabaId, accessToken }),
  whatsappTemplates: (t: string) => call(t, '/whatsapp/templates/status'),
  resubmitWhatsAppTemplates: (t: string) => call(t, '/whatsapp/templates/resubmit', {}),
  testPulse: (t: string) => call(t, '/whatsapp/test-pulse', {}),
  carrier: (t: string, creds: any) => call(t, '/carrier', creds),
  carrierDisconnect: (t: string, provider?: string) => call(t, '/carrier/disconnect', { provider }),
  carrierWebhooks: (t: string) => call(t, '/carrier/webhook'),
  payment: (t: string, gateway: string, keyId: string, keySecret: string) => call(t, '/payment', { gateway, keyId, keySecret }),
  ownerPhone: (t: string, ownerPhone: string, storeName?: string) => call(t, '/owner-phone', { ownerPhone, storeName }),
  finalize: (t: string) => call(t, '/finalize', {}),
  requestAssistedSetup: (t: string) => call(t, '/assisted-setup/request', {}),
  skip: (t: string) => call(t, '/skip', {}),
  shopifyMetrics: (t: string) => call(t, '/shopify/metrics'),
  storeMetrics: (t: string) => call(t, '/store/metrics'),
};
