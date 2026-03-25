const fs = require('fs');

function replaceBlock(file, searchStr, replaceStr) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let contentLF = content.replace(/\r\n/g, '\n');
    let searchLF = searchStr.replace(/\r\n/g, '\n');
    let replaceLF = replaceStr.replace(/\r\n/g, '\n');
    
    if (contentLF.includes(searchLF)) {
      let replaced = contentLF.replace(searchLF, replaceLF);
      fs.writeFileSync(file, replaced.replace(/\n/g, require('os').EOL));
      console.log('Success:', file);
    } else {
      console.log('Not found in:', file);
    }
  } catch (err) {
    console.error('Error with', file, err.message);
  }
}

// 1. SharedInventoryPage.tsx
replaceBlock('src/components/SharedInventoryPage.tsx', 
\                            {/* Â«„‘ «·—»Õ «·„Õ”Ê» */}
                            {f.newCostPrice > 0 && f.salePrice > 0 && (
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-4 py-2.5 flex items-center justify-between">
                                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">?? Â«„‘ «·—»Õ</span>
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                        {(f.salePrice - f.newCostPrice).toLocaleString('ar-EG')} Ã.„
                                        <span className="text-[10px] font-semibold text-emerald-500/80 mr-1">
                                            ({((f.salePrice - f.newCostPrice) / f.newCostPrice * 100).toFixed(1)}%)
                                        </span>
                                    </span>
                                </div>
                            )}\,
\                            {/* Â«„‘ «·—»Õ «·„Õ”Ê» */}
                            {(() => {
                                const cost = f.condition === 'used' || f.condition === 'broken' ? f.oldCostPrice || 0 : f.newCostPrice || 0;
                                const profit = f.salePrice - cost;
                                const margin = f.salePrice > 0 ? (profit / f.salePrice) * 100 : 0;
                                return f.salePrice > 0 ? (
                                    <div className="col-span-full p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <span className="block text-sm font-bold text-muted-foreground">Â«„‘ «·—»Õ</span>
                                            {margin < 10 && (
                                                <span className="block text-xs font-semibold text-red-500 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</span>
                                            )}
                                        </div>
                                        <span className={\	ext-xl font-black tabular-nums \\}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>
                                ) : null;
                            })()}\
);

// 2. DevicesInventory.tsx
replaceBlock('src/pages/DevicesInventory.tsx',
\                        {/* Profit margin indicator */}
                        <div className="col-span-2 p-3 rounded-lg bg-muted/50">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Â«„‘ «·—»Õ</span>
                                <span className={\ont-bold \\}>
                                    {profitMargin.toFixed(1)}%
                                </span>
                            </div>
                            {profitMargin < 10 && (
                                <p className="text-xs text-amber-600 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</p>
                            )}
                        </div>\,
\                        {/* Profit margin indicator */}
                        <div className="col-span-2 p-3 rounded-lg bg-muted/50 flex justify-between items-center mt-2">
                            <div className="text-right">
                                <span className="block text-sm font-bold text-muted-foreground">Â«„‘ «·—»Õ</span>
                                {profitMargin < 10 && (
                                    <span className="block text-xs font-semibold text-red-500 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</span>
                                )}
                            </div>
                            <span className={\	ext-xl font-black tabular-nums \\}>
                                {profitMargin.toFixed(1)}%
                            </span>
                        </div>\
);

// 3. MobilesInventory.tsx
replaceBlock('src/pages/MobilesInventory.tsx',
\                                    <div className="col-span-full p-3 rounded-lg bg-muted/50 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Â«„‘ «·—»Õ</span>
                                            <span className={\ont-bold \\}>
                                                {margin.toFixed(1)}%
                                            </span>
                                        </div>
                                        {margin < 10 && (
                                            <p className="text-xs text-amber-600 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</p>
                                        )}
                                    </div>\,
\                                    <div className="col-span-full p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <span className="block text-sm font-bold text-muted-foreground">Â«„‘ «·—»Õ</span>
                                            {margin < 10 && (
                                                <span className="block text-xs font-semibold text-red-500 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</span>
                                            )}
                                        </div>
                                        <span className={\	ext-xl font-black tabular-nums \\}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>\
);

// 4. MobileSubInventoryPage.tsx
replaceBlock('src/components/MobileSubInventoryPage.tsx',
\                                    <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Â«„‘ «·—»Õ</span>
                                            <span className={\ont-bold \\}>
                                                {margin.toFixed(1)}%
                                            </span>
                                        </div>
                                        {margin < 10 && (
                                            <p className="text-xs text-amber-600 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</p>
                                        )}
                                    </div>\,
\                                    <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <span className="block text-sm font-bold text-muted-foreground">Â«„‘ «·—»Õ</span>
                                            {margin < 10 && (
                                                <span className="block text-xs font-semibold text-red-500 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</span>
                                            )}
                                        </div>
                                        <span className={\	ext-xl font-black tabular-nums \\}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>\
);

// 5. SubSectionPage.tsx
replaceBlock('src/components/SubSectionPage.tsx',
\                                    <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Â«„‘ «·—»Õ</span>
                                            <span className={\ont-bold \\}>
                                                {margin.toFixed(1)}%
                                            </span>
                                        </div>
                                        {margin < 10 && (
                                            <p className="text-xs text-amber-600 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</p>
                                        )}
                                    </div>\,
\                                    <div className="col-span-2 p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <span className="block text-sm font-bold text-muted-foreground">Â«„‘ «·—»Õ</span>
                                            {margin < 10 && (
                                                <span className="block text-xs font-semibold text-red-500 mt-1"> Õ–Ì—: «·Â«„‘ √ﬁ· „‰ 10%</span>
                                            )}
                                        </div>
                                        <span className={\	ext-xl font-black tabular-nums \\}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>\
);
