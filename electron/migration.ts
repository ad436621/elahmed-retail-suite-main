import Database from 'better-sqlite3';

export function runDataMigration(db: ReturnType<typeof Database>) {
    console.log('Running data migration check...');
    try {
        // Migration 1: Partners
        const partnersCount = db.prepare('SELECT COUNT(*) as count FROM partners').get() as { count: number };
        if (partnersCount.count === 0) {
            const oldPartnersRow = db.prepare("SELECT value FROM settings WHERE key = 'gx_partners'").get() as { value: string };
            if (oldPartnersRow) {
                const partnersList = JSON.parse(oldPartnersRow.value) as any[];
                console.log(`Migrating ${partnersList.length} partners...`);
                const insertPartner = db.prepare(`
                    INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, capitalAmount, active, notes, createdAt, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                db.transaction(() => {
                    for (const p of partnersList) {
                        insertPartner.run(
                            p.id, 
                            p.name, 
                            p.phone || null, 
                            p.address || null, 
                            p.partnershipType || 'other',
                            p.sharePercent || 0,
                            p.capitalAmount || 0,
                            p.active ? 1 : 0,
                            p.notes || null,
                            p.createdAt || new Date().toISOString(),
                            p.updatedAt || new Date().toISOString()
                        );
                    }
                })();
                console.log('Partners migration complete.');
            }
        }

        // Migration 2: Accessories (Mobile, Computer, Device)
        const accessoriesCount = db.prepare('SELECT COUNT(*) as count FROM accessories').get() as { count: number };
        if (accessoriesCount.count === 0) {
            const keysToMigrate = [
                { key: 'gx_mobile_accessories', type: 'mobile_accessory' },
                { key: 'gx_mobile_spare_parts', type: 'mobile_spare_part' },
                { key: 'gx_computer_accessories_sa', type: 'computer_accessory' },
                { key: 'gx_computer_spare_parts', type: 'computer_spare_part' },
                { key: 'gx_device_accessories_sa', type: 'device_accessory' },
                { key: 'gx_device_spare_parts', type: 'device_spare_part' }
            ];

            const insertAccessory = db.prepare(`
                INSERT INTO accessories (id, inventoryType, name, category, subcategory, model, barcode, quantity, costPrice, salePrice, minStock, condition, supplier, color, notes, image, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            db.transaction(() => {
                for (const km of keysToMigrate) {
                    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(km.key) as { value: string };
                    if (row && row.value) {
                        const items = JSON.parse(row.value) as any[];
                        for (const item of items) {
                            insertAccessory.run(
                                item.id,
                                km.type,
                                item.name,
                                item.category || null,
                                item.subcategory || null,
                                item.model || null,
                                item.barcode || item.serialNumber || null,
                                item.quantity || 0,
                                item.costPrice || item.newCostPrice || 0,
                                item.salePrice || 0,
                                item.minStock || 0,
                                item.condition || 'new',
                                item.supplier || null,
                                item.color || null,
                                item.notes || item.description || null,
                                item.image || null,
                                item.createdAt || new Date().toISOString(),
                                item.updatedAt || new Date().toISOString()
                            );
                        }
                        console.log(`Migrated ${items.length} items from ${km.key}`);
                    }
                }
            })();
        }

        console.log('Data migration checks finished.');
    } catch (err) {
        console.error('Migration Error:', err);
    }
}
