/**
 * analytics.d.ts
 * Enterprise NDR Command Center - Analytics & ROI Types
 */

export interface FinancialROIData {
  rescuedOrders: number;
  avgFreightSavedPerOrder: number;
  freightSavings: number;
  retainedGmv: number;
  margin: number;
  gmvMarginSavings: number;
  totalHsmMessages: number;
  hsmCostPerMessage: number;
  whatsappHsmCosts: number;
  grossSavings: number;
  netSavings: number; // Net Money Saved (₹)
  rescueRate: number; // Rescue Rate (%)
  codToPrepaidCount: number;
  codToPrepaidGmv: number; // COD → Prepaid Conversions (₹)
  roiMultiple: number; // ROI Multiple (e.g. 14.2x)
  currency: string;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface CarrierFraudStats {
  carrier: string;
  totalOrders: number;
  totalNDR: number;
  fakeAttempts: number;
  fakeAttemptRate: number; // percentage
  disputedFreightValue: number; // fakeAttempts * avgFreight (₹140)
  legitimateNDR: number;
  avgFakeScore: number;
}

export interface FraudIndexData {
  carriers: CarrierFraudStats[];
  totalOrders: number;
  totalNDR: number;
  totalFakeAttempts: number;
  overallFakeRate: number;
  totalDisputedFreight: number;
  flaggedCarriersCount: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface FunnelStage {
  stage: 'ndr_triggered' | 'whatsapp_sent' | 'customer_replied' | 'rescued';
  label: string;
  count: number;
  conversionRateFromPrevious: number;
  conversionRateFromStart: number;
  dropOffCount: number;
}

export interface RescueFunnelData {
  stages: FunnelStage[];
  ndrTriggered: number;
  whatsappSent: number;
  customerReplied: number;
  rescued: number;
  overallRescueRate: number;
  aiTelemetry: {
    parserSuccessRate: number;
    sampleBefore: string;
    sampleAfter: string;
    addressesParsedCount: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface DisputeCsvRow {
  awb: string;
  carrier: string;
  courierRemark: string;
  customerReplyTimestamp: string;
  proofOfFakeAttempt: string;
}
