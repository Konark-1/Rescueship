/**
 * customer-copy.ts  (English only — single source of CUSTOMER-facing strings)
 * ─────────────────────────────────────────────────────────────
 * Every literal that can reach a customer lives in COPY_STRINGS so
 * the build-time lint (F6) can scan them. Builders only interpolate
 * into these literals — they never introduce new customer copy.
 *
 * RULE (L-6): we NEVER tell the customer the courier lied. We frame
 * everything as "we couldn't confirm an attempt — please verify."
 * The accusation, if any, lives in the internal fraud score + the
 * merchant report, never here.
 */
export const COPY_STRINGS: string[] = [
  'Hi {name}! We couldn\'t confirm a delivery attempt on order {orderId}. Can you help us verify so we can get this to you?',
  'Your order {orderId} shows an unusual delivery status. What would you like to do?',
  'Please share your exact delivery location pin. In WhatsApp tap Attach > Location > Send Current Location.',
  'Location received. Now please type your building details: floor / tower / room, building name, landmark, 6-digit pincode.',
  'Thank you. Your address is updated and the delivery hub has been notified for a priority attempt.',
  'We couldn\'t update the address. Please resend your complete address with a valid 6-digit pincode.',
  'We\'ve escalated this to the delivery hub for priority handling. A re-attempt is scheduled for {window}.',
  'Sorry we missed you. Want us to reschedule, or would a {incentive} help confirm delivery today?',
  'Your order {orderId} has been cancelled. Here is coupon {coupon} for next time — we\'d love another chance.',
  'Payment of {amount} received for order {orderId}. Confirmed as prepaid — no cash needed at delivery.',
];

const pick = (i: number) => COPY_STRINGS[i];
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

export const COPY = {
  verifyInitial: (v: { name: string; orderId: string }) => fill(pick(0), v),
  unusualStatus: (v: { orderId: string }) => fill(pick(1), v),
  askLocationPin: () => pick(2),
  askBuildingDetails: () => pick(3),
  addressConfirmed: () => pick(4),
  addressFailed: () => pick(5),
  escalated: (v: { window: string }) => fill(pick(6), v),
  retentionOffer: (v: { incentive: string }) => fill(pick(7), v),
  cancelled: (v: { orderId: string; coupon: string }) => fill(pick(8), v),
  paymentReceived: (v: { amount: string; orderId: string }) => fill(pick(9), v),
};
