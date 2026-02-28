// ============================================================
// ELAHMED RETAIL SUITE — Database Seed
// ============================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Create permissions
    const permissions = [
        'dashboard', 'pos', 'sales', 'inventory', 'mobiles', 'computers',
        'devices', 'used', 'cars', 'warehouse', 'maintenance', 'installments',
        'expenses', 'damaged', 'otherRevenue', 'returns', 'settings', 'users'
    ];

    for (const name of permissions) {
        await prisma.permission.upsert({
            where: { name },
            update: {},
            create: { name },
        });
    }

    // Create default owner
    const hashedPassword = await bcrypt.hash('admin123', 12);

    const owner = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: hashedPassword,
            fullName: 'صاحب النظام',
            role: 'owner',
            permissions,
        },
    });

    console.log('✅ Created owner:', owner.username);

    // Create categories
    const categories = [
        { name: 'موبايلات', nameAr: 'Mobiles', type: 'mobile' },
        { name: 'كمبيوتر', nameAr: 'Computers', type: 'computer' },
        { name: 'أجهزة', nameAr: 'Devices', type: 'device' },
        { name: 'إكسسوارات', nameAr: 'Accessories', type: 'accessory' },
        { name: 'مستعمل', nameAr: 'Used', type: 'used' },
        { name: 'سيارات', nameAr: 'Cars', type: 'car' },
    ];

    for (const cat of categories) {
        await prisma.category.upsert({
            where: { name: cat.name },
            update: {},
            create: cat,
        });
    }

    console.log('✅ Created categories');

    // Create sample products
    const products = [
        {
            name: 'iPhone 15 Pro',
            model: 'A3101',
            barcode: 'IP15PRO001',
            category: 'موبايلات',
            supplier: 'Apple',
            costPrice: 45000,
            sellingPrice: 52000,
            quantity: 10,
        },
        {
            name: 'Samsung Galaxy S24',
            model: 'SM-S928',
            barcode: 'SG24ULTRA',
            category: 'موبايلات',
            supplier: 'Samsung',
            costPrice: 38000,
            sellingPrice: 45000,
            quantity: 15,
        },
        {
            name: 'Dell XPS 15',
            model: 'XPS 15 9530',
            barcode: 'DELLXPS15',
            category: 'كمبيوتر',
            supplier: 'Dell',
            costPrice: 55000,
            sellingPrice: 65000,
            quantity: 5,
        },
    ];

    for (const p of products) {
        const product = await prisma.product.upsert({
            where: { barcode: p.barcode },
            update: {},
            create: p,
        });

        // Create initial batch
        await prisma.productBatch.upsert({
            where: { id: product.id },
            update: {},
            create: {
                productId: product.id,
                costPrice: p.costPrice,
                quantity: p.quantity,
                remainingQty: p.quantity,
            },
        });
    }

    console.log('✅ Created sample products');
    console.log('🎉 Seed completed!');
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
