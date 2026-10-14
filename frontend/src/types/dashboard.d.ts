import type { RiskLevel } from '../../types/analytics.d';

export type StorePlatform = 'shopify' | 'woocommerce' | 'custom';

export type OrderStatus =
  | 'new'
  | 'awaiting_deposit'
  | 'awaiting_prepaid_conversion'
  | 'confirmed'
  | 'cod_conversion_sent'
  | 'converted_to_prepaid'
  | 'shipped'
  | 'ndr_detected'
  | 'ndr_rescue_sent'
  | 'ndr_pending_review'
  | 'ndr_rescued'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto_initiated'
  | 'rto'
  | 'returned'
  | 'cancelled';

export interface UnifiedDashboardOrder {
  id: string;
  orderId: string;
  externalOrderId: string;
  platform: StorePlatform;
  customerName: string;
  phone: string;
  orderValue: number;
  paymentMethod: 'cod' | 'prepaid';
  status: OrderStatus;
  carrier?: string | null;
  awb?: string | null;
  createdAt: string;

  // NDR data
  ndr?: {
    reason?: string | null;
    attemptNumber?: number;
    detectedAt?: string | null;
    fakeRemarkScore?: number;
    isFakeAttempt?: boolean;
    rtoDeadline?: string | null;
    customerResponse?: string | null;
  };

  // Risk data
  rtoRisk?: {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    score: number;
    factors: string[];
    recommendedAction?: string;
  };

  // Address data
  shippingAddress?: any;

  // AI data
  aiAddress?: {
    original?: string;
    parsed?: string;
    confidence?: number;
    coordinates?: { lat: number; lng: number };
  };

  // WhatsApp data
  whatsapp?: {
    status?: 'sent' | 'delivered' | 'read' | 'replied' | 'failed';
    lastMessageAt?: string | null;
    messageCount?: number;
  };

  // Platform-specific tags/notes
  tags?: string[];
  wcStatus?: string;
  wcNotes?: string[];
  customerNote?: string;

  // Financial
  rtoFeeSaved?: number;
  codConverted?: boolean;
}

export interface SystemHealthData {
  wabaHealth: 'GREEN' | 'YELLOW' | 'RED';
  metaTier: {
    metaTierLimit: number;
    current24hCount: number;
    isLimitReached: boolean;
  };
  dlqFailedCount: number;
  webhookHealthy: boolean;
}
