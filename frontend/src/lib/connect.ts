const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const h = (token: string, body?: any) => ({
  method: body ? 'POST' : 'GET',
  headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});
const call = async (token: string, path: string, body?: any) => {
  const r = await fetch(`${API}/api/connect${path}`, h(token, body));
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
};

export const connectApi = {
  state: (t: string) => call(t, '/state'),
  shopifyUrl: (t: string, shop: string) => call(t, `/shopify/url?shop=${encodeURIComponent(shop)}`),
  whatsappSignup: (t: string, code: string, businessId?: string) => call(t, '/whatsapp/signup', { code, businessId }),
  whatsappTemplates: (t: string) => call(t, '/whatsapp/templates/status'),
  testPulse: (t: string) => call(t, '/whatsapp/test-pulse', {}),
  carrier: (t: string, creds: any) => call(t, '/carrier', creds),
  payment: (t: string, gateway: string, keyId: string, keySecret: string) => call(t, '/payment', { gateway, keyId, keySecret }),
  ownerPhone: (t: string, ownerPhone: string, storeName?: string) => call(t, '/owner-phone', { ownerPhone, storeName }),
  finalize: (t: string) => call(t, '/finalize', {}),
};
