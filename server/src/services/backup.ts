// ============================================================
// ELAHMED RETAIL SUITE — Backup & Disaster Recovery Service
// ============================================================

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import logger from '../lib/logger.js';

const execAsync = promisify(exec);

// Configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30');
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '5432';
const DB_NAME = process.env.DB_NAME || 'elahmed_retail';
const DB_USER = process.env.DB_USER || 'postgres';

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
    try {
        await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
    } catch (error) {
        logger.error('Error creating backup directory', { error });
        throw error;
    }
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `elahmed_backup_${timestamp}.sql`;
}

/**
 * Create a database backup using pg_dump
 */
export async function backupDatabase(): Promise<{
    success: boolean;
    filePath?: string;
    fileSize?: number;
    error?: string;
}> {
    try {
        await ensureBackupDir();

        const filename = generateBackupFilename();
        const filePath = path.join(BACKUP_DIR, filename);

        // Build pg_dump command
        const pgDumpCmd = `pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -F c -b -v -f "${filePath}" ${DB_NAME}`;

        // Set PGPASSWORD environment variable
        const env = {
            ...process.env,
            PGPASSWORD: process.env.DB_PASSWORD || '',
        };

        logger.info('Starting database backup', { filePath });

        await execAsync(pgDumpCmd, { env });

        // Get file size
        const stats = await fs.promises.stat(filePath);
        const fileSize = stats.size;

        logger.info('Database backup completed', { filePath, fileSize });

        return {
            success: true,
            filePath,
            fileSize,
        };
    } catch (error) {
        logger.error('Database backup failed', { error });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Restore database from backup
 */
export async function restoreDatabase(backupFile: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        // Verify backup file exists
        await fs.promises.access(backupFile);

        logger.info('Starting database restore', { backupFile });

        // Build pg_restore command
        const pgRestoreCmd = `pg_restore -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -c -v "${backupFile}"`;

        const env = {
            ...process.env,
            PGPASSWORD: process.env.DB_PASSWORD || '',
        };

        await execAsync(pgRestoreCmd, { env });

        logger.info('Database restore completed', { backupFile });

        return { success: true };
    } catch (error) {
        logger.error('Database restore failed', { error });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * List all backups
 */
export async function listBackups(): Promise<Array<{
    filename: string;
    filePath: string;
    fileSize: number;
    createdAt: Date;
}>> {
    try {
        await ensureBackupDir();

        const files = await fs.promises.readdir(BACKUP_DIR);

        const backups = await Promise.all(
            files
                .filter(f => f.endsWith('.sql') || f.endsWith('.dump'))
                .map(async (filename) => {
                    const filePath = path.join(BACKUP_DIR, filename);
                    const stats = await fs.promises.stat(filePath);
                    return {
                        filename,
                        filePath,
                        fileSize: stats.size,
                        createdAt: stats.birthtime,
                    };
                })
        );

        // Sort by creation date descending
        return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
        logger.error('Error listing backups', { error });
        return [];
    }
}

/**
 * Delete old backups beyond retention period
 */
export async function cleanupOldBackups(retentionDays: number = 30): Promise<{
    success: boolean;
    deletedCount: number;
    errors?: string[];
}> {
    try {
        const backups = await listBackups();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const oldBackups = backups.filter(b => b.createdAt < cutoffDate);

        const errors: string[] = [];
        let deletedCount = 0;

        for (const backup of oldBackups) {
            try {
                await fs.promises.unlink(backup.filePath);
                deletedCount++;
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                errors.push(`Failed to delete ${backup.filename}: ${errorMsg}`);
            }
        }

        // Also enforce max backups limit
        const remainingBackups = await listBackups();
        if (remainingBackups.length > MAX_BACKUPS) {
            const toDelete = remainingBackups.slice(MAX_BACKUPS);
            for (const backup of toDelete) {
                try {
                    await fs.promises.unlink(backup.filePath);
                    deletedCount++;
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                    errors.push(`Failed to delete ${backup.filename}: ${errorMsg}`);
                }
            }
        }

        logger.info('Backup cleanup completed', { deletedCount, retentionDays });

        return {
            success: true,
            deletedCount,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        logger.error('Error cleaning up backups', { error });
        return {
            success: false,
            deletedCount: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
    }
}

/**
 * Verify backup integrity
 */
export async function verifyBackup(backupFile: string): Promise<{
    valid: boolean;
    error?: string;
}> {
    try {
        // Check if file exists and is readable
        await fs.promises.access(backupFile, fs.constants.R_OK);

        // Check file size (should be > 0)
        const stats = await fs.promises.stat(backupFile);
        if (stats.size === 0) {
            return { valid: false, error: 'Backup file is empty' };
        }

        // For custom format backups, try to list contents
        if (backupFile.endsWith('.dump')) {
            const pgRestoreCmd = `pg_restore -l "${backupFile}" 2>&1 | head -n 1`;
            try {
                const { stdout } = await execAsync(pgRestoreCmd);
                if (!stdout.includes('Archive') && !stdout.includes('format')) {
                    return { valid: false, error: 'Invalid backup format' };
                }
            } catch {
                // pg_restore might fail on invalid files
                return { valid: false, error: 'Could not verify backup integrity' };
            }
        }

        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Get backup statistics
 */
export async function getBackupStats(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
    averageSize: number;
}> {
    const backups = await listBackups();

    if (backups.length === 0) {
        return {
            totalBackups: 0,
            totalSize: 0,
            oldestBackup: null,
            newestBackup: null,
            averageSize: 0,
        };
    }

    const totalSize = backups.reduce((sum, b) => sum + b.fileSize, 0);

    return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup: backups[backups.length - 1].createdAt,
        newestBackup: backups[0].createdAt,
        averageSize: Math.round(totalSize / backups.length),
    };
}

/**
 * Health check for backup system
 */
export async function healthCheck(): Promise<{
    healthy: boolean;
    lastBackup?: Date;
    issues?: string[];
}> {
    const issues: string[] = [];

    // Check if backup directory is writable
    try {
        await ensureBackupDir();
    } catch {
        issues.push('Backup directory is not writable');
    }

    // Check last backup
    const backups = await listBackups();
    let lastBackup: Date | undefined;

    if (backups.length > 0) {
        lastBackup = backups[0].createdAt;

        // Check if last backup is older than 24 hours
        const hoursSinceLastBackup = (Date.now() - lastBackup.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastBackup > 24) {
            issues.push(`Last backup was ${Math.round(hoursSinceLastBackup)} hours ago`);
        }
    } else {
        issues.push('No backups found');
    }

    return {
        healthy: issues.length === 0,
        lastBackup,
        issues: issues.length > 0 ? issues : undefined,
    };
}

export default {
    backupDatabase,
    restoreDatabase,
    listBackups,
    cleanupOldBackups,
    verifyBackup,
    getBackupStats,
    healthCheck,
};
