// ============================================================
// ConfirmDialog — reusable delete / destructive action modal
// ============================================================

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ────────────────────────────────────────────────

const ConfirmContext = createContext<ConfirmContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<{
        open: boolean;
        options: ConfirmOptions;
        resolve: (value: boolean) => void;
    } | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise<boolean>(resolve => {
            setState({ open: true, options, resolve });
        });
    }, []);

    const handleConfirm = () => {
        state?.resolve(true);
        setState(null);
    };

    const handleCancel = () => {
        state?.resolve(false);
        setState(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {state?.open && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
                    onClick={handleCancel}
                >
                    <div
                        className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start gap-3 px-6 pt-6 pb-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${state.options.danger !== false ? 'bg-destructive/10' : 'bg-amber-100'}`}>
                                <AlertTriangle className={`h-5 w-5 ${state.options.danger !== false ? 'text-destructive' : 'text-amber-600'}`} />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-base font-extrabold text-foreground">
                                    {state.options.title || 'تأكيد الإجراء'}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                    {state.options.message}
                                </p>
                            </div>
                            <button
                                onClick={handleCancel}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors shrink-0"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 px-6 pb-6">
                            <button
                                onClick={handleConfirm}
                                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${state.options.danger !== false
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : 'bg-amber-500 text-white hover:bg-amber-600'
                                    }`}
                            >
                                {state.options.confirmLabel || 'تأكيد'}
                            </button>
                            <button
                                onClick={handleCancel}
                                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                            >
                                {state.options.cancelLabel || 'إلغاء'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

// ─── Hook ────────────────────────────────────────────────────

export function useConfirm(): ConfirmContextType {
    const ctx = useContext(ConfirmContext);
    if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
    return ctx;
}
