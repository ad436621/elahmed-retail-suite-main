// ============================================================
// useBarcodeScanner — Custom hook for barcode scanner support
// Handles hardware barcode scanners and manual barcode input
// Returns: scanned barcode value and handlers
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseBarcodeScannerOptions {
    /** Callback when valid barcode is scanned */
    onScan?: (barcode: string) => void;
    /** Minimum barcode length to consider valid */
    minLength?: number;
    /** Maximum barcode length */
    maxLength?: number;
    /** Time window for barcode input (ms) - scanners type fast */
    scanTimeout?: number;
    /** Enable debug logging */
    debug?: boolean;
}

interface UseBarcodeScannerReturn {
    /** Current barcode value */
    barcode: string;
    /** Whether a scanner is currently connected/active */
    isScannerActive: boolean;
    /** Input handler for manual entry or scanner */
    handleInput: (value: string) => void;
    /** Clear the barcode */
    clearBarcode: () => void;
    /** Last scanned barcode (for display) */
    lastScanned: string | null;
}

/**
 * Custom hook for barcode scanner support
 * 
 * Hardware scanners typically:
 * - Type characters very fast (1-10ms per character)
 * - End with Enter key
 * - Don't have modifier keys
 * 
 * This hook distinguishes between manual typing and scanner input
 * by measuring the time between keystrokes.
 */
export function useBarcodeScanner({
    onScan,
    minLength = 8,
    maxLength = 20,
    scanTimeout = 50, // If keys come faster than this, likely a scanner
    debug = false,
}: UseBarcodeScannerOptions = {}): UseBarcodeScannerReturn {
    const [barcode, setBarcode] = useState('');
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [isScannerActive, setIsScannerActive] = useState(false);

    // Track keystroke timing to detect scanner
    const lastKeyTime = useRef<number>(0);
    const charBuffer = useRef<string>('');
    const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Clear buffer after timeout
    const clearBuffer = useCallback(() => {
        charBuffer.current = '';
        setIsScannerActive(false);
    }, []);

    // Process a complete barcode
    const processBarcode = useCallback((code: string) => {
        const trimmedCode = code.trim();

        // Validate barcode length
        if (trimmedCode.length < minLength || trimmedCode.length > maxLength) {
            if (debug) console.log('[Barcode] Invalid length:', trimmedCode.length);
            return false;
        }

        // Valid barcode found
        if (debug) console.log('[Barcode] Scanned:', trimmedCode);

        setLastScanned(trimmedCode);
        setBarcode(trimmedCode);
        onScan?.(trimmedCode);

        return true;
    }, [minLength, maxLength, onScan, debug]);

    // Handle keyboard input
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const now = Date.now();
        const timeSinceLastKey = now - lastKeyTime.current;

        // Clear any pending timeout
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
        }

        // Check for Enter key - might be end of barcode
        if (e.key === 'Enter') {
            if (charBuffer.current.length >= minLength) {
                processBarcode(charBuffer.current);
            }
            charBuffer.current = '';
            setIsScannerActive(false);
            return;
        }

        // Ignore modifier keys and special keys
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        if (e.key.length > 1 && e.key !== 'Backspace') return;

        // Calculate if this looks like scanner input
        const isFastInput = timeSinceLastKey < scanTimeout && timeSinceLastKey > 0;

        if (isFastInput) {
            // Likely scanner - add to buffer
            setIsScannerActive(true);
            charBuffer.current += e.key;

            // Set timeout to clear buffer if input stops
            scanTimeoutRef.current = setTimeout(clearBuffer, scanTimeout * 3);
        } else {
            // Likely manual typing - just update display
            charBuffer.current = '';
            setIsScannerActive(false);
        }

        lastKeyTime.current = now;
    }, [minLength, scanTimeout, processBarcode, clearBuffer]);

    // Handle direct input (from search field or scanner input)
    const handleInput = useCallback((value: string) => {
        setBarcode(value);

        // Check if this looks like a barcode (all digits or alphanumeric)
        const isBarcode = /^[0-9A-Za-z]+$/.test(value);

        if (isBarcode && value.length >= minLength) {
            // Could be a barcode - trigger scan
            processBarcode(value);
        }
    }, [minLength, processBarcode]);

    // Clear barcode state
    const clearBarcode = useCallback(() => {
        setBarcode('');
        charBuffer.current = '';
        setIsScannerActive(false);
    }, []);

    // Set up keyboard listener
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
        };
    }, [handleKeyDown]);

    return {
        barcode,
        isScannerActive,
        handleInput,
        clearBarcode,
        lastScanned,
    };
}

export default useBarcodeScanner;
