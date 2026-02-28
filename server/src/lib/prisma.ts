// ============================================================
// ELAHMED RETAIL SUITE — Prisma Client
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;

export async function connectDB(): Promise<void> {
    try {
        await prisma.$connect();
        console.log('✅ Database connected');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

export async function disconnectDB(): Promise<void> {
    await prisma.$disconnect();
}
