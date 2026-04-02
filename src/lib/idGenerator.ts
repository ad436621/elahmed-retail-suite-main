// ============================================================
// ID & Barcode Generator — Uses crypto for secure random values
// ============================================================

function getSecureRandomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomPart = getSecureRandomHex(3); // 6 chars
    return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
}

export function generateBarcode(prefix: string = ''): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomPart = getSecureRandomHex(2); // 4 chars
    return prefix ? `${prefix}-${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

export function generateSimpleId(): string {
    return Date.now().toString(36) + getSecureRandomHex(2);
}
