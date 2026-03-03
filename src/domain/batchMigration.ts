// ============================================================
// Batch Migration — نقل البيانات القديمة لنظام الدفعات الجديد
// ============================================================

import { addBatch } from '@/data/batchesData';
import { getMobiles, getMobileAccessories } from '@/data/mobilesData';
import { getDevices, getDeviceAccessories } from '@/data/devicesData';
import { getComputers, getComputerAccessories } from '@/data/computersData';
import { getUsedDevices } from '@/data/usedDevicesData';
import { STORAGE_KEYS } from '@/config';

export function migrateLegacyDataToBatches() {
    const MIGRATION_KEY = STORAGE_KEYS.MIGRATION_BATCHES_DONE;

    try {
        const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
        if (alreadyMigrated) return;

        // 1. Mobiles
        const mobiles = getMobiles();
        for (const item of mobiles) {
            if (item.quantity > 0) {
                addBatch({
                    productId: item.id,
                    inventoryType: 'mobile',
                    productName: item.name,
                    costPrice: item.newCostPrice || item.oldCostPrice,
                    salePrice: item.salePrice,
                    quantity: item.quantity,
                    remainingQty: item.quantity,
                    purchaseDate: item.createdAt || new Date().toISOString(),
                    supplier: item.supplier || '',
                    notes: 'مُرحَّل من النظام القديم',
                });
            }
        }

        // 2. Mobile Accessories
        const mobAccs = getMobileAccessories();
        for (const item of mobAccs) {
            if (item.quantity > 0) {
                addBatch({
                    productId: item.id,
                    inventoryType: 'mobile_accessory',
                    productName: item.name,
                    costPrice: item.newCostPrice || item.oldCostPrice,
                    salePrice: item.salePrice,
                    quantity: item.quantity,
                    remainingQty: item.quantity,
                    purchaseDate: item.createdAt || new Date().toISOString(),
                    supplier: '',
                    notes: 'مُرحَّل من النظام القديم',
                });
            }
        }

        // 3. Devices
        const devices = getDevices();
        for (const item of devices) {
            if (item.quantity > 0) {
                addBatch({
                    productId: item.id,
                    inventoryType: 'device',
                    productName: item.name,
                    costPrice: item.newCostPrice || item.oldCostPrice,
                    salePrice: item.salePrice,
                    quantity: item.quantity,
                    remainingQty: item.quantity,
                    purchaseDate: item.createdAt || new Date().toISOString(),
                    supplier: '',
                    notes: 'مُرحَّل من النظام القديم',
                });
            }
        }

        // 4. Device Accessories
        const devAccs = getDeviceAccessories();
        for (const item of devAccs) {
            if (item.quantity > 0) {
                addBatch({
                    productId: item.id,
                    inventoryType: 'device_accessory',
                    productName: item.name,
                    costPrice: item.newCostPrice || item.oldCostPrice,
                    salePrice: item.salePrice,
                    quantity: item.quantity,
                    remainingQty: item.quantity,
                    purchaseDate: item.createdAt || new Date().toISOString(),
                    supplier: '',
                    notes: 'مُرحَّل من النظام القديم',
                });
            }
        }

        // 5. Computers
        const computers = getComputers();
        for (const item of computers) {
            if (item.quantity > 0) {
                addBatch({
                    productId: item.id,
                    inventoryType: 'computer',
                    productName: item.name,
                    costPrice: item.newCostPrice || item.oldCostPrice,
                    salePrice: item.salePrice,
                    quantity: item.quantity,
                    remainingQty: item.quantity,
                    purchaseDate: item.createdAt || new Date().toISOString(),
                    supplier: '',
                    notes: 'مُرحَّل من النظام القديم',
                });
            }
        }

        // 6. Computer Accessories
        const compAccs = getComputerAccessories();
        for (const item of compAccs) {
            if (item.quantity > 0) {
                addBatch({
                    productId: item.id,
                    inventoryType: 'computer_accessory',
                    productName: item.name,
                    costPrice: item.newCostPrice || item.oldCostPrice,
                    salePrice: item.salePrice,
                    quantity: item.quantity,
                    remainingQty: item.quantity,
                    purchaseDate: item.createdAt || new Date().toISOString(),
                    supplier: '',
                    notes: 'مُرحَّل من النظام القديم',
                });
            }
        }

        // 7. Used Devices
        const used = getUsedDevices();
        for (const item of used) {
            // Used devices usually have quantity 1 implicitly since they are serialized individual items, or just treat as 1
            addBatch({
                productId: item.id,
                inventoryType: 'used_device',
                productName: item.name,
                costPrice: item.purchasePrice,
                salePrice: item.salePrice,
                quantity: 1,
                remainingQty: 1,
                purchaseDate: item.createdAt || new Date().toISOString(),
                supplier: '',
                notes: `مُرحَّل - سيريال ${item.serialNumber}`,
            });
        }

        // Mark as migrated
        localStorage.setItem(MIGRATION_KEY, 'true');
        console.log('[Batch Migration] Successfully migrated legacy data to batches.');

    } catch (err) {
        console.error('[Batch Migration] Failed to migrate items:', err);
    }
}
