// ============================================================
// Used Migration — دمج الأجهزة المستعملة في القوائم الرئيسية
// ============================================================

import { getUsedDevices } from '@/data/usedDevicesData';
import { getMobiles, saveMobiles } from '@/data/mobilesData';
import { getComputers, saveComputers } from '@/data/computersData';
import { getDevices, saveDevices } from '@/data/devicesData';
import { getBatches, saveBatches } from '@/data/batchesData';
import { getCategoriesBySection, addCategory } from '@/data/categoriesData';
import { MobileItem, ComputerItem, DeviceItem } from '@/domain/types';

export function migrateUsedMerge() {
    const MIGRATION_KEY = 'gx_used_merge_migrated_v1';

    try {
        const alreadyMigrated = localStorage.getItem(MIGRATION_KEY);
        const used = getUsedDevices();

        // Even if we already marked it, if there are some somehow, clean them.
        if (alreadyMigrated && used.length === 0) return;
        if (used.length === 0) {
            localStorage.setItem(MIGRATION_KEY, 'true');
            return;
        }

        const mobiles = getMobiles();
        const computers = getComputers();
        const devices = getDevices();
        const batches = getBatches();

        const mCats = getCategoriesBySection('mobile');
        const cCats = getCategoriesBySection('computer');
        const dCats = getCategoriesBySection('device');

        const getFallbackCat = (section: 'mobile' | 'computer' | 'device', type: 'device', cats: any[], name: string) => {
            const ext = cats.find(c => c.name === name);
            if (ext) return ext.id;
            const newCat = addCategory({ name, section, type });
            cats.push(newCat);
            return newCat.id;
        };

        for (const u of used) {
            // Determine map type
            if (u.deviceType === 'mobile' || u.deviceType === 'tablet') {
                const catId = getFallbackCat('mobile', 'device', mCats, 'أجهزة مستعملة (مرحلة)');
                const mobileMap: MobileItem = {
                    id: u.id,
                    name: u.name,
                    deviceType: u.deviceType as any,
                    condition: 'used',
                    category: catId,
                    quantity: 1, // used device quantity in old system usually implicitly meant 1, or it could be derived
                    storage: u.storage || '',
                    ram: u.ram || '',
                    color: u.color || '',
                    supplier: '',
                    oldCostPrice: u.purchasePrice,
                    newCostPrice: u.purchasePrice,
                    salePrice: u.salePrice,
                    serialNumber: u.serialNumber || '',
                    notes: (u as any).notes || '',
                    description: u.description || '',
                    image: u.image,
                    createdAt: u.createdAt,
                    updatedAt: u.updatedAt
                };
                mobiles.push(mobileMap);

                // Update batches
                for (const b of batches) {
                    if (b.productId === u.id && b.inventoryType === 'used_device') {
                        b.inventoryType = 'mobile';
                    }
                }
            } else if (u.deviceType === 'computer' || u.deviceType === 'laptop') {
                const catId = getFallbackCat('computer', 'device', cCats, 'كمبيوتر مستعمل (مرحلة)');
                const compMap: ComputerItem = {
                    id: u.id,
                    name: u.name,
                    model: u.model || '',
                    deviceType: u.deviceType as any,
                    condition: 'used',
                    category: catId,
                    quantity: 1,
                    processor: u.ram || '', // approximate
                    color: u.color || '',
                    oldCostPrice: u.purchasePrice,
                    newCostPrice: u.purchasePrice,
                    salePrice: u.salePrice,
                    notes: (u as any).notes || '',
                    description: u.description || '',
                    image: u.image,
                    createdAt: u.createdAt,
                    updatedAt: u.updatedAt
                };
                computers.push(compMap);

                for (const b of batches) {
                    if (b.productId === u.id && b.inventoryType === 'used_device') {
                        b.inventoryType = 'computer';
                    }
                }
            } else {
                // other => DeviceItem
                const catId = getFallbackCat('device', 'device', dCats, 'أجهزة عامة مستعملة');
                const devMap: DeviceItem = {
                    id: u.id,
                    name: u.name,
                    model: u.model || '',
                    condition: 'used',
                    category: catId,
                    quantity: 1,
                    color: u.color || '',
                    oldCostPrice: u.purchasePrice,
                    newCostPrice: u.purchasePrice,
                    salePrice: u.salePrice,
                    notes: (u as any).notes || '',
                    description: u.description || '',
                    image: u.image,
                    createdAt: u.createdAt,
                    updatedAt: u.updatedAt
                };
                devices.push(devMap);

                for (const b of batches) {
                    if (b.productId === u.id && b.inventoryType === 'used_device') {
                        b.inventoryType = 'device';
                    }
                }
            }
        }

        saveMobiles(mobiles);
        saveComputers(computers);
        saveDevices(devices);
        saveBatches(batches);

        // Remove old used devices storage to clean up
        localStorage.removeItem('gx_used_devices');
        localStorage.setItem(MIGRATION_KEY, 'true');
        console.log('[Used Merge Migration] Successfully merged legacy used devices.');

    } catch (err) {
        console.error('[Used Merge Migration] Failed to merge items:', err);
    }
}
