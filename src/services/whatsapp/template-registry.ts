/**
 * template-registry.ts
 * ─────────────────────────────────────────────────────────────
 * Single source of truth for WhatsApp templates: the definitions we submit
 * to each merchant's WABA, and the map from the LOGICAL names the engine
 * sends to the REGISTERED names on Meta. Pure module (no I/O) so the send
 * boundary in whatsapp.service can resolve names without import cycles.
 */
/**
 * Meta requires URL buttons to have a FIXED host with at most one trailing {{1}}
 * variable. We host a tiny redirector so the payment link (Razorpay/Cashfree,
 * different hosts) can be passed as the dynamic suffix.
 */
const PAY_REDIRECT_BASE = `${(process.env.API_PUBLIC_URL || process.env.API_BASE_URL || 'https://app.rescueship.io').replace(/\/$/, '')}/r/pay/`;

export interface TplDef {
  name: string;
  category: 'UTILITY' | 'MARKETING';
  language: string;
  body: string;
  bodyExample?: string[];
  buttons?: {
    type: 'QUICK_REPLY' | 'URL';
    text: string;
    url?: string;
    example?: string[];
  }[];
}

export const DEFAULT_TEMPLATE_MAP: Record<string, string> = {
  ndr_rescue_en: 'ndr_rescue_v2_en',
  // NDR dispatcher categories (template-mapper.service) all resolve to submitted templates.
  ndr_reschedule_en: 'ndr_rescue_v2_en',
  ndr_retention_en: 'ndr_rescue_v2_en',
  ndr_cod_convert_en: 'ndr_rescue_v2_en',
  ndr_address_en: 'address_pin_v2_en',
  rto_arrest_en: 'rto_arrest_v2_en',
  ndr_predelivery_en: 'predelivery_confirm_v2_en',
  seller_payment_alert: 'seller_payment_alert_v2_en',
  cod_confirm_en: 'cod_confirm_v2_en',
  cod_convert_en: 'cod_convert_v2_en',
  address_pin_en: 'address_pin_v2_en',
  rescue_done_en: 'rescue_done_v2_en',
  rs_test_pulse_en: 'rs_test_pulse_v2_en',
  predelivery_confirmation: 'predelivery_confirm_v2_en',
  predelivery_confirm_en: 'predelivery_confirm_v2_en',
  cod_reminder_en: 'cod_reminder_v2_en',
  ndr_deposit_request_en: 'ndr_deposit_request_en',
};

/** Registered compliant templates on Meta WABA. */
export const TEMPLATE_DEFS: TplDef[] = [
  {
    name: 'ndr_rescue_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: "Hi {{1}}, we couldn't confirm a delivery attempt on order {{2}}. Can you help us verify so we can get this to you?",
    bodyExample: ['John', 'ORD-1001'],
    // Meta allows maximum 3 quick reply buttons
    buttons: [
      { type: 'QUICK_REPLY', text: "Yes I'm home" },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
      { type: 'QUICK_REPLY', text: 'Cancel order' },
    ],
  },
  {
    name: 'cod_confirm_v2_en',
    category: 'UTILITY',
    language: 'en',   // utility-first default (L-3)
    body: 'Hi {{1}}, confirm order {{2}} by paying online to lock your delivery slot. No cash needed at the door.',
    bodyExample: ['John', 'ORD-1001'],
    buttons: [
      {
        type: 'URL',
        text: 'Pay Now',
        url: `${PAY_REDIRECT_BASE}{{1}}`,
        example: [`${PAY_REDIRECT_BASE}plink_example123`],
      },
    ],
  },
  {
    name: 'cod_convert_v2_en',
    category: 'MARKETING',
    language: 'en', // incentive variant (costlier)
    body: 'Hi {{1}}, pay online for order {{2}} now and get {{3}} off. Tap Pay Now to confirm.',
    bodyExample: ['John', 'ORD-1001', '10%'],
    buttons: [
      {
        type: 'URL',
        text: 'Pay Now',
        url: `${PAY_REDIRECT_BASE}{{1}}`,
        example: [`${PAY_REDIRECT_BASE}plink_example123`],
      },
    ],
  },
  {
    name: 'address_pin_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{1}}, please share your exact delivery location pin for order {{2}} so the driver can find you.',
    bodyExample: ['John', 'ORD-1001'],
  },
  {
    name: 'rescue_done_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Great news — order {{1}} is back on track and will be delivered {{2}}. Thank you!',
    bodyExample: ['ORD-1001', 'tomorrow'],
  },
  {
    name: 'rs_test_pulse_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: 'RescueShip is connected. This is a test rescue for {{1}} — your WhatsApp recovery is live.',
    bodyExample: ['Mamaearth Store'],
  },
  {
    name: 'predelivery_confirm_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{1}}, your order {{2}} is out for delivery today. Please confirm if you are available to receive your package:',
    bodyExample: ['John', 'ORD-1001'],
    buttons: [
      { type: 'QUICK_REPLY', text: "Yes I'm home" },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
      { type: 'QUICK_REPLY', text: 'Cancel order' },
    ],
  },
  {
    name: 'cod_reminder_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{1}}, a quick reminder that your COD order {{2}} for {{3}} is scheduled for delivery soon. Please keep cash or UPI ready.',
    bodyExample: ['John', 'ORD-1001', '₹999'],
    buttons: [
      {
        type: 'URL',
        text: 'Pay via UPI',
        url: `${PAY_REDIRECT_BASE}{{1}}`,
        example: [`${PAY_REDIRECT_BASE}plink_example123`],
      },
    ],
  },
  {
    name: 'ndr_deposit_request_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{1}}, to confirm Order #{{2}} for re-delivery, pay online now via UPI to save ₹{{3}} instantly! Remaining ₹{{4}} payable on delivery.',
    bodyExample: ['John', 'ORD-1001', '50', '450'],
    buttons: [
      {
        type: 'URL',
        text: 'Pay & Save Discount',
        url: `${PAY_REDIRECT_BASE}{{1}}`,
        example: [`${PAY_REDIRECT_BASE}plink_example123`],
      },
    ],
  },
  {
    name: 'rto_arrest_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Hi {{1}}, your order {{2}} is about to be sent back to the seller because delivery could not be completed. Do you still want it?',
    bodyExample: ['John', 'ORD-1001'],
    buttons: [
      { type: 'QUICK_REPLY', text: "Yes I'm home" },
      { type: 'QUICK_REPLY', text: 'Reschedule' },
      { type: 'QUICK_REPLY', text: 'Cancel order' },
    ],
  },
  {
    name: 'seller_payment_alert_v2_en',
    category: 'UTILITY',
    language: 'en',
    body: 'Payment received: order {{1}} was paid {{2}} online through RescueShip.',
    bodyExample: ['ORD-1001', '₹999'],
  },
];

export function buildComponents(d: TplDef) {
  const bodyComp: any = { type: 'BODY', text: d.body };
  if (d.bodyExample && d.bodyExample.length > 0) {
    bodyComp.example = { body_text: [d.bodyExample] };
  }
  const comps: any[] = [bodyComp];
  if (d.buttons?.length) {
    comps.push({
      type: 'BUTTONS',
      buttons: d.buttons.map((b) => {
        if (b.type === 'QUICK_REPLY') {
          return { type: 'QUICK_REPLY', text: b.text };
        }
        const bUrl = b.url || `${PAY_REDIRECT_BASE}{{1}}`;
        const ex = b.example || [bUrl.replace(/{{\d+}}/g, 'plink_example123')];
        return { type: 'URL', text: b.text, url: bUrl, example: ex };
      }),
    });
  }
  return comps;
}


const DEF_BY_NAME = new Map(TEMPLATE_DEFS.map((d) => [d.name, d]));

export function bodyParamCount(def: TplDef): number {
  const nums = (def.body.match(/{{(\d+)}}/g) || []).map((m) => Number(m.replace(/\D/g, '')));
  return nums.length ? Math.max(...nums) : 0;
}

export interface ResolvedTemplate {
  name: string;
  language: string;
  components: any[];
  error?: string;
}

/**
 * Resolve a logical template name to the registered one and adapt the payload to the
 * registered definition: merchant override → default map → name as given; Hindi falls
 * back to English when no Hindi template is registered; extra body params are trimmed
 * (callers always lead with name, order id); a missing URL-button param is an error.
 */
export function resolveTemplate(logicalName: string, language: string, components: any[], merchantMap?: Record<string, string>): ResolvedTemplate {
  const map = merchantMap || {};
  let lang = language || 'en';
  let name = map[logicalName] || DEFAULT_TEMPLATE_MAP[logicalName];
  if (!name && lang !== 'en' && /_hi$/.test(logicalName)) {
    const en = logicalName.replace(/_hi$/, '_en');
    name = map[en] || DEFAULT_TEMPLATE_MAP[en];
    if (name) lang = 'en';
  }
  name = name || logicalName;
  const def = DEF_BY_NAME.get(name);
  if (!def) return { name, language: lang, components };
  if (lang !== def.language) lang = def.language;

  const want = bodyParamCount(def);
  const out: any[] = [];
  const body = components.find((c) => String(c?.type).toLowerCase() === 'body');
  const params: any[] = body?.parameters || [];
  if (params.length < want) {
    return { name, language: lang, components, error: `Template ${name} needs ${want} body parameters, got ${params.length}` };
  }
  if (want > 0) out.push({ ...body, type: 'body', parameters: params.slice(0, want) });

  const urlButtons = (def.buttons || []).filter((b) => b.type === 'URL');
  if (urlButtons.length) {
    const btn = components.find((c) => String(c?.type).toLowerCase() === 'button' && String(c?.sub_type).toLowerCase() === 'url');
    if (!btn) return { name, language: lang, components, error: `Template ${name} needs a URL button parameter` };
    out.push(btn);
  }
  return { name, language: lang, components: out };
}
