import { RotateCcw } from 'lucide-react';

export interface FilterBarOption {
  label: string;
  value: string;
}

export interface FilterBarField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'number';
  value: string;
  placeholder?: string;
  options?: FilterBarOption[];
  onChange: (value: string) => void;
}

interface FilterBarProps {
  fields: FilterBarField[];
  onReset: () => void;
  activeCount?: number;
}

const inputClassName =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/30';

export function FilterBar({ fields, onReset, activeCount = 0 }: FilterBarProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-foreground">فلترة المنتجات</h2>
          <p className="text-xs text-muted-foreground">
            {activeCount > 0 ? `${activeCount} فلتر نشط` : 'بدون فلاتر نشطة'}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          إعادة التعيين
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <label key={field.id} className="space-y-1.5">
            <span className="block text-[11px] font-bold text-muted-foreground">
              {field.label}
            </span>

            {field.type === 'select' ? (
              <select
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                className={inputClassName}
              >
                {(field.options ?? []).map((option) => (
                  <option key={`${field.id}-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                placeholder={field.placeholder}
                className={inputClassName}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
