import { Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { getActiveSales } from '@/repositories/saleRepository';

const Sales = () => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const allSales = useMemo(() => getActiveSales(), []);

  const filtered = useMemo(
    () => allSales.filter(s =>
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.employee.toLowerCase().includes(search.toLowerCase())
    ),
    [allSales, search]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{t('sales.title')}</h1>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoices..."
          className="w-full rounded-lg border border-input bg-card ps-10 pe-4 py-2 text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.invoice')}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.date')}</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.items')}</th>
                <th className="px-4 py-3 text-end font-medium text-muted-foreground">{t('sales.amount')}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('sales.employee')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sale => (
                <tr key={sale.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{sale.invoiceNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{sale.date}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5">
                      {sale.items.map((item, i) => (
                        <p key={i} className="text-xs text-card-foreground">{item.qty}× {item.name}</p>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <p className="font-semibold text-card-foreground">{sale.total.toFixed(2)} EGP</p>
                    <p className="text-xs text-chart-3">+{sale.grossProfit.toFixed(2)} EGP</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',
                      sale.paymentMethod === 'cash' ? 'bg-chart-3/10 text-chart-3' :
                        sale.paymentMethod === 'card' ? 'bg-primary/10 text-primary' :
                          'bg-warning/10 text-warning'
                    )}>
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{sale.employee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Sales;
