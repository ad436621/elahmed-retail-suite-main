import React, { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
    companyName: string;
    branchName: string;
    branchAddress: string;
}

interface SettingsContextType {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
    companyName: 'GX GLEAMEX',
    branchName: 'Main Branch',
    branchAddress: 'Cairo, Egypt', // You can change this default
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
