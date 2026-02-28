// ============================================================
// GX GLEAMEX — Users Data Layer
// All users stored in localStorage (localStorage key: gx_users)
// ============================================================

const STORAGE_KEY = 'gx_users';
const RECOVERY_CODE_KEY = 'gx_recovery_code';

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

export type UserRole = 'owner' | 'user';

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
};

export interface AppUser {
    id: string;
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    permissions: Permission[];
    active: boolean;
    createdAt: string;
}

const DEFAULT_OWNER: AppUser = {
    id: 'owner-1',
    username: 'admin',
    password: 'admin123',
    fullName: 'صاحب النظام',
    role: 'owner',
    permissions: [...ALL_PERMISSIONS],
    active: true,
    createdAt: new Date().toISOString(),
};

export function getUsers(): AppUser[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as AppUser[];
    } catch (_e) { /* ignore */ }
    // Seed default owner on first run
    const defaults = [DEFAULT_OWNER];
    saveUsers(defaults);
    return defaults;
}

export function saveUsers(users: AppUser[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
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

export function changePassword(username: string, newPassword: string): boolean {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return false;
    saveUsers(users.map(u => u.id === user.id ? { ...u, password: newPassword } : u));
    return true;
}

export function verifyRecoveryCode(code: string): boolean {
    return code.trim().toUpperCase() === MASTER_RECOVERY_CODE.toUpperCase();
}
