/**
 * i18n/messages.ts
 * ─────────────────────────────────────────────────────────────
 * Centralized English message templates for all NDR rescue, address correction,
 * and COD conversion flows.
 */

export type SupportedLanguage = 'en';

export interface MessageTemplate {
  ndrDetected: (reason: string, orderId: string) => string;
  ndrEscalation: (attempt: number, orderId: string) => string;
  codConversion: (amount: number, discount: number, orderId: string) => string;
  codReminder: (amount: number, orderId: string) => string;
  addressRequest: string;
  addressLocationPin: string;
  addressTextRequest: string;
  addressBothStep1: string;
  addressBothStep2: string;
  addressConfirmed: string;
  addressFailed: string;
  paymentReceived: (amount: number, orderId: string) => string;
  orderRescued: (orderId: string) => string;
  orderRTO: (orderId: string) => string;
}

const MESSAGES: Record<SupportedLanguage, MessageTemplate> = {
  en: {
    ndrDetected: (reason, orderId) =>
      `🚚 *Delivery Update*\n\nYour order #${orderId} could not be delivered.\nReason: ${reason}\n\nWould you like us to reschedule? Reply below.`,
    ndrEscalation: (attempt, orderId) =>
      `⏰ *Reminder (${attempt}/3)*\n\nWe're still trying to deliver order #${orderId}.\nPlease confirm your availability or update your address.`,
    codConversion: (amount, discount, orderId) =>
      `💳 *Pay Online & Save ₹${discount}!*\n\nOrder #${orderId}: ₹${amount}\nPay now via UPI/Card and get ₹${discount} OFF.\n\nTap "Pay Now" below 👇`,
    codReminder: (amount, orderId) =>
      `⏰ *Payment Reminder*\n\nOrder #${orderId} (₹${amount}) is awaiting your online payment.\nPay now to confirm your delivery!`,
    addressRequest: '📝 Please share your correct delivery address so we can complete your delivery.',
    addressLocationPin: '📍 Please share your exact delivery location pin.\n\nIn WhatsApp, tap 📎 (Attach) > Location > "Send Current Location".',
    addressTextRequest: '📝 Please type your complete delivery address (floor, tower, landmark, pincode).',
    addressBothStep1: '📍 *Step 1/2:* Please share your exact delivery location pin.\n\nIn WhatsApp, tap 📎 (Attach) > Location > "Send Current Location" or drop a pin on your building.',
    addressBothStep2: '✅ Location received!\n\n📝 *Step 2/2:* Now please type your building details:\n- Floor / Tower / Room number\n- Building name\n- Nearby landmark\n- Pincode (6 digits)',
    addressConfirmed: '✅ Thank you! Your address has been updated and the courier has been notified. 🚚',
    addressFailed: '⚠️ Address update failed. Please reply again with your complete address including a valid 6-digit pincode.',
    paymentReceived: (amount, orderId) =>
      `✅ *Payment Received!*\n\nOrder #${orderId}: ₹${amount}\nYour order is confirmed and will be delivered soon. 🎉`,
    orderRescued: (orderId) =>
      `✅ *Delivery Rescheduled!*\n\nOrder #${orderId} has been rescheduled. Our delivery partner will attempt again soon. 🚚`,
    orderRTO: (orderId) =>
      `❌ *Delivery Cancelled*\n\nOrder #${orderId} has been returned to sender after multiple failed attempts.\nContact support if you still want this order.`,
  },
};

/**
 * Get message template (English only).
 */
export function getMessages(lang?: string): MessageTemplate {
  return MESSAGES.en;
}

/**
 * Translate an NDR reason code to human-readable English text.
 */
export function translateReason(reason: string, lang?: string): string {
  const reasonMap: Record<string, string> = {
    'customer_unavailable': 'Customer Unavailable',
    'door_locked': 'Door Locked',
    'address_incomplete': 'Incomplete Address',
    'customer_refused': 'Customer Refused',
    'phone_unreachable': 'Phone Unreachable',
    'fake_remark': 'Suspicious Delivery Remark',
    'out_of_area': 'Out of Delivery Area',
  };

  const normalizedReason = reason.toLowerCase().replace(/[\s-]+/g, '_');
  return reasonMap[normalizedReason] || reason;
}

export default MESSAGES;
