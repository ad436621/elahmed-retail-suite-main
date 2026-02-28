// ============================================================
// Validation Schemas Tests
// ============================================================

import {
    loginSchema,
    createProductSchema,
    createSaleSchema,
    createCustomerSchema,
    voidSaleSchema
} from '../src/lib/validation';

describe('Auth Validation', () => {
    describe('loginSchema', () => {
        it('should validate correct login data', () => {
            const data = { username: 'admin', password: 'password123' };
            expect(() => loginSchema.parse(data)).not.toThrow();
        });

        it('should reject short username', () => {
            const data = { username: 'ab', password: 'password123' };
            expect(() => loginSchema.parse(data)).toThrow();
        });

        it('should reject short password', () => {
            const data = { username: 'admin', password: '123' };
            expect(() => loginSchema.parse(data)).toThrow();
        });
    });
});

describe('Product Validation', () => {
    describe('createProductSchema', () => {
        it('should validate correct product data', () => {
            const data = {
                name: 'iPhone 15',
                barcode: 'IPHONE-15-256',
                category: 'mobile',
                costPrice: 50000,
                sellingPrice: 55000,
                quantity: 10,
            };
            expect(() => createProductSchema.parse(data)).not.toThrow();
        });

        it('should reject negative price', () => {
            const data = {
                name: 'iPhone 15',
                barcode: 'IPHONE-15-256',
                category: 'mobile',
                costPrice: -50000,
                sellingPrice: 55000,
                quantity: 10,
            };
            expect(() => createProductSchema.parse(data)).toThrow();
        });

        it('should reject invalid barcode', () => {
            const data = {
                name: 'iPhone 15',
                barcode: 'ab', // Too short
                category: 'mobile',
                costPrice: 50000,
                sellingPrice: 55000,
                quantity: 10,
            };
            expect(() => createProductSchema.parse(data)).toThrow();
        });
    });
});

describe('Sale Validation', () => {
    describe('createSaleSchema', () => {
        it('should validate correct sale data', () => {
            const data = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', qty: 2 }
                ],
                paymentMethod: 'cash',
            };
            expect(() => createSaleSchema.parse(data)).not.toThrow();
        });

        it('should reject empty items', () => {
            const data = {
                items: [],
                paymentMethod: 'cash',
            };
            expect(() => createSaleSchema.parse(data)).toThrow();
        });

        it('should reject negative quantity', () => {
            const data = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', qty: -1 }
                ],
            };
            expect(() => createSaleSchema.parse(data)).toThrow();
        });

        it('should accept default payment method', () => {
            const data = {
                items: [
                    { productId: '123e4567-e89b-12d3-a456-426614174000', qty: 1 }
                ],
            };
            const result = createSaleSchema.parse(data);
            expect(result.paymentMethod).toBe('cash');
        });
    });

    describe('voidSaleSchema', () => {
        it('should validate reason length', () => {
            const data = { reason: 'Customer returned item - defective' };
            expect(() => voidSaleSchema.parse(data)).not.toThrow();
        });

        it('should reject short reason', () => {
            const data = { reason: 'Return' };
            expect(() => voidSaleSchema.parse(data)).toThrow();
        });
    });
});

describe('Customer Validation', () => {
    describe('createCustomerSchema', () => {
        it('should validate correct customer data', () => {
            const data = {
                name: 'Ahmed Mohamed',
                phone: '01234567890',
                email: 'ahmed@example.com',
            };
            expect(() => createCustomerSchema.parse(data)).not.toThrow();
        });

        it('should reject invalid phone number', () => {
            const data = {
                name: 'Ahmed',
                phone: '12345', // Invalid Egyptian phone
            };
            expect(() => createCustomerSchema.parse(data)).toThrow();
        });

        it('should reject invalid email', () => {
            const data = {
                name: 'Ahmed',
                email: 'not-an-email',
            };
            expect(() => createCustomerSchema.parse(data)).toThrow();
        });

        it('should accept optional fields', () => {
            const data = {
                name: 'Ahmed Mohamed',
                // All other fields optional
            };
            expect(() => createCustomerSchema.parse(data)).not.toThrow();
        });
    });
});
