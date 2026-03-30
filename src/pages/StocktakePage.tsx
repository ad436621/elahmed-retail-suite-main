import { useState, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';

// ======================================================
// GX GLEAMEX — Stocktake Page (الجرد الدوري)
// ======================================================

const STOCKTAKE_KEY = 'gx_stocktake_sessions';

interface StocktakeItem {
  productId: string;
  productName: string;
  expectedQty: number;
  actualQty: number;
  difference: number;
}

interface StocktakeSession {
  id: string;
  date: string;
  status: 'open' | 'completed';
  items: StocktakeItem[];
  notes: string;
  createdBy: string;
}

function getSessions(): StocktakeSession[] {
  try {
    return JSON.parse(localStorage.getItem(STOCKTAKE_KEY) || '[]');
  } catch { return []; }
}

function saveSessions(sessions: StocktakeSession[]): void {
  localStorage.setItem(STOCKTAKE_KEY, JSON.stringify(sessions));
}

export default function StocktakePage() {
  const [sessions, setSessions] = useState<StocktakeSession[]>([]);

  useEffect(() => {
    setSessions(getSessions());
  }, []);

  function startNewSession() {
    const newSession: StocktakeSession = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      status: 'open',
      items: [],
      notes: '',
      createdBy: 'current_user',
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    saveSessions(updated);
  }

  function closeSession(id: string) {
    const updated = sessions.map(s =>
      s.id === id ? { ...s, status: 'completed' as const } : s
    );
    setSessions(updated);
    saveSessions(updated);
  }

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">الجرد الدوري</h1>
        </div>
        <button
          onClick={startNewSession}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          + جلسة جرد جديدة
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد جلسات جرد</p>
          <p className="text-sm mt-1">اضغط "+ جلسة جرد جديدة" للبدء</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map(session => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-xl"
            >
              <div>
                <p className="font-medium text-card-foreground">
                  جرد {new Date(session.date).toLocaleDateString('ar-EG')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {session.items.length} منتج
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  session.status === 'open'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {session.status === 'open' ? 'مفتوح' : 'مكتمل'}
                </span>
                {session.status === 'open' && (
                  <button
                    onClick={() => closeSession(session.id)}
                    className="text-sm text-primary hover:underline"
                  >
                    إغلاق الجلسة
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
