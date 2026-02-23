/**
 * useBarcodeScanner — detects a USB/laser barcode scanner
 *
 * A hardware scanner types all characters in rapid succession (<50 ms gap
 * between each keystroke) and finishes with an Enter key. This hook listens
 * globally and fires `onScan(code)` whenever that pattern is detected.
 *
 * @param onScan  callback called with the scanned barcode string
 * @param enabled set to false to temporarily disable scanning (e.g. when a dialog is open)
 */
import { useEffect, useRef } from 'react';

interface UseBarcodeScanner {
    onScan: (code: string) => void;
    enabled?: boolean;
    /** Minimum barcode length to trigger (default 3) */
    minLength?: number;
    /** Max ms between keystrokes to count as scanner input (default 50) */
    maxGap?: number;
}

export function useBarcodeScanner({
    onScan,
    enabled = true,
    minLength = 3,
    maxGap = 50,
}: UseBarcodeScanner) {
    const buffer = useRef('');
    const lastKeytime = useRef(0);

    useEffect(() => {
        if (!enabled) return;

        const handleKeydown = (e: KeyboardEvent) => {
            // Ignore modifier combos (Ctrl+C etc.)
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const now = Date.now();
            const gap = now - lastKeytime.current;
            lastKeytime.current = now;

            if (e.key === 'Enter') {
                const code = buffer.current.trim();
                buffer.current = '';
                if (code.length >= minLength) {
                    onScan(code);
                }
                return;
            }

            // If gap is too large, this is a human typing — reset buffer
            if (buffer.current.length > 0 && gap > maxGap) {
                buffer.current = '';
            }

            // Accumulate printable single characters
            if (e.key.length === 1) {
                buffer.current += e.key;
            }
        };

        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [enabled, onScan, minLength, maxGap]);
}
