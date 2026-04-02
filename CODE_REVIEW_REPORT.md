# Code Review Report — ElAhmed Retail Suite

**Date:** 2026-04-02  
**Reviewer:** Senior Code Reviewer (React/TypeScript/FinTech/Database)  
**Scope:** Full codebase analysis covering src/domain, src/data, src/services, electron/, and src/components

---

## 1. FinTech/Retail-Specific Review

### Status: ✅ Good with minor issues

#### Financial Calculations

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| Integer-cent arithmetic | `src/lib/money.ts` | 1-53 | ✅ Excellent - Prevents IEEE 754 float errors |
| Sale record calculation | `src/domain/sale.ts` | 30-153 | ✅ Good - Uses money.ts throughout |
| Margin calculation | `src/domain/pricing.ts` | 25-31 | ✅ Good - Guards against negative values |
| Discount validation | `src/domain/discount.ts` | 30-69 | ✅ Good - Role-based limits enforced |

**Findings:**

1. **src/lib/money.ts (Lines 50-52)** — `calcMarginPct` has a subtle issue:
   ```typescript
   if (profit < 0) return 0;
   ```
   This returns 0% margin for loss-making sales, which is correct for display but could mask issues in reporting. Consider if negative margins should be preserved for financial accuracy.

2. **src/domain/sale.ts (Lines 76-77)** — Averaged FIFO cost calculation:
   ```typescript
   fromCents(Math.round(toCents(fifoResult.totalCost) / c.qty))
   ```
   This division could produce fractional cents. Consider if this should use exact per-unit costs from batches instead of averaging.

3. **src/domain/discount.ts (Line 26)** — Fallback uses hardcoded index:
   ```typescript
   return found ?? DISCOUNT_RULES.find(r => r.role === 'employee') ?? DISCOUNT_RULES[4];
   ```
   Using array index `DISCOUNT_RULES[4]` is fragile. If the array order changes, this breaks.

#### Inventory & Stock Operations

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| Stock validation | `src/domain/stock.ts` | 16-25 | ✅ Good - Validates before deduction |
| FIFO batch logic | `src/domain/batchLogic.ts` | 29-84 | ✅ Good - Race condition guard added |
| Return fraud prevention | `src/domain/returns.ts` | 82-112 | ✅ Excellent - Double-return guard |

**Findings:**

1. **src/domain/batchLogic.ts (Lines 128-135)** — Race guard throws but doesn't differentiate between "concurrent modification" and "insufficient stock at start." Consider adding more specific error codes.

2. **src/domain/stock.ts (Line 83)** — Hardcoded low stock threshold:
   ```typescript
   return product.quantity <= 5;
   ```
   The threshold 5 should be configurable per product via `minStock` field.

---

## 2. Database Review

### Status: ⚠️ Needs Improvement

#### Schema Design & Normalization

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| SQLite schema | `electron/db.ts` | 94-920 | ✅ Good - Comprehensive with constraints |
| Indexes | `electron/db.ts` | 50-76 | ✅ Good - 20+ indexes defined |
| Foreign keys | `electron/db.ts` | 91 | ✅ Enabled |

**Findings:**

1. **electron/db.ts (Line 195)** — `stock_movements.quantityChange` uses REAL:
   ```sql
   quantityChange REAL NOT NULL
   ```
   Should be INTEGER for quantity to match the products table.

2. **electron/db.ts (Lines 173-187)** — `product_batches` lacks unique constraint on `(productId, remainingQty)` to prevent negative stock at database level.

3. **electron/ipcHandlers.ts (Line 2039-2043)** — Double update pattern:
   ```typescript
   updateStock.run(mov.quantityChange, mov.productId);
   try { updateUnifiedStock.run(...); } catch(e) { /* ignore */ }
   ```
   The fallback silently ignores errors. This could mask data integrity issues.

#### SQL Injection & Query Safety

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| Parameterized queries | `electron/ipcHandlers.ts` | Throughout | ✅ Good |
| Table name validation | `electron/db.ts` | 19-31 | ✅ Good - Whitelist approach |

**Critical Finding:**

1. **electron/ipcHandlers.ts (Line 134)** — Table name from `getBackupTableNames()` is used directly:
   ```typescript
   tables[table] = db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all()
   ```
   While `quoteIdentifier` is used, dynamic table names from backup files could still be risky if the backup format is compromised.

2. **electron/ipcHandlers.ts (Line 402)** — Settings key not validated:
   ```typescript
   db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, serialized);
   ```
   Any key can be inserted, potentially causing key collisions.

#### Concurrency Handling

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| WAL mode | `electron/db.ts` | 90 | ✅ Good |
| Transactions | `electron/ipcHandlers.ts` | 1293-1356 | ✅ Good - Uses db.transaction() |
| Checkout transaction | `electron/ipcHandlers.ts` | 2004-2092 | ✅ Good - Atomic with idempotency key |

**Finding:**

1. **electron/ipcHandlers.ts (Lines 2038-2061)** — Stock update uses atomic SQL but processes one-by-one in loop:
   ```typescript
   for (const mov of stockMovements) {
     updateStock.run(mov.quantityChange, mov.productId);
   }
   ```
   If one update fails mid-loop, data becomes inconsistent. Consider batch updates or individual transaction per movement with proper rollback.

---

## 3. UI/UX/Accessibility Review

### Status: ⚠️ Needs Improvement

#### React Component Architecture

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| Memoization | Various | Throughout | ✅ Good - Extensive use of useMemo/useCallback |
| Context pattern | `src/contexts/*.tsx` | Throughout | ✅ Good |
| Component composition | Various | Throughout | ✅ Good |

**Findings:**

1. **src/contexts/CartContext.tsx** — `getTotals` is wrapped in useCallback but recalculates on every cart change:
   ```typescript
   const getTotals = useCallback((): CartTotals => {
     return calcCartTotals(cart, invoiceDiscount);
   }, [cart, invoiceDiscount]);
   ```
   This is correct but could be memoized with useMemo instead.

2. **src/pages/POS.tsx (Lines 266-280)** — Heavy use of useMemo with identical patterns. Consider extracting category loading into a custom hook.

#### Accessibility (ARIA & Keyboard)

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| ARIA labels | `src/components/pos/*.tsx` | Various | ✅ Good |
| Keyboard navigation | `src/pages/POS.tsx` | 456-496 | ✅ Good - F-key shortcuts |
| Screen reader | Various | Throughout | ⚠️ Inconsistent |

**Critical Findings:**

1. **src/components/pos/OrderSummaryPanel.tsx** — Missing ARIA labels on quantity inputs and action buttons. Add `aria-label` to all icon-only buttons.

2. **src/pages/Installments.tsx** — Many interactive elements lack keyboard focus indicators and ARIA attributes.

3. **Missing focus management** — Modal dialogs don't always trap focus or return focus on close.

#### Performance Issues

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| Lazy loading | Various | Throughout | ⚠️ Missing - No React.lazy for routes |
| Large lists | Various | Throughout | ⚠️ Missing virtualization |

**Findings:**

1. **src/pages/Sales.tsx (Line 233)** — No pagination virtualization:
   ```typescript
   const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
   ```
   Using slice limits data but still loads all into memory. Consider react-window for large datasets.

2. **src/components/dashboard/DashboardWidgets.tsx** — Multiple synchronous calculations on mount could cause jank.

---

## 4. Code Quality Review

### Status: ⚠️ Needs Improvement

#### TypeScript Usage

| Area | File | Lines | Assessment |
|------|------|-------|-------------|
| Domain types | `src/domain/types.ts` | 1-678 | ✅ Good - Comprehensive types |
| Strict typing | Throughout | - | ❌ **163 violations of `any`** |

**Critical Finding:**

1. **electron/ipcHandlers.ts (163 occurrences)** — Extensive use of `any` type:
   ```typescript
   ipcMain.on('db-sync:products:add', (event, product: any) => {
   ```
   This defeats TypeScript's type safety. All IPC handlers should use proper interfaces from `src/domain/types.ts`.

2. **src/data/subInventoryData.ts (Line 129)** and similar — Using `any` for updates:
   ```typescript
   const payload: any = { ...updates, updatedAt: new Date().toISOString() };
   ```
   Should use proper type or generic.

#### Clean Code & Duplication

| Area | Assessment |
|------|------------|
| Domain logic | ✅ Well separated |
| Data access | ⚠️ Some duplication between localStorage and SQLite bridges |
| Error handling | ⚠️ Inconsistent |

**Findings:**

1. **src/data/inventoryTableBridge.ts** — Duplicates patterns from localStorage data files. Consider extracting common CRUD logic.

2. **Error handling inconsistency** — Some places use try/catch silently:
   ```typescript
   } catch { /* ignore */ }
   ```
   Others log to console without user feedback.

3. **Magic strings** — Many hardcoded strings like `'mobile'`, `'computer'` should be constants or enums.

---

## 5. Testing Gap Analysis

### Status: ⚠️ Needs Improvement

#### Existing Tests

| Test File | Coverage |
|-----------|----------|
| `src/test/domain/sale.test.ts` | ✅ Good - 15 test cases |
| `src/test/domain/discount.test.ts` | ✅ Good - 18 test cases |
| `src/test/domain/stock.test.ts` | ⚠️ Missing |
| `src/test/domain/returns.test.ts` | ⚠️ Missing |
| `src/test/repositories/stockRepository.test.ts` | ⚠️ Basic - 2 tests |

#### Missing Critical Test Scenarios

1. **src/domain/batchLogic.ts**
   - ❌ FIFO calculation with zero batches
   - ❌ FIFO calculation with partial batches
   - ❌ Race condition handling (bulkCommitFIFOSales)
   - ❌ Negative/zero quantity validation

2. **src/domain/stock.ts**
   - ❌ calculateNewQuantity with negative change
   - ❌ applyStockMovement immutability check
   - ❌ predictDepletionDays edge cases

3. **src/domain/returns.ts**
   - ❌ processReturn fraud guard
   - ❌ Already-returned quantity calculation
   - ❌ Partial return validation

4. **Financial Edge Cases**
   - ❌ Large quantity multiplication overflow
   - ❌ Maximum invoice discount (100%)
   - ❌ Currency rounding at boundaries

5. **Integration Tests**
   - ❌ Checkout flow (sale + stock + audit)
   - ❌ Return flow (return + stock restore + audit)
   - ❌ Concurrent sale attempts

---

## Summary of Findings

| Category | Status | Priority |
|----------|--------|----------|
| FinTech/Financial | ✅ Good | - |
| Database | ⚠️ Needs Improvement | Medium |
| UI/UX/Accessibility | ⚠️ Needs Improvement | Medium-High |
| Code Quality | ⚠️ Needs Improvement | High |
| Testing | ⚠️ Needs Improvement | High |

---

## Recommendations

### High Priority

1. **Add comprehensive type definitions to IPC handlers**
   - Replace all `any` types in `electron/ipcHandlers.ts` with interfaces from `src/domain/types.ts`
   
2. **Increase test coverage**
   - Add tests for batchLogic.ts, stock.ts, returns.ts
   - Add integration tests for checkout and return flows
   - Add edge case tests for financial calculations

3. **Add keyboard trap and focus management to modals**
   - Implement focus trap in dialog components
   - Ensure focus returns to trigger element on close

### Medium Priority

4. **Replace hardcoded values with configuration**
   - Low stock threshold in stock.ts
   - Discount limits fallback logic
   - Magic strings for product sources

5. **Add virtualization to large lists**
   - Implement react-window for Sales, Returns, and inventory lists

6. **Fix database constraints**
   - Change quantityChange to INTEGER
   - Add batch stock constraint

### Low Priority

7. **Improve error handling user feedback**
   - Replace silent catch blocks with toast/notification
   - Add consistent error boundaries

8. **Add route-based code splitting**
   - Use React.lazy for route components
   - Implement loading states

---

*End of Report*
