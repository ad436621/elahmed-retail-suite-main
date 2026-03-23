// ============================================================
// Warehouses — Data Layer
// ============================================================

export interface Warehouse {
    id: string;
    name: string;
    location?: string;
    isDefault: boolean;
    notes?: string;
}

export async function getWarehouses(): Promise<Warehouse[]> {
    if (typeof window !== 'undefined' && window.electron) {
        return window.electron.ipcRenderer.invoke('db:warehouses:get');
    }
    // Fallback for non-electron env (e.g. web browser preview)
    return [];
}

export async function addWarehouse(item: Omit<Warehouse, 'id'>): Promise<Warehouse> {
    if (typeof window !== 'undefined' && window.electron) {
        return window.electron.ipcRenderer.invoke('db:warehouses:add', item);
    }
    throw new Error("Electron IPC not available");
}

export async function updateWarehouse(id: string, updates: Partial<Warehouse>): Promise<Warehouse> {
    if (typeof window !== 'undefined' && window.electron) {
        return window.electron.ipcRenderer.invoke('db:warehouses:update', id, updates);
    }
    throw new Error("Electron IPC not available");
}

export async function deleteWarehouse(id: string): Promise<boolean> {
    if (typeof window !== 'undefined' && window.electron) {
        return window.electron.ipcRenderer.invoke('db:warehouses:delete', id);
    }
    throw new Error("Electron IPC not available");
}
