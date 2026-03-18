import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmProvider } from "@/components/ConfirmDialog";

// --- Global Setup for Reactive LocalStorage ---
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;
localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, [key, value]);
    window.dispatchEvent(new CustomEvent('local-storage', { detail: { key } }));
};
localStorage.removeItem = function (key) {
    originalRemoveItem.apply(this, [key]);
    window.dispatchEvent(new CustomEvent('local-storage', { detail: { key } }));
};
// ----------------------------------------------

// --- Apply saved font size immediately on startup ---
// This runs BEFORE React renders so there's no flash of wrong size
; (() => {
    const saved = parseInt(localStorage.getItem('elos_font_size') || '75', 10);
    const clamped = Math.max(60, Math.min(150, isNaN(saved) ? 75 : saved));
    document.documentElement.style.fontSize = `${clamped}%`;
})();
// ---------------------------------------------------

// --- Global Error Handlers (catches errors outside React) ---
window.onerror = (_msg, _source, _line, _col, error) => {
    console.error('[GlobalErrorHandler]', error);
};

window.addEventListener('unhandledrejection', (event) => {
    console.error('[UnhandledPromise]', event.reason);
});
// -----------------------------------------------------------

// --- Global Input Validation ---
// Handles: type="number" (numeric-only), data-validation="text-only" (no digits),
//          data-validation="phone" (digits, +, -, space only)
document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

    const el = target as HTMLInputElement;
    const validation = el.dataset.validation;
    const isNumber = el.type === 'number';

    // Navigation / editing keys always allowed
    const nav = [
        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'Home', 'End',
    ];
    if (nav.includes(e.key)) return;
    if (e.ctrlKey || e.metaKey) return;

    // --- type="number" → only digits, dot, minus ---
    if (isNumber) {
        if (e.key === '.' || e.key === '-') return;
        if (/^(Digit|Numpad)\d$/.test(e.code)) return;
        if (/^[0-9\u0660-\u0669]$/.test(e.key)) return;
        e.preventDefault();
        return;
    }

    // --- data-validation="text-only" → block digits ---
    if (validation === 'text-only') {
        if (/^[0-9\u0660-\u0669]$/.test(e.key)) { e.preventDefault(); return; }
        if (/^(Digit|Numpad)\d$/.test(e.code)) { e.preventDefault(); return; }
        return;
    }

    // --- data-validation="phone" → allow digits, +, -, space only ---
    if (validation === 'phone') {
        if (/^[0-9\u0660-\u0669+\- ]$/.test(e.key)) return;
        if (/^(Digit|Numpad)\d$/.test(e.code)) return;
        e.preventDefault();
        return;
    }
});

// --- Auto-select content on focus for number inputs ---
// So the user can immediately type without selecting the existing "0" first
document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') return;
    const el = target as HTMLInputElement;
    if (el.type === 'number') {
        el.select();
    }
});
// ---------------------------------------------------------

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <ConfirmProvider>
            <App />
        </ConfirmProvider>
    </ErrorBoundary>
);
