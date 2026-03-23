// ============================================================
// GX GLEAMEX — Users Data Layer
// All users stored in localStorage (localStorage key: gx_users)
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

const STORAGE_KEY = STORAGE_KEYS.USERS;
const RECOVERY_CODE_KEY = STORAGE_KEYS.RECOVERY_CODE;

// ─── #01 FIX: PBKDF2 Password Hashing (Web Crypto API) ──────

/** Generate a random salt for password hashing */
export function generateSalt(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr));
}

/** Hash a password using PBKDF2 with 100k iterations */
export async function hashPassword(password: string, salt: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
        key, 256
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/** Verify a password against a stored hash */
export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
    const hash = await hashPassword(password, salt);
    return hash === storedHash;
}

/** Check if a password is already hashed (contains salt separator) */
export function isPasswordHashed(user: AppUser): boolean {
    return !!user.salt;
}

// Generate a secure recovery code and store in localStorage if not exists
function getOrCreateRecoveryCode(): string {
    try {
        const existing = localStorage.getItem(RECOVERY_CODE_KEY);
        if (existing && existing.length >= 8) return existing;

        // Generate a new secure code
        const newCode = 'GX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem(RECOVERY_CODE_KEY, newCode);
        return newCode;
    } catch (e) {
        console.error('Failed to manage recovery code:', e);
        return 'GX-RECOVERY';
    }
}

export const MASTER_RECOVERY_CODE = getOrCreateRecoveryCode();

export type UserRole = 'owner' | 'user' | 'super_admin' | 'admin' | 'employee';

export const ALL_PERMISSIONS = [
    'dashboard',
    'pos',
    'sales',
    'inventory',
    'mobiles',
    'computers',
    'devices',
    'used',
    'cars',
    'warehouse',
    'maintenance',
    'installments',
    'expenses',
    'damaged',
    'otherRevenue',
    'returns',
    'settings',
    'users',
    'customers',
    'wallets',
    'employees',
    'suppliers',
    'partners',
    'blacklist',
    'reminders',
    'shiftClosing',
    'purchaseInvoices',
    'stocktake',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
    dashboard: 'لوحة التحكم',
    pos: 'نقطة البيع',
    sales: 'المبيعات',
    inventory: 'المخزون العام',
    mobiles: 'الموبيلات وإكسسوارات',
    computers: 'الكمبيوتر وإكسسوارات',
    devices: 'الأجهزة وإكسسوارات',
    used: 'المستعمل',
    cars: 'السيارات',
    warehouse: 'المستودع',
    maintenance: 'الصيانة',
    installments: 'التقسيط',
    expenses: 'المصروفات',
    damaged: 'الهالك',
    otherRevenue: 'أرباح أخرى',
    returns: 'المرتجعات',
    settings: 'الإعدادات',
    users: 'إدارة المستخدمين',
    customers: 'إدارة العملاء',
    wallets: 'المحافظ والخزنة',
    employees: 'الموظفين والرواتب',
    suppliers: 'الموردون',
    partners: 'الشركاء',
    blacklist: 'القائمة السوداء',
    reminders: 'التذكيرات',
    shiftClosing: 'إقفال الوردية',
    purchaseInvoices: 'فواتير الشراء',
    stocktake: 'جرد المخزون',
};

export interface AppUser {
    id: string;
    username: string;
    password: string;
    salt?: string;              // #01: PBKDF2 salt
    fullName: string;
    role: UserRole;
    permissions: Permission[];
    active: boolean;
    createdAt: string;
    mustChangePassword?: boolean;  // #02: Force password change on first login
}

const DEFAULT_OWNER: AppUser = {
    id: 'owner-1',
    username: 'admin',
    password: 'admin123',       // Will be hashed on first login via migration
    fullName: 'صاحب النظام',
    role: 'owner',
    permissions: [...ALL_PERMISSIONS],
    active: true,
    createdAt: new Date().toISOString(),
    mustChangePassword: true,   // #02: Force password change
};

export function getUsers(): AppUser[] {
    const stored = getStorageItem<AppUser[] | null>(STORAGE_KEY, null);
    if (stored) return stored;
    // Seed default owner on first run
    const defaults = [DEFAULT_OWNER];
    saveUsers(defaults);
    return defaults;
}

export function saveUsers(users: AppUser[]): void {
    setStorageItem(STORAGE_KEY, users);
}

export function getUserById(id: string): AppUser | undefined {
    return getUsers().find(u => u.id === id);
}

export function findUserByUsername(username: string): AppUser | undefined {
    return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function addUser(data: Omit<AppUser, 'id' | 'createdAt'>): AppUser {
    const users = getUsers();
    const newUser: AppUser = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    };
    saveUsers([...users, newUser]);
    return newUser;
}

export function updateUser(id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>): void {
    const users = getUsers();
    saveUsers(users.map(u => u.id === id ? { ...u, ...updates } : u));
}

export function deleteUser(id: string): void {
    // Cannot delete the last owner
    const users = getUsers();
    const owners = users.filter(u => u.role === 'owner');
    const target = users.find(u => u.id === id);
    if (target?.role === 'owner' && owners.length <= 1) return;
    saveUsers(users.filter(u => u.id !== id));
}

/** Change password — hashes with PBKDF2 before saving */
export async function changePassword(username: string, newPassword: string): Promise<boolean> {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return false;
    const salt = generateSalt();
    const hashed = await hashPassword(newPassword, salt);
    saveUsers(users.map(u => u.id === user.id ? { ...u, password: hashed, salt, mustChangePassword: false } : u));
    return true;
}

/** Migrate a plaintext password to PBKDF2 hash (called on first login) */
export async function migratePasswordToHash(userId: string, plaintextPassword: string): Promise<void> {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user || user.salt) return; // Already hashed
    const salt = generateSalt();
    const hashed = await hashPassword(plaintextPassword, salt);
    saveUsers(users.map(u => u.id === userId ? { ...u, password: hashed, salt } : u));
}

export function verifyRecoveryCode(code: string): boolean {
    return code.trim().toUpperCase() === MASTER_RECOVERY_CODE.toUpperCase();
}
