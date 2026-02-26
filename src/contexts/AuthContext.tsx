import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  AppUser, Permission, getUsers, updateUser, changePassword, findUserByUsername,
  getUserById,
} from '@/data/usersData';

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

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => void;
  logout: () => void;
  hasPermission: (page: Permission) => boolean;
  isOwner: () => boolean;
  // User management (owner only)
  allUsers: AppUser[];
  refreshUsers: () => void;
  updateAppUser: (id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => void;
  resetUserPassword: (username: string, newPassword: string) => boolean;
}

const SESSION_KEY = 'gx_session';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as AuthUser;
      // Validate session against live user data
      const live = getUserById(parsed.id);
      if (!live || !live.active) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      // Return fresh data from storage (in case permissions changed)
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

  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [user]);

  useEffect(() => {
    const checkSession = () => {
      if (!user) return;
      const live = getUserById(user.id);
      if (!live || !live.active) {
        logout();
      } else {
        if (JSON.stringify(live.permissions) !== JSON.stringify(user.permissions) || live.role !== user.role) {
          setUser({ ...user, permissions: live.permissions, role: live.role, fullName: live.fullName });
        }
      }
    };

    const handleStorage = (e: StorageEvent | CustomEvent) => {
      const key = 'key' in e ? e.key : e.detail?.key;
      if (key === 'gx_users') {
        checkSession();
        setAllUsers(getUsers());
      }
    };

    window.addEventListener('storage', handleStorage as EventListener);
    window.addEventListener('local-storage', handleStorage as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage as EventListener);
      window.removeEventListener('local-storage', handleStorage as EventListener);
    };
  }, [user]);

  const login = (username: string, password: string) => {
    const found = findUserByUsername(username);
    if (!found || found.password !== password) {
      throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    if (!found.active) {
      throw new Error('هذا الحساب معطل. تواصل مع صاحب النظام');
    }

    const authUser: AuthUser = {
      id: found.id,
      username: found.username,
      role: found.role,
      fullName: found.fullName,
      permissions: found.permissions,
      lastLogin: new Date().toISOString(),
    };

    // Persist last login timestamp in storage
    updateUser(found.id, {});
    setUser(authUser);
  };

  const logout = () => setUser(null);

  const hasPermission = (page: Permission): boolean => {
    if (!user) return false;
    if (user.role === 'owner') return true; // owner has all permissions
    return user.permissions.includes(page);
  };

  const isOwner = () => user?.role === 'owner';

  const refreshUsers = () => setAllUsers(getUsers());

  const updateAppUser = (id: string, updates: Partial<Omit<AppUser, 'id' | 'createdAt'>>) => {
    updateUser(id, updates);
    refreshUsers();

    // If user updated their own info, refresh the session
    if (user && user.id === id) {
      const live = getUserById(id);
      if (live) {
        setUser(prev => prev ? {
          ...prev,
          fullName: live.fullName,
          permissions: live.permissions,
          role: live.role,
        } : null);
      }
    }
  };

  const resetUserPassword = (username: string, newPassword: string): boolean => {
    return changePassword(username, newPassword);
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, login, logout,
      hasPermission, isOwner,
      allUsers, refreshUsers, updateAppUser, resetUserPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
