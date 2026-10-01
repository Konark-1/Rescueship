export const AVG_RESCUE_VALUE = 250; // ₹ saved per rescue (midpoint of ₹200–400 RTO loss)

export interface Plan {
  id: string;
  name: string;
  maxOrders: number;
  priceMonthly: number;
  blurb?: string;
}

export const PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', maxOrders: 1000, priceMonthly: 4999, blurb: 'For early D2C brands feeling the first RTO sting.' },
  { id: 'growth',  name: 'Growth',  maxOrders: 5000, priceMonthly: 11999, blurb: 'Where recovery becomes a line item you watch grow.' },
  { id: 'scale',   name: 'Scale',   maxOrders: 12000, priceMonthly: 24999, blurb: 'For scaling brands that refuse to lose orders.' },
  { id: 'fleet',   name: 'Fleet',   maxOrders: 25000, priceMonthly: 44999, blurb: 'For high-volume ops with multi-carrier delivery.' },
];

export const tierForOrders = (n: number): Plan =>
  PLANS.find((p) => n <= p.maxOrders) ?? PLANS[PLANS.length - 1];
