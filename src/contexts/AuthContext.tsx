import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  AppUser, Permission, getUsers, updateUser, changePassword, findUserByUsername,
  getUserById, isPasswordHashed, verifyPassword, migratePasswordToHash,
} from '@/data/usersData';
import api from '@/lib/api';
import { STORAGE_KEYS } from '@/config';

export type { AppUser, Permission };
export { ALL_PERMISSIONS, PERMISSION_LABELS } from '@/data/usersData';

// Check if backend is available
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';

// ---------- types ----------
export interface AuthUser {
  id: string;
  username: string;
  role: AppUser['role'];
  fullName: string;
  permissions: Permission[];
  lastLogin?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (page: Permission) => boolean;
  isOwner: () => boolean;
  // User management (owner only)
  allUsers: AppUser[];
  refreshUsers: () => void;
  updateAppUser: (id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => void;
  resetUserPassword: (username: string, newPassword: string) => Promise<boolean>;
}

const SESSION_KEY = STORAGE_KEYS.SESSION;
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // #22: 8 hours
const SESSION_TS_KEY = 'gx_session_ts';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    // Try backend first if enabled
    if (USE_BACKEND) {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        // Will verify on mount
        return null;
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;

      // #22 FIX: Check session timeout
      const sessionTs = localStorage.getItem(SESSION_TS_KEY);
      if (sessionTs) {
        const elapsed = Date.now() - Number(sessionTs);
        if (elapsed > SESSION_TIMEOUT_MS) {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(SESSION_TS_KEY);
          return null;
        }
      }

      const parsed = JSON.parse(stored) as AuthUser;
      const live = getUserById(parsed.id);
      if (!live || !live.active) {
        localStorage.removeItem(SESSION_KEY);
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
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  });

  const [allUsers, setAllUsers] = useState<AppUser[]>(() => getUsers());

  // Verify token with backend on mount
  useEffect(() => {
    if (USE_BACKEND && !user) {
      const verifyBackendAuth = async () => {
        const result = await api.verifyToken();
        if (result.data) {
          setUser({
            id: result.data.id,
            username: result.data.username,
            role: result.data.role as AppUser['role'],
            fullName: result.data.fullName,
            permissions: result.data.permissions as Permission[],
          });
        }
      };
      verifyBackendAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      if (USE_BACKEND) {
        // Token is handled by api client
      } else {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        // #22: Update session timestamp
        localStorage.setItem(SESSION_TS_KEY, String(Date.now()));
      }
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_TS_KEY);
    }
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    if (USE_BACKEND) {
      const result = await api.login(username, password);
      if (result.error) {
        return { success: false, error: result.error };
      }
      if (result.data) {
        setUser({
          id: result.data.user.id,
          username: result.data.user.username,
          role: result.data.user.role as AppUser['role'],
          fullName: result.data.user.fullName,
          permissions: result.data.user.permissions as Permission[],
          lastLogin: new Date().toISOString(),
        });
        return { success: true };
      }
    }

    // Fallback to localStorage
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
    if (USE_BACKEND) {
      api.setToken(null);
    }
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
    if (USE_BACKEND) {
      return false;
    }
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
