import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import type { StorePlatform } from '../types/dashboard.d';

export interface UseMerchantPlatformReturn {
  platform: StorePlatform;
  isShopify: boolean;
  isWooCommerce: boolean;
  isCustom: boolean;
  platformName: string;
}

export function useMerchantPlatform(): UseMerchantPlatformReturn {
  const { user } = useAuth();
  const platform = (user?.platform || 'shopify') as StorePlatform;

  return useMemo(() => {
    return {
      platform,
      isShopify: platform === 'shopify',
      isWooCommerce: platform === 'woocommerce',
      isCustom: platform === 'custom',
      platformName:
        platform === 'shopify'
          ? 'Shopify'
          : platform === 'woocommerce'
          ? 'WooCommerce'
          : 'Custom Store',
    };
  }, [platform]);
}
