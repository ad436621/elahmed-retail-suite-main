import * as React from "react";

import { cn } from "@/lib/utils";

// ─── Navigation / editing keys always allowed ─────────────
const NAV_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
]);

/** Block non-numeric keystrokes on number inputs (layout-independent) */
const handleNumericKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (NAV_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
  if (e.key === '.' || e.key === '-') return;
  if (/^(Digit|Numpad)\d$/.test(e.code)) return;
  if (/^[0-9\u0660-\u0669]$/.test(e.key)) return;
  e.preventDefault();
};

/** Block digits on text-only fields */
const handleTextOnlyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (NAV_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
  if (/^[0-9\u0660-\u0669]$/.test(e.key)) { e.preventDefault(); return; }
  if (/^(Digit|Numpad)\d$/.test(e.code)) { e.preventDefault(); return; }
};

/** Allow only phone chars: digits, +, -, space */
const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (NAV_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
  if (/^[0-9\u0660-\u0669+\- ]$/.test(e.key)) return;
  if (/^(Digit|Numpad)\d$/.test(e.code)) return;
  e.preventDefault();
};

// ─── Input Component ──────────────────────────────────────
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, onFocus, ...props }, ref) => {
    const isNumber = type === "number";
    const validation = (props as any)['data-validation'] as string | undefined;

    // Pick the right validator based on type / data-validation
    const validator =
      isNumber ? handleNumericKeyDown
        : validation === 'text-only' ? handleTextOnlyKeyDown
          : validation === 'phone' ? handlePhoneKeyDown
            : null;

    const mergedKeyDown = validator
      ? (e: React.KeyboardEvent<HTMLInputElement>) => {
        validator(e);
        onKeyDown?.(e);
      }
      : onKeyDown;

    // Auto-select content on focus for number inputs so user can type immediately
    const mergedFocus = isNumber
      ? (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
        onFocus?.(e);
      }
      : onFocus;

    return (
      <input
        type={type}
        inputMode={isNumber ? "decimal" : validation === 'phone' ? "tel" : undefined}
        onKeyDown={mergedKeyDown}
        onFocus={mergedFocus}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

