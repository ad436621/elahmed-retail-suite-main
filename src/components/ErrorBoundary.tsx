// ============================================================
// ErrorBoundary — catches React render errors + shows analysis
// ============================================================

import { Component, ErrorInfo, ReactNode, useState, useCallback } from 'react';
import { AlertOctagon, RefreshCw, ChevronDown, ChevronUp, Copy, Home } from 'lucide-react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { error: Error | null; errorInfo: ErrorInfo | null; showDetails: boolean; copied: boolean; }

function analyzeError(error: Error, errorInfo: ErrorInfo | null) {
    const msg = error.message?.toLowerCase() ?? '';
    const stack = errorInfo?.componentStack ?? '';

    if (msg.includes('cannot read properties of undefined') || msg.includes('cannot read property'))
        return {
            type: '🔴 خطأ في قراءة بيانات غير موجودة', likely: 'المكوّن حاول قراءة خاصية من متغير يساوي undefined أو null',
            suggestions: ['تأكد من أن البيانات من localStorage موجودة قبل استخدامها', 'استخدم optional chaining (?.) أو قيم افتراضية (??)', 'تحقق من تهيئة البيانات في الـ state']
        };
    if (msg.includes('is not a function'))
        return {
            type: '🔴 استدعاء دالة غير موجودة', likely: 'تم استدعاء دالة على متغير لا يحتوي عليها',
            suggestions: ['تأكد من استيراد الدوال بشكل صحيح', 'تحقق من أن القيمة ليست null قبل الاستدعاء']
        };
    if (msg.includes('maximum update depth exceeded'))
        return {
            type: '🔴 حلقة لا نهائية في التحديثات', likely: 'setState يُستدعى داخل useEffect بدون dependencies صحيحة',
            suggestions: ['راجع dependencies في useEffect', 'تأكد من أن الدوال لا تتغير في كل render']
        };
    if (msg.includes('failed to fetch') || msg.includes('network'))
        return {
            type: '🌐 خطأ في الشبكة', likely: 'فشل تحميل مورد خارجي',
            suggestions: ['تحقق من اتصال الإنترنت', 'تأكد من أن الـ API endpoint صحيح', 'أضف try/catch']
        };
    if (stack.includes('lazy') || msg.includes('loading chunk'))
        return {
            type: '📦 فشل تحميل وحدة', likely: 'الصفحة لم تُحمَّل بسبب مشكلة في الشبكة أو الـ build',
            suggestions: ['أعد تحديث الصفحة (Ctrl+Shift+R)', 'تأكد من أن الـ build حديث']
        };

    return {
        type: '⚠️ خطأ في React أثناء التصيير', likely: 'حدث خطأ غير متوقع أثناء تصيير المكوّن',
        suggestions: ['راجع الـ stacktrace لتحديد المكوّن المسبب', 'تأكد من صحة props المُمررة', 'افحص بيانات localStorage']
    };
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null, errorInfo: null, showDetails: false, copied: false };

    static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    handleReset = () => this.setState({ error: null, errorInfo: null, showDetails: false, copied: false });

    handleCopy = () => {
        const { error, errorInfo } = this.state;
        const text = `Error: ${error?.message}\n\nStack:\n${error?.stack}\n\nComponent:\n${errorInfo?.componentStack}`;
        navigator.clipboard.writeText(text).then(() => {
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        });
    };

    render() {
        const { error, errorInfo, showDetails, copied } = this.state;
        if (!error) return this.props.children;

        const analysis = analyzeError(error, errorInfo);

        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-background" dir="rtl" data-testid="error-boundary">
                <div className="w-full max-w-2xl">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 shrink-0">
                            <AlertOctagon className="h-7 w-7 text-destructive" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-foreground">حدث خطأ غير متوقع</h1>
                            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 mb-4">
                        <p className="font-extrabold text-foreground mb-1">{analysis.type}</p>
                        <p className="text-sm text-muted-foreground mb-3">{analysis.likely}</p>
                        <ul className="space-y-1.5">
                            {analysis.suggestions.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <span className="text-primary font-bold mt-0.5">•</span>{s}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <button onClick={this.handleReset}
                            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
                        </button>
                        <button onClick={() => { window.location.href = '/'; }}
                            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                            <Home className="h-4 w-4" /> الرئيسية
                        </button>
                        <button onClick={this.handleCopy}
                            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors mr-auto">
                            <Copy className="h-4 w-4" /> {copied ? 'تم النسخ ✓' : 'نسخ تفاصيل الخطأ'}
                        </button>
                    </div>

                    <div className="rounded-2xl border border-border overflow-hidden">
                        <button onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                            className="flex items-center justify-between w-full px-5 py-3 text-xs font-bold text-muted-foreground hover:bg-muted/40 transition-colors">
                            <span>تفاصيل تقنية (Stacktrace)</span>
                            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {showDetails && (
                            <div className="border-t border-border bg-muted/20 p-4 max-h-64 overflow-y-auto">
                                <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
                                    {error.stack}{'\n\n--- Component Stack ---\n'}{errorInfo?.componentStack}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

export function useErrorHandler() {
    const [, setError] = useState<Error | null>(null);
    return useCallback((error: Error) => { setError(() => { throw error; }); }, []);
}

export default ErrorBoundary;
