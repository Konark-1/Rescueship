/**
 * Single source of truth for who operates RescueShip. Legal pages, footers and
 * emails read from here — update once when the Udyam number / domain / address change.
 * Keep every value TRUE: Meta, Razorpay and Shopify reviewers compare these pages
 * against the business verification documents.
 */
export const LEGAL = {
  brand: 'RescueShip',
  legalName: 'Rescueship',
  entityType: 'a sole proprietorship',
  proprietor: 'Konark Parihar',
  /** e.g. 'UDYAM-RJ-00-0000000' once issued; empty hides the line. */
  udyamNumber: '',
  /** Postal address shown on legal pages; empty shows country only. */
  address: '',
  country: 'India',
  contactEmail: 'konarkofficial@gmail.com',
  website: 'https://rescueship.netlify.app',
  effectiveDate: 'October 13, 2026',
  /** Courts with jurisdiction over disputes (Terms of Service). */
  jurisdiction: 'Gautam Buddh Nagar (Noida), Uttar Pradesh',
  /** Money-back guarantee window, in days, from the first paid subscription. Keep BillingPage/landing in sync. */
  guaranteeDays: 90,
} as const;

export const legalEntityLine = () =>
  `${LEGAL.legalName}, ${LEGAL.entityType} of ${LEGAL.proprietor}` +
  (LEGAL.udyamNumber ? ` (Udyam ${LEGAL.udyamNumber})` : '') +
  `, ${LEGAL.address ? `${LEGAL.address}, ` : ''}${LEGAL.country}`;
