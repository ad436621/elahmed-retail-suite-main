import React, { createContext, useContext, useState, useEffect } from 'react';
import { STORAGE_KEYS, APP_CONFIG } from '@/config';

interface Settings {
    companyName: string;
    companySuffix: string; // ش. ذ. م.م
    branchName: string;
    branchAddress: string;
    shopPhone: string;
    printerName: string;
    logoUrl?: string;
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
}

const SETTINGS_KEY = STORAGE_KEYS.APP_SETTINGS;

const defaultSettings: Settings = {
    companyName: APP_CONFIG.DEFAULT_COMPANY_NAME,
    companySuffix: APP_CONFIG.DEFAULT_COMPANY_SUFFIX,
    branchName: APP_CONFIG.DEFAULT_BRANCH_NAME,
    branchAddress: APP_CONFIG.DEFAULT_BRANCH_ADDRESS,
    shopPhone: '',
    printerName: APP_CONFIG.DEFAULT_PRINTER_NAME,
    logoUrl: APP_CONFIG.DEFAULT_LOGO_URL,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>(() => {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to parse settings', e);
            }
        }
        return defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        const handleStorage = (e: StorageEvent | CustomEvent) => {
            const key = 'key' in e ? e.key : e.detail?.key;
            if (key === SETTINGS_KEY) {
                const saved = localStorage.getItem(SETTINGS_KEY);
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setSettings(prev => ({ ...prev, ...parsed }));
                    } catch (err) {
                        console.error('Failed to sync settings from storage', err);
                    }
                }
            }
        };
        window.addEventListener('storage', handleStorage as EventListener);
        window.addEventListener('local-storage', handleStorage as EventListener);
        return () => {
            window.removeEventListener('storage', handleStorage as EventListener);
            window.removeEventListener('local-storage', handleStorage as EventListener);
        };
    }, []);

    const updateSettings = (newSettings: Partial<Settings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

