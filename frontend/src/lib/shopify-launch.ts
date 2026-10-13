/**
 * Shopify install / app-launch hand-off.
 *
 * Shopify opens our application_url with ?shop=<store>.myshopify.com (+ hmac, host,
 * timestamp). The merchant may not be logged in or may not have paid yet, so we park
 * the validated shop domain in sessionStorage and resume the OAuth connect once the
 * onboarding Store step is reached. The backend re-validates the domain and signs the
 * OAuth state; this is only a convenience.
 */
const KEY = 'rs_pending_shop';
const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function normalizeShop(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const shop = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return SHOP_RE.test(shop) ? shop : null;
}

export function rememberPendingShop(shop: string) {
  try { sessionStorage.setItem(KEY, shop); } catch { /* storage blocked: user re-enters the domain */ }
}

export function takePendingShop(): string | null {
  try {
    const v = normalizeShop(sessionStorage.getItem(KEY));
    sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
