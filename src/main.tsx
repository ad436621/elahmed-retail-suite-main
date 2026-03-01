import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmProvider } from "@/components/ConfirmDialog";

// --- Global Setup for Reactive LocalStorage ---
const originalSetItem = localStorage.setItem;
localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, [key, value]);
    window.dispatchEvent(new CustomEvent('local-storage', { detail: { key } }));
};
// ----------------------------------------------

// --- Global Error Handlers (catches errors outside React) ---
window.onerror = (_msg, _source, _line, _col, error) => {
    console.error('[GlobalErrorHandler]', error);
};

window.addEventListener('unhandledrejection', (event) => {
    console.error('[UnhandledPromise]', event.reason);
});
// -----------------------------------------------------------

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <ConfirmProvider>
            <App />
        </ConfirmProvider>
    </ErrorBoundary>
);
