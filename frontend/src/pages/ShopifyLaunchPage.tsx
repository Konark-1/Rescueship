import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { normalizeShop, rememberPendingShop } from '../lib/shopify-launch';

/** application_url of the Shopify app: /shopify?shop=<store>.myshopify.com&hmac=…&host=… */
export default function ShopifyLaunchPage() {
  const [params] = useSearchParams();
  const { isAuthenticated, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    const shop = normalizeShop(params.get('shop'));
    if (shop) rememberPendingShop(shop);
    // Login → (pay) → onboarding resumes the Shopify connect from sessionStorage.
    nav(isAuthenticated ? '/onboarding?station=shopify' : '/login', { replace: true });
  }, [loading, isAuthenticated, params, nav]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)' }}>
      Opening RescueShip…
    </div>
  );
}
