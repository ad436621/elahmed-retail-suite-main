import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface UserActivityContextProps {
  isIdle: boolean;
}

const UserActivityContext = createContext<UserActivityContextProps>({ isIdle: false });

export const useUserActivity = () => useContext(UserActivityContext);

// 15 minutes of inactivity
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export const UserActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleIdle = () => {
    if (user) {
      setIsIdle(true);
      logout();
    }
  };

  const resetTimer = () => {
    setIsIdle(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (user) {
      timeoutRef.current = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    resetTimer();

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <UserActivityContext.Provider value={{ isIdle }}>
      {children}
    </UserActivityContext.Provider>
  );
};
