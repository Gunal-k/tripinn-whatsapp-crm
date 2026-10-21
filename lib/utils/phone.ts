/**
 * Utility functions for normalizing and validating international phone numbers
 * for WhatsApp Business Cloud API and Meta Conversions API.
 */

export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  // Remove all non-digit characters
  const digits = rawPhone.replace(/\D/g, '');
  
  // Strip leading 00 if international format (e.g. 0091... -> 91...)
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  
  return digits;
}

export function isValidInternationalPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // International E.164 phone numbers typically have 7 to 15 digits
  return /^\d{8,15}$/.test(normalized);
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return '-';
  
  // Format for Indian numbers (91...) if applicable
  if (normalized.startsWith('91') && normalized.length === 12) {
    return `+91 ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
  }
  
  // Format for US numbers (1...) if applicable
  if (normalized.startsWith('1') && normalized.length === 11) {
    return `+1 (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7)}`;
  }
  
  // Generic international display
  return `+${normalized}`;
}
