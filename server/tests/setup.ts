// ============================================================
// Test Setup and Utilities
// ============================================================

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/elahmed_test';

// Global test timeout
jest.setTimeout(30000);

// Mock console.error to keep test output clean
const originalError = console.error;
beforeAll(() => {
    console.error = (...args: unknown[]) => {
        if (args[0]?.toString?.().includes('Warning')) {
            return; // Suppress React warnings in tests
        }
        originalError.call(console, ...args);
    };
});

afterAll(() => {
    console.error = originalError;
});

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});

// ============================================================
// Test Utilities
// ============================================================

/**
 * Generate a test JWT token
 */
export function generateTestToken(payload: {
    id: string;
    username: string;
    role: string;
    permissions?: string[];
}): string {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

/**
 * Create mock request with auth
 */
export function createMockRequest(overrides = {}) {
    return {
        headers: {
            authorization: '',
            'content-type': 'application/json',
        },
        query: {},
        params: {},
        body: {},
        user: undefined,
        ip: '127.0.0.1',
        ...overrides,
    };
}

/**
 * Create mock response
 */
export function createMockResponse() {
    const res: any = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);

    return res;
}

/**
 * Create mock next function
 */
export function createMockNext() {
    return jest.fn();
}

/**
 * Wait for a condition
 */
export async function waitFor(
    condition: () => boolean,
    timeout = 1000
): Promise<boolean> {
    const start = Date.now();

    while (condition()) {
        if (Date.now() - start > timeout) {
            return false;
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    return true;
}
