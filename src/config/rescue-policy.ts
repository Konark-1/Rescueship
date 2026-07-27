/**
 * rescue-policy.ts
 * ─────────────────────────────────────────────────────────────
 * ONE merchant-scoped object holds every behavioural knob.
 * Defaults encode the redesign: engage every courier failure,
 * accuse no one, utility-first framing. The fake-remark score is
 * explicitly NOT a gate on the customer message.
 */
export type IncentiveType = 'none' | 'flat' | 'percent';
export type CourierEscalation = 'off' | 'auto_above' | 'merchant_approval';
export type AddressMode = 'both' | 'location_pin' | 'text';

export interface RescuePolicy {
  engage: {
    onEveryCourierFailure: boolean;       // default ON
    respectMerchantManualResolve: boolean;
  };
  incentive: {                            // selectable, cost-shown in UI
    type: IncentiveType;
    flatInr?: number;
    percent?: number;
    metaCategoryIntended: 'utility' | 'marketing';
  };
  addressCorrection: { defaultMode: AddressMode };
  escalation: { chainHours: number[] };
  tone: { language: 'en'; accusatory: false };   // enforced by lint (F6)
  reviewMode: {                           // OPTIONAL policy, NOT a score gate
    enabled: boolean;
    when: 'off' | 'all' | 'high_value_only';
    highValueInr?: number;
    approvalTimeoutMin: number;
  };
  fakeRemark: {                           // DEMOTED — internal signal only
    useForCustomerGate: false;            // structural: must stay false
    useForMerchantAnalytics: boolean;
    courierEscalation: CourierEscalation;
    escalationThreshold?: number;         // 0..1, only if courierEscalation != 'off'
  };
  pilot?: { holdoutRate: number; pilotId?: string };        // 0..1, pilot-only control group (L-1)
}

export function defaultRescuePolicy(): RescuePolicy {
  return {
    engage: { onEveryCourierFailure: true, respectMerchantManualResolve: true },
    incentive: { type: 'none', metaCategoryIntended: 'utility' },
    addressCorrection: { defaultMode: 'both' },
    escalation: { chainHours: [4, 12, 24] },
    tone: { language: 'en', accusatory: false },
    reviewMode: { enabled: false, when: 'off', approvalTimeoutMin: 30 },
    fakeRemark: { useForCustomerGate: false, useForMerchantAnalytics: true, courierEscalation: 'off' },
    pilot: { holdoutRate: 0 },
  };
}

/** Merge a merchant's stored (partial) policy over the defaults. */
export function getPolicy(stored: Partial<RescuePolicy> | undefined | null): RescuePolicy {
  const base = defaultRescuePolicy();
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    engage: { ...base.engage, ...(stored.engage || {}) },
    incentive: { ...base.incentive, ...(stored.incentive || {}) },
    addressCorrection: { ...base.addressCorrection, ...(stored.addressCorrection || {}) },
    escalation: { ...base.escalation, ...(stored.escalation || {}) },
    tone: { ...base.tone, ...(stored.tone || {}), accusatory: false }, // hard-locked
    reviewMode: { ...base.reviewMode, ...(stored.reviewMode || {}) },
    fakeRemark: { ...base.fakeRemark, ...(stored.fakeRemark || {}), useForCustomerGate: false }, // hard-locked
    pilot: {
      holdoutRate: stored.pilot?.holdoutRate ?? base.pilot?.holdoutRate ?? 0,
      pilotId: stored.pilot?.pilotId,
    },
  };
}

export function validatePolicy(p: RescuePolicy): string[] {
  const e: string[] = [];
  if (p.fakeRemark.useForCustomerGate) e.push('fakeRemark.useForCustomerGate must be false');
  if (p.tone.accusatory) e.push('tone.accusatory must be false');
  if (p.incentive.type === 'flat' && (p.incentive.flatInr ?? 0) <= 0) e.push('flat incentive needs flatInr > 0');
  if (p.incentive.type === 'percent' && (p.incentive.percent ?? 0) <= 0) e.push('percent incentive needs percent > 0');
  if ((p.pilot?.holdoutRate ?? 0) < 0 || (p.pilot?.holdoutRate ?? 0) > 0.5) e.push('holdoutRate must be 0..0.5');
  if (p.incentive.type !== 'none' && p.incentive.metaCategoryIntended !== 'marketing')
    e.push('any incentive forces marketing category — set metaCategoryIntended accordingly');
  return e;
}
