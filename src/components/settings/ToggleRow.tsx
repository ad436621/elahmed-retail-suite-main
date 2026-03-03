// ============================================================
// ELAHMED RETAIL OS — Settings Toggle Row
// Shared primitive extracted from SettingsPage.tsx
// ============================================================

interface ToggleRowProps {
    value: boolean;
    onChange: (v: boolean) => void;
    label: string;
    desc?: string;
}

/**
 * A styled toggle switch row with a label and optional description.
 * Used across all SettingsPage tabs for boolean settings.
 */
const ToggleRow = ({ value, onChange, label, desc }: ToggleRowProps) => (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div>
            <p className="text-sm font-bold text-foreground">{label}</p>
            {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        <button
            onClick={() => onChange(!value)}
            dir="ltr"
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${value ? 'bg-primary' : 'bg-muted/50'
                }`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? 'translate-x-5' : 'translate-x-0'
                    }`}
            />
        </button>
    </div>
);

export default ToggleRow;
