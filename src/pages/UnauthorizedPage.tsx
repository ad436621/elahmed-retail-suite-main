import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowRight } from 'lucide-react';

export default function UnauthorizedPage() {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fade-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
                <ShieldOff className="h-10 w-10 text-destructive" />
            </div>
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">غير مصرح</h1>
                <p className="text-muted-foreground">ليس لديك صلاحية لعرض هذه الصفحة</p>
                <p className="text-sm text-muted-foreground">تواصل مع صاحب النظام لطلب الصلاحيات المطلوبة</p>
            </div>
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
                <ArrowRight className="h-4 w-4" /> العودة للصفحة السابقة
            </button>
        </div>
    );
}
