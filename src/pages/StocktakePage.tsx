import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, PackageSearch, Plus, Search } from 'lucide-react';

import { STORAGE_KEYS } from '@/config';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { getAllInventoryProducts } from '@/repositories/productRepository';

type StocktakeStatus = 'draft' | 'completed';

interface StocktakeItem {
  productId: string;
  name: string;
  category: string;
  barcode: string;
  source?: string;
  expectedQty: number;
  countedQty: number;
  difference: number;
}

interface StocktakeSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: StocktakeStatus;
  createdBy: string;
  notes: string;
  items: StocktakeItem[];
}

const KEY = STORAGE_KEYS.STOCKTAKE;
const FIELD_CLASS = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

function sortSessions(sessions: StocktakeSession[]): StocktakeSession[] {
  return [...sessions].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function readSessions(): StocktakeSession[] {
  const sessions = getStorageItem<StocktakeSession[]>(KEY, []);
  return Array.isArray(sessions) ? sortSessions(sessions) : [];
}

function writeSessions(sessions: StocktakeSession[]): StocktakeSession[] {
  const sorted = sortSessions(sessions);
  setStorageItem(KEY, sorted);
  return sorted;
}

function buildSnapshot(): StocktakeItem[] {
  return getAllInventoryProducts()
    .map((product) => ({
      productId: product.id,
      name: product.name,
      category: product.category || 'عام',
      barcode: product.barcode || product.id,
      source: product.source,
      expectedQty: Number(product.quantity || 0),
      countedQty: Number(product.quantity || 0),
      difference: 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export default function StocktakePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [sessions, setSessions] = useState<StocktakeSession[]>(() => readSessions());
  const [selectedId, setSelectedId] = useState<string | null>(() => readSessions()[0]?.id ?? null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const refresh = (event?: Event) => {
      if (event?.type === 'local-storage') {
        const key = (event as CustomEvent<{ key?: string }>).detail?.key;
        if (key && key !== KEY) {
          return;
        }
      }

      const nextSessions = readSessions();
      setSessions(nextSessions);
      setSelectedId((current) => current && nextSessions.some((session) => session.id === current)
        ? current
        : nextSessions[0]?.id ?? null);
    };

    window.addEventListener('storage', refresh as EventListener);
    window.addEventListener('local-storage', refresh as EventListener);
    return () => {
      window.removeEventListener('storage', refresh as EventListener);
      window.removeEventListener('local-storage', refresh as EventListener);
    };
  }, []);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === selectedId) ?? null,
    [selectedId, sessions],
  );

  const filteredItems = useMemo(() => {
    if (!currentSession) {
      return [];
    }

    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return currentSession.items;
    }

    return currentSession.items.filter((item) => (
      item.name.toLowerCase().includes(normalizedSearch)
      || item.category.toLowerCase().includes(normalizedSearch)
      || item.barcode.toLowerCase().includes(normalizedSearch)
    ));
  }, [currentSession, search]);

  const summary = useMemo(() => {
    if (!currentSession) {
      return {
        totalItems: 0,
        changedItems: 0,
        shortageUnits: 0,
        overageUnits: 0,
      };
    }

    return currentSession.items.reduce((acc, item) => {
      if (item.difference !== 0) {
        acc.changedItems += 1;
      }
      if (item.difference < 0) {
        acc.shortageUnits += Math.abs(item.difference);
      }
      if (item.difference > 0) {
        acc.overageUnits += item.difference;
      }
      return acc;
    }, {
      totalItems: currentSession.items.length,
      changedItems: 0,
      shortageUnits: 0,
      overageUnits: 0,
    });
  }, [currentSession]);

  const persistSessions = (nextSessions: StocktakeSession[]) => {
    const saved = writeSessions(nextSessions);
    setSessions(saved);
    setSelectedId((current) => current && saved.some((session) => session.id === current)
      ? current
      : saved[0]?.id ?? null);
  };

  const updateSession = (sessionId: string, updater: (session: StocktakeSession) => StocktakeSession) => {
    persistSessions(sessions.map((session) => (
      session.id === sessionId
        ? updater({
          ...session,
          updatedAt: new Date().toISOString(),
        })
        : session
    )));
  };

  const createSession = () => {
    const snapshot = buildSnapshot();

    const createdAt = new Date().toISOString();
    const title = `جرد ${new Date(createdAt).toLocaleDateString('ar-EG')}`;
    const newSession: StocktakeSession = {
      id: crypto.randomUUID(),
      title,
      createdAt,
      updatedAt: createdAt,
      status: 'draft',
      createdBy: user?.fullName || user?.username || 'system',
      notes: '',
      items: snapshot,
    };

    const nextSessions = [newSession, ...sessions];
    persistSessions(nextSessions);
    setSelectedId(newSession.id);
    setSearch('');
    toast({
      title: 'تم إنشاء جلسة جرد',
      description: `${snapshot.length} صنف تم تضمينه في الـ snapshot`,
    });
  };

  const updateCountedQty = (sessionId: string, productId: string, countedQty: number) => {
    updateSession(sessionId, (session) => ({
      ...session,
      items: session.items.map((item) => (
        item.productId === productId
          ? {
            ...item,
            countedQty,
            difference: countedQty - item.expectedQty,
          }
          : item
      )),
    }));
  };

  const updateNotes = (sessionId: string, notes: string) => {
    updateSession(sessionId, (session) => ({
      ...session,
      notes,
    }));
  };

  const finalizeSession = async () => {
    if (!currentSession || currentSession.status === 'completed') {
      return;
    }

    const approved = await confirm({
      title: 'اعتماد الجرد',
      message: 'سيتم إغلاق الجلسة كجلسة مكتملة بدون تعديل المخزون تلقائيًا. يمكنك لاحقًا مراجعة الفروقات يدويًا.',
      confirmLabel: 'اعتماد الجلسة',
    });

    if (!approved) {
      return;
    }

    updateSession(currentSession.id, (session) => ({
      ...session,
      status: 'completed',
    }));

    toast({
      title: 'تم اعتماد الجلسة',
      description: 'الفروقات محفوظة للمراجعة ولم يتم تطبيق أي تعديل على المخزون.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12" dir="rtl" data-testid="stocktake-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">الجرد</h1>
            <p className="text-sm font-medium text-muted-foreground">
              جلسات محفوظة على {KEY} مع snapshot ثابت لكل جلسة
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={createSession}
          data-testid="stocktake-add"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <Plus className="h-5 w-5" />
          جلسة جرد جديدة
        </button>
      </div>

      <div className="rounded-2xl border border-amber-300/50 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            هذه الشاشة تحفظ الفروقات وتغلق الجلسة فقط. لا يتم تعديل كميات المخزون تلقائيًا إلا عبر مراجعة واعتماد يدوي لاحق.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-3">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="font-medium">لا توجد جلسات جرد بعد</p>
              <p className="mt-1 text-sm">ابدأ جلسة جديدة لالتقاط snapshot كامل للمخزون الحالي.</p>
            </div>
          ) : sessions.map((session) => {
            const changedItems = session.items.filter((item) => item.difference !== 0).length;
            const active = session.id === selectedId;

            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedId(session.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-right transition-all ${
                  active
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-foreground">{session.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(session.createdAt).toLocaleString('ar-EG')}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    session.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  }`}>
                    {session.status === 'completed' ? 'مكتمل' : 'مسودة'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-2 py-2">
                    <p className="font-black text-foreground">{session.items.length}</p>
                    <p className="text-muted-foreground">صنف</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-2 py-2">
                    <p className="font-black text-foreground">{changedItems}</p>
                    <p className="text-muted-foreground">فرق</p>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-2 py-2">
                    <p className="font-black text-foreground">{session.createdBy}</p>
                    <p className="text-muted-foreground">بواسطة</p>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section className="space-y-4">
          {!currentSession ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-muted-foreground">
              <PackageSearch className="mx-auto mb-3 h-12 w-12 opacity-30" />
              <p className="font-medium">اختر جلسة من القائمة أو أنشئ جلسة جديدة</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-border bg-card px-4 py-4">
                  <p className="text-xs font-medium text-muted-foreground">إجمالي الأصناف</p>
                  <p className="mt-2 text-2xl font-black text-foreground">{summary.totalItems}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card px-4 py-4">
                  <p className="text-xs font-medium text-muted-foreground">أصناف بها فروقات</p>
                  <p className="mt-2 text-2xl font-black text-foreground">{summary.changedItems}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card px-4 py-4">
                  <p className="text-xs font-medium text-muted-foreground">عجز وحدات</p>
                  <p className="mt-2 text-2xl font-black text-red-600">{summary.shortageUnits}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card px-4 py-4">
                  <p className="text-xs font-medium text-muted-foreground">زيادة وحدات</p>
                  <p className="mt-2 text-2xl font-black text-emerald-600">{summary.overageUnits}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-foreground">{currentSession.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      آخر تحديث: {new Date(currentSession.updatedAt).toLocaleString('ar-EG')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="relative min-w-[240px]">
                      <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="ابحث بالاسم أو الفئة أو الباركود"
                        className={`${FIELD_CLASS} pr-9`}
                        data-testid="stocktake-search"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={finalizeSession}
                      disabled={currentSession.status === 'completed'}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {currentSession.status === 'completed' ? 'الجلسة مكتملة' : 'اعتماد الجلسة'}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs font-semibold text-muted-foreground">ملاحظات الجلسة</label>
                  <textarea
                    value={currentSession.notes}
                    onChange={(event) => updateNotes(currentSession.id, event.target.value)}
                    disabled={currentSession.status === 'completed'}
                    className={`${FIELD_CLASS} min-h-[96px] resize-none`}
                    placeholder="اكتب أي ملاحظات عن الفروقات أو حالة العد..."
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الصنف</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الفئة</th>
                        <th className="px-4 py-3 text-right font-semibold text-muted-foreground">الباركود</th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">النظامي</th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">المعدود</th>
                        <th className="px-4 py-3 text-center font-semibold text-muted-foreground">الفرق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                            لا توجد نتائج مطابقة.
                          </td>
                        </tr>
                      ) : filteredItems.map((item) => (
                        <tr key={item.productId} className="border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-foreground">{item.name}</div>
                            {item.source && <div className="mt-1 text-[11px] text-muted-foreground">{item.source}</div>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.barcode}</td>
                          <td className="px-4 py-3 text-center font-bold text-foreground">{item.expectedQty}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              value={item.countedQty}
                              disabled={currentSession.status === 'completed'}
                              onChange={(event) => updateCountedQty(
                                currentSession.id,
                                item.productId,
                                Math.max(0, Number(event.target.value || 0)),
                              )}
                              className={`${FIELD_CLASS} w-24 text-center mx-auto block`}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${
                              item.difference === 0
                                ? 'bg-muted text-muted-foreground'
                                : item.difference > 0
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                            }`}>
                              {item.difference > 0 ? `+${item.difference}` : item.difference}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
