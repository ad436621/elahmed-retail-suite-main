// ============================================================
// ELAHMED RETAIL SUITE — Background Jobs with BullMQ
// ============================================================

import { Queue, Worker, Job } from 'bullmq';
import prisma from '../lib/prisma.js';
import logger from './logger.js';
import { backupDatabase, cleanupOldBackups } from '../services/backup.js';

// Redis connection configuration
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
};

// Define job types
export const JobTypes = {
    GENERATE_REPORT: 'generate_report',
    SEND_NOTIFICATION: 'send_notification',
    EXPORT_DATA: 'export_data',
    SYNC_INVENTORY: 'sync_inventory',
    BACKUP_DATABASE: 'backup_database',
    CLEANUP_old_BACKUPS: 'cleanup_old_backups',
    SEND_SMS: 'send_sms',
    SEND_EMAIL: 'send_email',
} as const;

// Create queues
const reportQueue = new Queue(JobTypes.GENERATE_REPORT, { connection });
const notificationQueue = new Queue(JobTypes.SEND_NOTIFICATION, { connection });
const exportQueue = new Queue(JobTypes.EXPORT_DATA, { connection });
const backupQueue = new Queue(JobTypes.BACKUP_DATABASE, { connection });

/**
 * Track job in database
 */
async function trackJob(
    name: string,
    jobId: string,
    data: Record<string, unknown>,
    opts?: Record<string, unknown>
): Promise<void> {
    try {
        await prisma.backgroundJob.create({
            data: {
                name,
                data: data as unknown as Record<string, unknown>,
                opts: opts as unknown as Record<string, unknown>,
                status: 'pending',
                maxAttempts: opts?.attempts ? Number(opts.attempts) : 3,
            },
        });
    } catch (error) {
        logger.error('Error tracking job', { name, jobId, error });
    }
}

/**
 * Update job status in database
 */
async function updateJobStatus(
    jobId: string,
    status: 'completed' | 'failed' | 'active' | 'waiting',
    result?: Record<string, unknown>,
    error?: string
): Promise<void> {
    try {
        await prisma.backgroundJob.update({
            where: { id: jobId },
            data: {
                status,
                result: result as unknown as Record<string, unknown>,
                error,
                completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
            },
        });
    } catch (error) {
        logger.error('Error updating job status', { jobId, status, error });
    }
}

// ============================================================
// Job Processors
// ============================================================

/**
 * Generate report job processor
 */
async function processGenerateReport(job: Job): Promise<Record<string, unknown>> {
    const { reportType, dateRange, format, userId } = job.data;

    logger.info('Generating report', { reportType, dateRange, userId });

    // Simulate report generation
    await job.updateProgress(50);

    // In real implementation, generate the report based on type
    const reportData = {
        type: reportType,
        generatedAt: new Date().toISOString(),
        dateRange,
        format,
    };

    await job.updateProgress(100);

    return {
        success: true,
        reportId: `report_${Date.now()}`,
        data: reportData,
    };
}

/**
 * Export data job processor
 */
async function processExportData(job: Job): Promise<Record<string, unknown>> {
    const { entityType, filters, format, userId } = job.data;

    logger.info('Exporting data', { entityType, filters, userId });

    await job.updateProgress(30);

    // In real implementation, export data based on entity type
    const exportResult = {
        entityType,
        recordCount: 0,
        format,
        fileUrl: `/exports/${entityType}_${Date.now()}.${format}`,
    };

    await job.updateProgress(100);

    return {
        success: true,
        ...exportResult,
    };
}

/**
 * Send notification job processor
 */
async function processSendNotification(job: Job): Promise<Record<string, unknown>> {
    const { type, recipients, message, subject } = job.data;

    logger.info('Sending notification', { type, recipients });

    // In real implementation, send via email/SMS/WhatsApp
    const results = {
        type,
        recipientCount: Array.isArray(recipients) ? recipients.length : 1,
        sentAt: new Date().toISOString(),
    };

    return {
        success: true,
        ...results,
    };
}

/**
 * Backup database job processor
 */
async function processBackupDatabase(job: Job): Promise<Record<string, unknown>> {
    logger.info('Starting database backup');

    await job.updateProgress(20);

    const backupResult = await backupDatabase();

    await job.updateProgress(100);

    return backupResult;
}

/**
 * Cleanup old backups job processor
 */
async function processCleanupBackups(job: Job): Promise<Record<string, unknown>> {
    const { retentionDays = 30 } = job.data;

    logger.info('Cleaning up old backups', { retentionDays });

    const result = await cleanupOldBackups(retentionDays);

    return {
        success: true,
        deletedCount: result.deletedCount,
    };
}

// ============================================================
// Create Workers
// ============================================================

// Report generation worker
new Worker(
    JobTypes.GENERATE_REPORT,
    async (job) => {
        return processGenerateReport(job);
    },
    { connection, concurrency: 2 }
);

// Export data worker
new Worker(
    JobTypes.EXPORT_DATA,
    async (job) => {
        return processExportData(job);
    },
    { connection, concurrency: 3 }
);

// Notification worker
new Worker(
    JobTypes.SEND_NOTIFICATION,
    async (job) => {
        return processSendNotification(job);
    },
    { connection, concurrency: 5 }
);

// Backup worker
new Worker(
    JobTypes.BACKUP_DATABASE,
    async (job) => {
        return processBackupDatabase(job);
    },
    { connection, concurrency: 1 }
);

// Cleanup worker
new Worker(
    JobTypes.CLEANUP_old_BACKUPS,
    async (job) => {
        return processCleanupBackups(job);
    },
    { connection, concurrency: 1 }
);

// ============================================================
// Queue Functions
// ============================================================

/**
 * Add a report generation job to the queue
 */
export async function queueGenerateReport(
    reportType: string,
    dateRange: { start: string; end: string },
    format: 'pdf' | 'excel' | 'csv',
    userId: string
): Promise<string> {
    const job = await reportQueue.add(JobTypes.GENERATE_REPORT, {
        reportType,
        dateRange,
        format,
        userId,
    });

    await trackJob(JobTypes.GENERATE_REPORT, job.id!, {
        reportType,
        dateRange,
        format,
        userId,
    });

    return job.id!;
}

/**
 * Add a data export job to the queue
 */
export async function queueExportData(
    entityType: string,
    filters: Record<string, unknown>,
    format: 'pdf' | 'excel' | 'csv',
    userId: string
): Promise<string> {
    const job = await exportQueue.add(JobTypes.EXPORT_DATA, {
        entityType,
        filters,
        format,
        userId,
    });

    await trackJob(JobTypes.EXPORT_DATA, job.id!, {
        entityType,
        filters,
        format,
        userId,
    });

    return job.id!;
}

/**
 * Add a notification job to the queue
 */
export async function queueSendNotification(
    type: 'email' | 'sms' | 'whatsapp',
    recipients: string | string[],
    message: string,
    subject?: string
): Promise<string> {
    const job = await notificationQueue.add(JobTypes.SEND_NOTIFICATION, {
        type,
        recipients,
        message,
        subject,
    });

    await trackJob(JobTypes.SEND_NOTIFICATION, job.id!, {
        type,
        recipients,
        message,
        subject,
    });

    return job.id!;
}

/**
 * Schedule a database backup
 */
export async function queueBackup(
    schedule: 'now' | 'scheduled' = 'now'
): Promise<string> {
    const jobOpts = schedule === 'scheduled'
        ? { delay: 1000 * 60 * 60 * 2 } // 2 hours delay for scheduled
        : undefined;

    const job = await backupQueue.add(JobTypes.BACKUP_DATABASE, {}, jobOpts);

    await trackJob(JobTypes.BACKUP_DATABASE, job.id!, {});

    return job.id!;
}

/**
 * Schedule cleanup of old backups
 */
export async function queueCleanupBackups(retentionDays: number = 30): Promise<string> {
    const job = await backupQueue.add(JobTypes.CLEANUP_old_BACKUPS, { retentionDays });

    await trackJob(JobTypes.CLEANUP_old_BACKUPS, job.id!, { retentionDays });

    return job.id!;
}

/**
 * Get job status from database
 */
export async function getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    result?: Record<string, unknown>;
    error?: string;
} | null> {
    const job = await prisma.backgroundJob.findUnique({
        where: { id: jobId },
    });

    if (!job) return null;

    return {
        status: job.status,
        progress: job.progress,
        result: job.result as Record<string, unknown> | undefined,
        error: job.error || undefined,
    };
}

/**
 * Get all jobs with optional filtering
 */
export async function getJobs(
    status?: string,
    limit: number = 50,
    offset: number = 0
): Promise<Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
    createdAt: Date;
    completedAt?: Date;
}>> {
    const where = status ? { status: status as any } : {};

    const jobs = await prisma.backgroundJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    });

    return jobs.map((job: any) => ({
        id: job.id,
        name: job.name,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        completedAt: job.completedAt || undefined,
    }));
}

/**
 * Schedule recurring jobs
 */
export async function scheduleRecurringJobs(): Promise<void> {
    // Daily backup at 2 AM
    backupQueue.add(JobTypes.BACKUP_DATABASE, {}, {
        repeat: {
            pattern: '0 2 * * *', // Daily at 2 AM
        },
    });

    // Weekly cleanup every Sunday at 3 AM
    backupQueue.add(JobTypes.CLEANUP_old_BACKUPS, { retentionDays: 30 }, {
        repeat: {
            pattern: '0 3 * * 0', // Weekly on Sunday at 3 AM
        },
    });

    logger.info('Recurring jobs scheduled');
}

export default {
    queueGenerateReport,
    queueExportData,
    queueSendNotification,
    queueBackup,
    queueCleanupBackups,
    getJobStatus,
    getJobs,
    scheduleRecurringJobs,
};
