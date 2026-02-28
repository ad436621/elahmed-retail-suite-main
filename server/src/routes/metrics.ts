// ============================================================
// ELAHMED RETAIL SUITE — Metrics Routes
// ============================================================

import { Router, Request, Response } from 'express';
import { getMetrics } from '../services/monitoring.js';

const router = Router();

/**
 * GET /api/metrics - Prometheus metrics endpoint
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const metrics = await getMetrics();

        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

export default router;
