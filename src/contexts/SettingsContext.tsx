import React, { createContext, useContext, useState, useEffect } from 'react';

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

const defaultSettings: Settings = {
    companyName: 'GLEAMEX',
    companySuffix: 'ش. ذ. م.م',
    branchName: 'Main Branch',
    branchAddress: 'Cairo, Egypt', // You can change this default
    shopPhone: '',
    printerName: '80mm Thermal Printer',
    logoUrl: '/logo.png',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>(() => {
        const saved = localStorage.getItem('app_settings');
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
        localStorage.setItem('app_settings', JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        const handleStorage = (e: StorageEvent | CustomEvent) => {
            const key = 'key' in e ? e.key : e.detail?.key;
            if (key === 'app_settings') {
                const saved = localStorage.getItem('app_settings');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setSettings(prev => ({ ...prev, ...parsed }));
                    } catch (err) { }
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
