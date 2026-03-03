// ============================================================
// Unit Tests — LocalStorage Helper
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { getStorageItem, setStorageItem, removeStorageItem } from '@/lib/localStorageHelper';

// jsdom provides localStorage in vitest test environment

beforeEach(() => {
    localStorage.clear();
});

describe('getStorageItem', () => {
    it('should return the fallback when key does not exist', () => {
        expect(getStorageItem('missing-key', [])).toEqual([]);
        expect(getStorageItem('missing-key', 'default')).toBe('default');
        expect(getStorageItem('missing-key', 0)).toBe(0);
    });

    it('should return a stored value', () => {
        localStorage.setItem('test-key', JSON.stringify({ name: 'Ahmed' }));
        expect(getStorageItem('test-key', {})).toEqual({ name: 'Ahmed' });
    });

    it('should return the fallback when stored value is corrupt JSON', () => {
        localStorage.setItem('corrupt-key', 'NOT_VALID_JSON{{{{');
        expect(getStorageItem('corrupt-key', [])).toEqual([]);
    });

    it('should return an array stored value', () => {
        const arr = [1, 2, 3];
        localStorage.setItem('arr-key', JSON.stringify(arr));
        expect(getStorageItem('arr-key', [])).toEqual(arr);
    });

    it('should return a number stored value', () => {
        localStorage.setItem('num-key', JSON.stringify(42));
        expect(getStorageItem('num-key', 0)).toBe(42);
    });

    it('should return a boolean stored value', () => {
        localStorage.setItem('bool-key', JSON.stringify(false));
        expect(getStorageItem('bool-key', true)).toBe(false);
    });

    it('should return null value correctly (not fallback)', () => {
        // null stored as JSON is valid
        localStorage.setItem('null-key', 'null');
        expect(getStorageItem<null | string>('null-key', 'fallback')).toBeNull();
    });
});

describe('setStorageItem', () => {
    it('should store a string value', () => {
        setStorageItem('name', 'Ahmed');
        expect(localStorage.getItem('name')).toBe('"Ahmed"');
    });

    it('should store an array', () => {
        setStorageItem('items', [1, 2, 3]);
        expect(JSON.parse(localStorage.getItem('items')!)).toEqual([1, 2, 3]);
    });

    it('should store an object', () => {
        const obj = { id: '1', name: 'Test' };
        setStorageItem('obj', obj);
        expect(JSON.parse(localStorage.getItem('obj')!)).toEqual(obj);
    });

    it('should overwrite existing value', () => {
        setStorageItem('key', 'first');
        setStorageItem('key', 'second');
        expect(getStorageItem('key', '')).toBe('second');
    });

    it('should store null correctly', () => {
        setStorageItem('nval', null);
        expect(getStorageItem<null | string>('nval', 'fallback')).toBeNull();
    });
});

describe('removeStorageItem', () => {
    it('should remove an existing key', () => {
        setStorageItem('remove-me', 'value');
        removeStorageItem('remove-me');
        expect(localStorage.getItem('remove-me')).toBeNull();
    });

    it('should not throw when removing a non-existent key', () => {
        expect(() => removeStorageItem('does-not-exist')).not.toThrow();
    });

    it('should cause getStorageItem to return fallback after removal', () => {
        setStorageItem('temp-key', 'hello');
        removeStorageItem('temp-key');
        expect(getStorageItem('temp-key', 'fallback')).toBe('fallback');
    });
});
