/**
 * Normalize Indian phone numbers to format '91XXXXXXXXXX'
 * Handles format: +91-9876543210, 09876543210, 919876543210, 9876543210, +91 98765 43210, etc.
 */
export function normalizeIndianPhone(phone: string): string {
  // Remove non-digit characters
  let clean = phone.replace(/\D/g, '');

  // If it starts with 0 and has 11 digits (e.g. 09876543210), strip the leading 0
  if (clean.length === 11 && clean.startsWith('0')) {
    clean = clean.substring(1);
  }

  // If it's a 10 digit number (e.g. 9876543210), append '91' prefix
  if (clean.length === 10) {
    clean = '91' + clean;
  }

  // Return normalized number
  return clean;
}

/**
 * Validates if the phone number is a valid Indian mobile number.
 * Indian mobile numbers after normalization should be exactly 12 digits starting with '91' and the next digit between 6 and 9.
 */
export function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizeIndianPhone(phone);
  return /^91[6-9]\d{9}$/.test(normalized);
}
