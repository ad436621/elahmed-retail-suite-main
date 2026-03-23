// ============================================================
// Repairs & Maintenance — Data Layer (SQLite via IPC)
// ============================================================

export interface RepairTicket {
    id: string;
    ticket_no: string;
    client_id?: string;
    customer_name: string;
    customer_phone: string;
    device_category: string;
    device_brand?: string;
    device_model?: string;
    imei_or_serial?: string;
    issue_description: string;
    accessories_received?: string;
    device_passcode?: string;
    status: 'received' | 'diagnosing' | 'waiting_parts' | 'repairing' | 'ready' | 'delivered' | 'cancelled' | 'pending' | 'in_progress' | 'waiting_for_parts' | 'completed';
    package_price?: number;
    warranty_days?: number;
    assigned_tech_name?: string;
    tech_bonus_type?: string;
    tech_bonus_value?: number;
    createdAt: string;
    createdBy?: string;
    updatedAt: string;
    updatedBy?: string;
    
    // Legacy support fields mapping (so we don't break UI immediately)
    ticket_type?: string;
    customer_id?: string;
    device_type?: string;
    model_number?: string;
    serial_number?: string;
    password?: string;
    accessories?: string;
    problem_desc?: string;
    expected_cost?: number;
    deposit_amount?: number;
    internal_notes?: string;
    receipt_notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface RepairEvent {
    id: string;
    ticket_id: string;
    event_type: string;
    from_status?: string;
    to_status?: string;
    note?: string;
    createdBy?: string;
    createdAt: string;
}

export interface RepairPart {
    id: string;
    name: string;
    category?: string;
    sku?: string;
    brand?: string;
    compatible_models?: string;
    unit_cost: number;
    selling_price: number;
    qty: number;
    min_qty: number;
    barcode?: string;
    color?: string;
    location?: string;
    notes?: string;
    active: boolean;
    createdAt: string;
    
    // Legacy mapping
    part_no?: string;
    current_stock?: number;
    min_stock?: number;
    cost_price?: number;
    created_at?: string;
}

export interface RepairTicketPart {
    id: string;
    ticket_id: string;
    part_id: string;
    qty: number;
    unit_cost: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    partName?: string;
    
    // Legacy mapping
    name?: string;
    quantity?: number;
    total_price?: number;
    unit_price?: number;
    cost_price?: number;
}

// ----------------------------------------------------
// IPC Wrapper (React side)
// ----------------------------------------------------
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';
import { MaintenanceOrder } from '@/domain/types';

function getIpc() {
  // @ts-ignore - ContextBridge from Electron
  return window.electron?.ipcRenderer;
}

/** 
 * Maps SQLite RepairTicket to legacy MaintenanceOrder format 
 * for compatibility with Dashboard/Reports 
 */
function mapToLegacy(t: RepairTicket, parts: RepairTicketPart[]): MaintenanceOrder {
    const totalCost = parts.reduce((s, p) => s + ((p.unit_cost || p.cost_price || 0) * (p.qty || p.quantity || 0)), 0);
    const totalSale = t.package_price || t.expected_cost || 0;
    
    return {
        id: t.id,
        orderNumber: t.ticket_no,
        customerName: t.customer_name,
        customerPhone: t.customer_phone || '',
        date: (t.createdAt || t.created_at || '').slice(0, 10),
        deviceName: t.device_model || t.device_type || t.device_category || 'Unknown',
        deviceCategory: (t.device_category || 'other') as MaintenanceOrder['deviceCategory'],
        issueDescription: t.issue_description || t.problem_desc || '',
        status: ['received', 'diagnosing', 'repairing', 'ready', 'in_progress', 'pending'].includes(t.status) ? 'in_progress' : 
                ['delivered', 'completed'].includes(t.status) ? 'done' : 'pending',
        spareParts: parts.map(p => ({
            name: p.partName || p.name || 'قطعة غيار',
            costPrice: p.unit_cost || p.cost_price || 0,
            salePrice: p.unit_cost || p.unit_price || 0
        })),
        description: t.issue_description || t.problem_desc || '',
        totalCost: totalCost,
        totalSale: totalSale,
        netProfit: totalSale - totalCost,
        createdAt: t.createdAt || t.created_at,
        updatedAt: t.updatedAt || t.updated_at
    };
}

// ----------------------------------------------------
// Legacy Sync Bridge
// ----------------------------------------------------
export async function syncRepairsToLegacy(): Promise<void> {
    const ipc = getIpc();
    if (!ipc) return;
    
    try {
        const tickets = await getRepairTickets();
        const legacyOrders: MaintenanceOrder[] = [];
        
        for (const t of tickets) {
            const parts = await getTicketParts(t.id);
            legacyOrders.push(mapToLegacy(t, parts));
        }
        
        setStorageItem(STORAGE_KEYS.MAINTENANCE, legacyOrders);
    } catch (e) {
        console.error("Sync to legacy failed", e);
    }
}

// -- TICKETS --
export async function getRepairTickets(filters?: { status?: string, customerId?: string, search?: string }): Promise<RepairTicket[]> {
    const ipc = getIpc();
    if (!ipc) return [] as RepairTicket[];
    const result = await ipc.invoke('db:repairs:getTickets', filters);
    return (result || []) as RepairTicket[];
}

export async function getRepairTicket(id: string): Promise<RepairTicket | null> {
    const ipc = getIpc();
    if (!ipc) return null;
    const result = await ipc.invoke('db:repairs:getTicket', id);
    return (result || null) as RepairTicket | null;
}

export async function addRepairTicket(ticket: Partial<RepairTicket>): Promise<RepairTicket> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:addTicket', ticket);
    await syncRepairsToLegacy();
    return result as RepairTicket;
}

export async function updateRepairTicket(id: string, updates: Partial<RepairTicket>): Promise<RepairTicket> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:updateTicket', id, updates);
    await syncRepairsToLegacy();
    return result as RepairTicket;
}

export async function deleteRepairTicket(id: string): Promise<boolean> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:deleteTicket', id);
    await syncRepairsToLegacy();
    return !!result;
}

// -- EVENTS --
export async function getRepairEvents(ticketId: string): Promise<RepairEvent[]> {
    const ipc = getIpc();
    if (!ipc) return [] as RepairEvent[];
    const result = await ipc.invoke('db:repairs:getEvents', ticketId);
    return (result || []) as RepairEvent[];
}

export async function logRepairEvent(event: Partial<RepairEvent>): Promise<RepairEvent> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:addEvent', event);
    return result as RepairEvent;
}

// -- PARTS --
export async function getRepairParts(): Promise<RepairPart[]> {
    const ipc = getIpc();
    if (!ipc) return [] as RepairPart[];
    const result = await ipc.invoke('db:repairs:getParts');
    return (result || []) as RepairPart[];
}

export async function getRepairPart(id: string): Promise<RepairPart | null> {
    const ipc = getIpc();
    if (!ipc) return null;
    const result = await ipc.invoke('db:repairs:getPart', id);
    return (result || null) as RepairPart | null;
}

export async function addRepairPart(part: Partial<RepairPart>): Promise<RepairPart> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:addPart', part);
    return result as RepairPart;
}

export async function updateRepairPart(id: string, updates: Partial<RepairPart>): Promise<RepairPart> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:updatePart', id, updates);
    return result as RepairPart;
}

// -- TICKET PARTS --
export async function getTicketParts(ticketId: string): Promise<RepairTicketPart[]> {
    const ipc = getIpc();
    if (!ipc) return [] as RepairTicketPart[];
    const result = await ipc.invoke('db:repairs:getTicketParts', ticketId);
    return (result || []) as RepairTicketPart[];
}

export async function addTicketPart(ticketPart: Partial<RepairTicketPart>): Promise<RepairTicketPart> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:addTicketPart', ticketPart);
    await syncRepairsToLegacy();
    return result as RepairTicketPart;
}

export async function removeTicketPart(id: string): Promise<boolean> {
    const ipc = getIpc();
    if (!ipc) throw new Error("IPC not found");
    const result = await ipc.invoke('db:repairs:removeTicketPart', id);
    await syncRepairsToLegacy();
    return !!result;
}
