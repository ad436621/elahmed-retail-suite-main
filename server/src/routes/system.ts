// ============================================================
// ELAHMED RETAIL SUITE — System Routes (Health, Backup, Jobs)
// ============================================================

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { healthCheck, backupDatabase, listBackups, getBackupStats, restoreDatabase } from '../services/backup.js';
import { getJobStatus, getJobs, queueBackup, queueCleanupBackups } from '../lib/jobs.js';
import { getAuditStats } from '../services/auditService.js';
import logger from '../lib/logger.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ============================================================
// Health Check Endpoints
// ============================================================

/**
 * GET /api/health - Basic health check
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        // Check database connection
        await prisma.$queryRaw`SELECT 1`;

        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
        });
    } catch (error) {
        logger.error('Health check failed', { error });
        res.status(503).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

/**
 * GET /api/health/detailed - Detailed health check
 */
router.get('/health/detailed', authMiddleware, requireRole('admin', 'owner'), async (req: Request, res: Response) => {
    try {
        // Check database
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatency = Date.now() - dbStart;

        // Check backup system
        const backupHealth = await healthCheck();

        // Get audit stats
        const auditStats = await getAuditStats({});

        // Get memory usage
        const memUsage = process.memoryUsage();

        res.json({
            status: backupHealth.healthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            checks: {
                database: {
                    status: 'healthy',
                    latency: `${dbLatency}ms`,
                },
                backup: {
                    status: backupHealth.healthy ? 'healthy' : 'warning',
                    lastBackup: backupHealth.lastBackup,
                    issues: backupHealth.issues,
                },
                audit: {
                    totalLogs: auditStats.totalLogs,
                    uniqueUsers: auditStats.uniqueUsers,
                },
            },
            system: {
                memory: {
                    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                },
                cpu: process.cpuUsage(),
            },
        });
    } catch (error) {
        logger.error('Detailed health check failed', { error });
        res.status(503).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================
// Backup & Disaster Recovery Endpoints
// ============================================================

/**
 * GET /api/backup - List all backups
 */
router.get('/backup', authMiddleware, requireRole('admin', 'owner'), async (req: Request, res: Response) => {
    try {
        const backups = await listBackups();
        res.json({ backups });
    } catch (error) {
        logger.error('Error listing backups', { error });
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

/**
 * GET /api/backup/stats - Get backup statistics
 */
router.get('/backup/stats', authMiddleware, requireRole('admin', 'owner'), async (req: Request, res: Response) => {
    try {
        const stats = await getBackupStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error getting backup stats', { error });
        res.status(500).json({ error: 'Failed to get backup stats' });
    }
});

/**
 * POST /api/backup - Create a new backup
 */
router.post('/backup', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
    try {
        const jobId = await queueBackup('now');
        res.json({ message: 'Backup started', jobId });
    } catch (error) {
        logger.error('Error starting backup', { error });
        res.status(500).json({ error: 'Failed to start backup' });
    }
});

/**
 * POST /api/backup/cleanup - Cleanup old backups
 */
router.post('/backup/cleanup', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
    try {
        const retentionDays = parseInt(req.body.retentionDays as string) || 30;
        const jobId = await queueCleanupBackups(retentionDays);
        res.json({ message: 'Cleanup started', jobId });
    } catch (error) {
        logger.error('Error starting cleanup', { error });
        res.status(500).json({ error: 'Failed to start cleanup' });
    }
});

/**
 * POST /api/backup/restore - Restore from backup
 */
router.post('/backup/restore', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
    try {
        const { backupFile } = req.body;

        if (!backupFile) {
            return res.status(400).json({ error: 'Backup file path is required' });
        }

        logger.warn('Restore initiated', { backupFile, userId: req.user?.id });

        const result = await restoreDatabase(backupFile);

        if (result.success) {
            res.json({ message: 'Restore completed successfully' });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        logger.error('Error restoring backup', { error });
        res.status(500).json({ error: 'Failed to restore backup' });
    }
});

// ============================================================
// Background Jobs Endpoints
// ============================================================

/**
 * GET /api/jobs - List background jobs
 */
router.get('/jobs', authMiddleware, requireRole('admin', 'owner'), async (req: Request, res: Response) => {
    try {
        const status = req.query.status as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const jobs = await getJobs(status, limit, offset);
        res.json({ jobs });
    } catch (error) {
        logger.error('Error listing jobs', { error });
        res.status(500).json({ error: 'Failed to list jobs' });
    }
});

/**
 * GET /api/jobs/:id - Get job status
 */
router.get('/jobs/:id', authMiddleware, requireRole('admin', 'owner'), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const jobStatus = await getJobStatus(id);

        if (!jobStatus) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(jobStatus);
    } catch (error) {
        logger.error('Error getting job status', { error });
        res.status(500).json({ error: 'Failed to get job status' });
    }
});

// ============================================================
// Audit Logs Endpoints
// ============================================================

/**
 * GET /api/audit - Query audit logs
 */
router.get('/audit', authMiddleware, requireRole('admin', 'owner'), async (req: Request, res: Response) => {
    try {
        const { userId, action, entityType, entityId, startDate, endDate, limit, offset } = req.query;

        const result = await queryAuditLogs({
            userId: userId as string,
            action: action as string,
            entityType: entityType as string,
            entityId: entityId as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
            limit: limit ? parseInt(limit as string) : 50,
            offset: offset ? parseInt(offset as string) : 0,
        });

        res.json(result);
    } catch (error) {
        logger.error('Error querying audit logs', { error });
        res.status(500).json({ error: 'Failed to query audit logs' });
    }
});

/**
 * GET /api/audit/stats - Get audit statistics
 */
router.get('/audit/stats', authMiddleware, requireRole('admin', 'owner'), async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const stats = await getAuditStats({
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
        });

        res.json(stats);
    } catch (error) {
        logger.error('Error getting audit stats', { error });
        res.status(500).json({ error: 'Failed to get audit stats' });
    }
});

// Import the queryAuditLogs function
import { queryAuditLogs } from '../services/auditService.js';

export default router;
