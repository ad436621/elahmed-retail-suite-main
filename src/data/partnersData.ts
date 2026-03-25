import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

export interface Partner {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    partnershipType: 'investor' | 'supplier_partner' | 'franchise' | 'other';
    sharePercent?: number;
    profitShareDevices?: number;
    profitShareAccessories?: number;
    capitalAmount?: number;
    notes?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

const STORAGE_KEY = STORAGE_KEYS.PARTNERS;

function hasElectronIpc(): boolean {
    return typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
}

function loadLocalPartners(): Partner[] {
    return getStorageItem<Partner[]>(STORAGE_KEY, []);
}

function saveLocalPartners(partners: Partner[]): void {
    setStorageItem(STORAGE_KEY, partners);
}

export async function getPartners(): Promise<Partner[]> {
    if (hasElectronIpc()) {
        const data = await window.electron.ipcRenderer.invoke('db:partners:get');
        return Array.isArray(data) ? data as Partner[] : [];
    }

    return loadLocalPartners();
}

export async function addPartner(data: Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>): Promise<Partner> {
    if (hasElectronIpc()) {
        return window.electron.ipcRenderer.invoke('db:partners:add', data);
    }

    const now = new Date().toISOString();
    const partner: Partner = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
    };

    saveLocalPartners([...loadLocalPartners(), partner]);
    return partner;
}

export async function updatePartner(id: string, updates: Partial<Partner>): Promise<void> {
    if (hasElectronIpc()) {
        await window.electron.ipcRenderer.invoke('db:partners:update', id, updates);
        return;
    }

    saveLocalPartners(
        loadLocalPartners().map(partner =>
            partner.id === id
                ? { ...partner, ...updates, updatedAt: new Date().toISOString() }
                : partner
        )
    );
}

export async function deletePartner(id: string): Promise<void> {
    if (hasElectronIpc()) {
        await window.electron.ipcRenderer.invoke('db:partners:delete', id);
        return;
    }

    saveLocalPartners(loadLocalPartners().filter(partner => partner.id !== id));
}
