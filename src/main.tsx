import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// --- Global Setup for Reactive LocalStorage ---
const originalSetItem = localStorage.setItem;
localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, [key, value]);
    window.dispatchEvent(new CustomEvent('local-storage', { detail: { key } }));
};
// ----------------------------------------------

createRoot(document.getElementById("root")!).render(<App />);
