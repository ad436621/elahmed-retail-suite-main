export function generateId(prefix: string = ''): string {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
}

export function generateBarcode(prefix: string = ''): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return prefix ? `${prefix}-${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

export function generateSimpleId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
}
