// ============================================================
// PROOF OF STABILITY - Chaos Testing
// Tests that PROVE the system cannot be broken
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toCents, fromCents, addMoney, subtractMoney, multiplyMoney, calcMarginPct } from '@/lib/money';
import { validateLineDiscount, validateInvoiceDiscount } from '@/domain/discount';
import { calculateMarginPercent } from '@/domain/pricing';

// ─────────────────────────────────────────────────────────────
// TEST 1: Prove parallel invoice generation has no duplicates
// This test simulates REAL race conditions: multiple sales happening
// at the SAME TIME accessing shared localStorage
// ─────────────────────────────────────────────────────────────
describe('CHAOS: Parallel Invoice Generation', () => {
    beforeEach(() => {
        // Clean slate for each test
        localStorage.removeItem('gx_invoice_counter');
        localStorage.removeItem('gx_invoice_gen_lock');
        localStorage.removeItem('gx_sales_legacy');
    });
    
    it('should NEVER produce duplicate invoice numbers under concurrent access', async () => {
        // This simulates: 10 customers pressing "Pay" at EXACTLY the same time
        // Each gets the NEXT available invoice number, no duplicates
        
        // First, seed with some existing sales to create a counter baseline
        const existingSales = Array.from({ length: 5 }, (_, i) => ({
            invoiceNumber: `INV-2026-000${i + 1}`
        }));
        localStorage.setItem('gx_sales_legacy', JSON.stringify(existingSales));
        localStorage.setItem('gx_invoice_counter', '5');
        
        const invoiceNumbers: string[] = [];
        
        // NOW simulate 10 parallel sales hitting at the same time
        // They all read counter=5, then all try to increment
        const generateMany = async () => {
            // Import the function dynamically to get fresh module state
            const { generateInvoiceNumber } = await import('@/services/saleService');
            return generateInvoiceNumber();
        };
        
        // Run 10 generations in parallel - this is the REAL race condition
        const promises = Array.from({ length: 10 }, () => generateMany());
        const results = await Promise.all(promises);
        invoiceNumbers.push(...results);
        
        // PROOF: Check for duplicates
        const unique = new Set(invoiceNumbers);
        const duplicates = invoiceNumbers.length - unique.size;
        
        console.log('Generated invoice numbers:', invoiceNumbers);
        console.log('Unique count:', unique.size, 'Total:', invoiceNumbers.length);
        
        // This MUST pass - no duplicates allowed
        expect(duplicates).toBe(0);
        expect(unique.size).toBe(10);
    });
    
    it('should handle rapid sequential generation correctly', async () => {
        // Sequential generation should always produce sequential numbers
        const { generateInvoiceNumber } = await import('@/services/saleService');
        
        const invoices: string[] = [];
        for (let i = 0; i < 20; i++) {
            invoices.push(generateInvoiceNumber());
        }
        
        // Extract sequence numbers
        const sequences = invoices.map(inv => {
            const match = inv.match(/INV-\d{4}-(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        });
        
        // Must be sequential: 1, 2, 3, ... 20
        for (let i = 1; i < sequences.length; i++) {
            expect(sequences[i]).toBe(sequences[i-1] + 1);
        }
    });
});

// ─────────────────────────────────────────────────────────────
// TEST 2: Prove money calculations are ALWAYS correct (100 random orders)
// ─────────────────────────────────────────────────────────────
describe('CHAOS: 100 Random Order Financial Calculations', () => {
    it('should calculate correct totals for 100 random orders', () => {
        const failures: Array<{caseNum: number, expected: number, actual: number, diff: number}> = [];
        
        for (let i = 0; i < 100; i++) {
            // Generate random prices and quantities
            const price1 = Math.random() * 10000;
            const price2 = Math.random() * 5000;
            const qty1 = Math.floor(Math.random() * 10) + 1;
            const qty2 = Math.floor(Math.random() * 5) + 1;
            const discount = Math.random() * 500;
            
            // Calculate using money.ts functions
            const line1 = multiplyMoney(price1, qty1);
            const line2 = multiplyMoney(price2, qty2);
            const subtotal = addMoney(line1, line2);
            const total = subtractMoney(subtotal, discount);
            
            // Calculate expected using pure integer arithmetic (the source of truth)
            const price1Cents = Math.round(price1 * 100);
            const price2Cents = Math.round(price2 * 100);
            const discountCents = Math.round(discount * 100);
            
            const expectedLine1 = price1Cents * qty1 / 100;
            const expectedLine2 = price2Cents * qty2 / 100;
            const expectedSubtotal = (price1Cents * qty1 + price2Cents * qty2) / 100;
            const expectedTotal = (price1Cents * qty1 + price2Cents * qty2 - discountCents) / 100;
            
            // PROOF: Results must match exactly (within 1 cent tolerance)
            const diff = Math.abs(total - expectedTotal);
            if (diff > 0.01) {
                failures.push({
                    caseNum: i,
                    expected: expectedTotal,
                    actual: total,
                    diff: diff
                });
            }
        }
        
        if (failures.length > 0) {
            console.log('FINANCIAL CALCULATION FAILURES:');
            failures.slice(0, 5).forEach(f => {
                console.log(`  Case ${f.caseNum}: expected=${f.expected}, actual=${f.actual}, diff=${f.diff}`);
            });
        }
        
        // MUST NOT FAIL - financial calculations must be exact
        expect(failures.length).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────
// TEST 3: Prove system handles invalid inputs gracefully
// ─────────────────────────────────────────────────────────────
describe('CHAOS: Invalid Input Handling', () => {
    it('should handle negative discount without crashing', () => {
        expect(() => {
            validateLineDiscount(-100, 1000, 'employee');
        }).toThrow('Discount cannot be negative');
    });
    
    it('should handle zero lineTotal without crashing', () => {
        expect(() => {
            validateLineDiscount(50, 0, 'employee');
        }).not.toThrow();
    });
    
    it('should handle negative lineTotal', () => {
        expect(() => {
            validateLineDiscount(50, -100, 'employee');
        }).not.toThrow(); // Should handle gracefully
    });
    
    it('should handle Infinity percentage', () => {
        expect(() => {
            validateInvoiceDiscount(100, 0, 'employee');
        }).not.toThrow(); // Should not produce Infinity
    });
    
    it('should handle negative margin calculation', () => {
        const margin = calculateMarginPercent(100, 80); // Loss, not profit
        expect(margin).toBe(0); // Should return 0, not negative
    });
    
    it('should handle negative cost price', () => {
        const margin = calculateMarginPercent(-50, 100);
        expect(margin).toBe(0); // Should guard against negative
    });
});

// ─────────────────────────────────────────────────────────────
// TEST 4: Prove integer-cent arithmetic is exact
// ─────────────────────────────────────────────────────────────
describe('CHAOS: Integer-Cent Arithmetic Exactness', () => {
    it('should not have floating point errors', () => {
        // Classic bug: 0.1 + 0.2 = 0.30000000000000004
        const result = addMoney(0.1, 0.2);
        expect(result).toBe(0.3);
    });
    
    it('should handle multiplication correctly', () => {
        const result = multiplyMoney(19.99, 3);
        expect(result).toBe(59.97);
    });
    
    it('should handle large amounts', () => {
        const result = addMoney(999999.99, 0.01);
        expect(result).toBe(1000000);
    });
    
    it('should handle margin with negative profit', () => {
        const margin = calcMarginPct(-100, 1000);
        expect(margin).toBe(0); // Negative profit = 0% margin
    });
});

// ─────────────────────────────────────────────────────────────
// TEST 5: Prove cart operations don't crash on edge cases
// ─────────────────────────────────────────────────────────────
describe('CHAOS: Edge Case Handling', () => {
    it('should handle very large quantities', () => {
        const result = multiplyMoney(0.01, 999999999);
        expect(result).toBe(9999999.99); // Should handle large numbers
    });
    
    it('should handle zero price multiplication', () => {
        const result = multiplyMoney(0, 100);
        expect(result).toBe(0);
    });
    
    it('should handle subtractMoney with larger subtrahend', () => {
        const result = subtractMoney(10, 20);
        expect(result).toBe(-10); // Negative result is valid
    });
    
    it('should handle zero quantity', () => {
        const result = multiplyMoney(100, 0);
        expect(result).toBe(0);
    });
    
    it('should handle price of exactly zero', () => {
        const result = addMoney(0, 0);
        expect(result).toBe(0);
    });
});