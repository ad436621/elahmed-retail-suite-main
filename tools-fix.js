const fs = require("fs");

function rep(file, regex, replacement) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    if (regex.test(text)) {
      fs.writeFileSync(file, text.replace(regex, replacement), 'utf8');
      console.log('Fixed', file);
    } else {
      console.log('Regex not matched in', file);
    }
  } catch (e) {
    console.log('Error opening', file, e.message);
  }
}

// 1. SharedInventoryPage.tsx
rep(
  'src/components/SharedInventoryPage.tsx',
  /\{\/\* هامش الربح المحسوب \*\/\}\s*\{f\.newCostPrice > 0 && f\.salePrice > 0 && \([\s\S]*?<\/\s*div>\s*\)\s*\}/,
  `{/* هامش الربح المحسوب */}
                            {f.newCostPrice > 0 && f.salePrice > 0 && (
                                <div className="col-span-full p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-muted-foreground">هامش الربح</p>
                                        {((f.salePrice - f.newCostPrice) / f.salePrice * 100) < 10 && (
                                            <p className="text-xs font-semibold text-red-500 mt-1">تحذير: الهامش أقل من 10%</p>
                                        )}
                                    </div>
                                    <span className={\`text-xl font-black tabular-nums \${((f.salePrice - f.newCostPrice) / f.salePrice * 100) >= 20 ? 'text-emerald-500 dark:text-emerald-400' : ((f.salePrice - f.newCostPrice) / f.salePrice * 100) >= 10 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}\`}>
                                        {((f.salePrice - f.newCostPrice) / f.salePrice * 100).toFixed(1)}%
                                    </span>
                                </div>
                            )}`
);

// 2. DevicesInventory.tsx
rep(
  'src/pages/DevicesInventory.tsx',
  /\{\/\* Profit margin indicator \*\/\}\s*<div className="col-span-2 p-3 rounded-lg bg-muted\/50(?:(?!\s*<\/div>\s*<\/div>).)*?\s*<\/div>\s*<\/div>/s,
  `{/* Profit margin indicator */}
                        <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                            <div className="text-right">
                                <p className="text-sm font-bold text-muted-foreground">هامش الربح</p>
                                {profitMargin < 10 && (
                                    <p className="text-xs font-semibold text-red-500 mt-1">تحذير: الهامش أقل من 10%</p>
                                )}
                            </div>
                            <span className={\`text-xl font-black tabular-nums \${profitMargin >= 20 ? 'text-emerald-500 dark:text-emerald-400' : profitMargin >= 10 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}\`}>
                                {profitMargin.toFixed(1)}%
                            </span>
                        </div>`
);

// 3. MobilesInventory.tsx
rep(
  'src/pages/MobilesInventory.tsx',
  /<\!--? هامش الربح المحسوب --?>\s*\{\(\(\) => \{[\s\S]*?return f\.salePrice > 0 \? \(\s*<div className="(?:col-span-full|col-span-2) p-3 rounded-lg bg-muted\/50.*?mt-2[^>]*>[\s\S]*?<\/\s*div>\s*\)\s*:\s*null;\s*\}\)\(\)\}/s,
  `{/* هامش الربح المحسوب */}
                            {(() => {
                                const cost = f.newCostPrice || 0;
                                const profit = f.salePrice - cost;
                                const margin = f.salePrice > 0 ? (profit / f.salePrice) * 100 : 0;
                                return f.salePrice > 0 ? (
                                    <div className="col-span-full p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-muted-foreground">هامش الربح</p>
                                            {margin < 10 && (
                                                <p className="text-xs font-semibold text-red-500 mt-1">تحذير: الهامش أقل من 10%</p>
                                            )}
                                        </div>
                                        <span className={\`text-xl font-black tabular-nums \${margin >= 20 ? 'text-emerald-500 dark:text-emerald-400' : margin >= 10 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}\`}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>
                                ) : null;
                            })()}`
);

// 4. MobileSubInventoryPage.tsx
rep(
  'src/components/MobileSubInventoryPage.tsx',
  /\{\/\* هامش الربح المحسوب \*\/\}\s*\{\(\(\) => \{[\s\S]*?return f\.salePrice > 0 \? \(\s*<div className="(?:col-span-full|col-span-2) p-3 rounded-lg bg-muted\/50.*?mt-2[^>]*>[\s\S]*?<\/\s*div>\s*\)\s*:\s*null;\s*\}\)\(\)\}/s,
  `{/* هامش الربح المحسوب */}
                            {(() => {
                                const cost = f.newCostPrice || 0;
                                const profit = f.salePrice - cost;
                                const margin = f.salePrice > 0 ? (profit / f.salePrice) * 100 : 0;
                                return f.salePrice > 0 ? (
                                    <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-muted-foreground">هامش الربح</p>
                                            {margin < 10 && (
                                                <p className="text-xs font-semibold text-red-500 mt-1">تحذير: الهامش أقل من 10%</p>
                                            )}
                                        </div>
                                        <span className={\`text-xl font-black tabular-nums \${margin >= 20 ? 'text-emerald-500 dark:text-emerald-400' : margin >= 10 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}\`}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>
                                ) : null;
                            })()}`
);

// 5. SubSectionPage.tsx
rep(
  'src/components/SubSectionPage.tsx',
  /\{\/\* هامش الربح المحسوب \*\/\}\s*\{\(\(\) => \{[\s\S]*?return form\.salePrice > 0 \? \(\s*<div className="(?:col-span-full|col-span-2) p-3 rounded-lg bg-muted\/50.*?mt-2[^>]*>[\s\S]*?<\/\s*div>\s*\)\s*:\s*null;\s*\}\)\(\)\}/s,
  `{(() => {
                                const cost = form.costPrice || 0;
                                const profit = form.salePrice - cost;
                                const margin = form.salePrice > 0 ? (profit / form.salePrice) * 100 : 0;
                                return form.salePrice > 0 ? (
                                    <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-muted-foreground">هامش الربح</p>
                                            {margin < 10 && (
                                                <p className="text-xs font-semibold text-red-500 mt-1">تحذير: الهامش أقل من 10%</p>
                                            )}
                                        </div>
                                        <span className={\`text-xl font-black tabular-nums \${margin >= 20 ? 'text-emerald-500 dark:text-emerald-400' : margin >= 10 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}\`}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>
                                ) : null;
                            })()}`
);

// SubSectionPage didn't have the comment string in my source up above it was line 533-550
rep(
  'src/components/SubSectionPage.tsx',
  /\{\(\(\) => \{\s*const cost = form\.costPrice \|\| 0;\s*const profit = form\.salePrice - cost;\s*const margin = form\.salePrice > 0 \? \(profit \/ form\.salePrice\) \* 100 : 0;\s*return form\.salePrice > 0 \? \(\s*<div className="col-span-2 p-3 rounded-lg bg-muted\/50 mt-2">[\s\S]*?<\/\s*div>\s*\)\s*:\s*null;\s*\}\)\(\)\}/,
  `{(() => {
                                const cost = form.costPrice || 0;
                                const profit = form.salePrice - cost;
                                const margin = form.salePrice > 0 ? (profit / form.salePrice) * 100 : 0;
                                return form.salePrice > 0 ? (
                                    <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-muted-foreground">هامش الربح</p>
                                            {margin < 10 && (
                                                <p className="text-xs font-semibold text-red-500 mt-1">تحذير: الهامش أقل من 10%</p>
                                            )}
                                        </div>
                                        <span className={\`text-xl font-black tabular-nums \${margin >= 20 ? 'text-emerald-500 dark:text-emerald-400' : margin >= 10 ? 'text-amber-500 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}\`}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>
                                ) : null;
                            })()}`
);
