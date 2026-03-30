import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  AppUser, Permission, getUsers, updateUser, changePassword, findUserByUsername,
  getUserById, isPasswordHashed, verifyPassword, migratePasswordToHash,
} from '@/data/usersData';
import { STORAGE_KEYS } from '@/config';

export type { AppUser, Permission };
export { ALL_PERMISSIONS, PERMISSION_LABELS } from '@/data/usersData';

// ---------- types ----------
export interface AuthUser {
  id: string;
  username: string;
  role: AppUser['role'];
  fullName: string;
  permissions: Permission[];
  lastLogin?: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
  requiresPasswordChange?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  hasPermission: (page: Permission) => boolean;
  isOwner: () => boolean;
  // User management (owner only)
  allUsers: AppUser[];
  refreshUsers: () => void;
  updateAppUser: (id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => void;
  resetUserPassword: (username: string, newPassword: string) => Promise<boolean>;
}

const SESSION_KEY = STORAGE_KEYS.AUTH_USER;
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // #22: 8 hours
const SESSION_TS_KEY = 'gx_session_ts';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getSessionStore(): Storage {
  return window.sessionStorage;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {

    // Fallback to sessionStorage so every new app launch requires login
    try {
      const store = getSessionStore();
      const stored = store.getItem(SESSION_KEY);
      if (!stored) return null;

      // #22 FIX: Check session timeout
      const sessionTs = store.getItem(SESSION_TS_KEY);
      if (sessionTs) {
        const elapsed = Date.now() - Number(sessionTs);
        if (elapsed > SESSION_TIMEOUT_MS) {
          store.removeItem(SESSION_KEY);
          store.removeItem(SESSION_TS_KEY);
          return null;
        }
      }

      const parsed = JSON.parse(stored) as AuthUser;
      const live = getUserById(parsed.id);
      if (!live || !live.active) {
        store.removeItem(SESSION_KEY);
        return null;
      }
      return {
        id: live.id,
        username: live.username,
        role: live.role,
        fullName: live.fullName,
        permissions: live.permissions,
        lastLogin: parsed.lastLogin,
      };
    } catch {
      getSessionStore().removeItem(SESSION_KEY);
      return null;
    }
  });

  const [allUsers, setAllUsers] = useState<AppUser[]>(() => getUsers());

  // Clear old persistent auth so it only uses sessionStorage
  useEffect(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TS_KEY);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  }, []);

  useEffect(() => {
    const store = getSessionStore();
    if (user) {
      store.setItem(SESSION_KEY, JSON.stringify(user));
      store.setItem(SESSION_TS_KEY, String(Date.now()));
    } else {
      store.removeItem(SESSION_KEY);
      store.removeItem(SESSION_TS_KEY);
    }
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    const found = findUserByUsername(username);
    if (!found || !found.active) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    // #01 FIX: PBKDF2 password verification with auto-migration
    let passwordValid = false;
    if (isPasswordHashed(found)) {
      // Already hashed — verify with PBKDF2
      passwordValid = await verifyPassword(password, found.salt!, found.password);
    } else {
      // Still plaintext — compare directly, then migrate
      passwordValid = found.password === password;
      if (passwordValid) {
        // Auto-migrate plaintext password to PBKDF2 hash
        await migratePasswordToHash(found.id, password);
      }
    }

    if (!passwordValid) {
      return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
    }

    if (found.mustChangePassword) {
      return {
        success: false,
        requiresPasswordChange: true,
        error: 'يجب تغيير كلمة المرور قبل الدخول لأول مرة',
      };
    }

    const authUser: AuthUser = {
      id: found.id,
      username: found.username,
      role: found.role,
      fullName: found.fullName,
      permissions: found.permissions,
      lastLogin: new Date().toISOString(),
    };
    setUser(authUser);

    // Refresh users list
    setAllUsers(getUsers());

    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const hasPermission = useCallback((page: Permission) => {
    if (!user) return false;
    if (user.role === 'owner') return true;
    return user.permissions.includes(page);
  }, [user]);

  const isOwner = useCallback(() => {
    return user?.role === 'owner';
  }, [user]);

  const refreshUsers = useCallback(() => {
    setAllUsers(getUsers());
  }, []);

  const updateAppUser = useCallback((id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => {
    updateUser(id, updates);
    refreshUsers();
  }, [refreshUsers]);

  const resetUserPassword = useCallback(async (username: string, newPassword: string) => {
    const changed = await changePassword(username, newPassword);
    if (!changed) {
      return false;
    }
    refreshUsers();
    return true;
  }, [refreshUsers]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        hasPermission,
        isOwner,
        allUsers,
        refreshUsers,
        updateAppUser,
        resetUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
