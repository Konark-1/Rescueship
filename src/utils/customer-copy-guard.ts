/** Tokens that accuse the courier — forbidden in any CUSTOMER-facing string. */
export const ACCUSATORY = /\b(lied|never came|never knocked|no one came|didn'?t (come|visit|arrive)|did not (come|visit|arrive)|fake remark|fraud|courier lied)\b/i;

export function assertSafeCopy(s: string): string {
  if (ACCUSATORY.test(s)) throw new Error(`Customer copy contains accusatory token: "${s}"`);
  return s;
}

export function scanCustomerCopy(strings: string[]): string[] {
  return strings.filter((s) => ACCUSATORY.test(s));
}
