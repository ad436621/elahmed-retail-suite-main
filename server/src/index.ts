// ============================================================
// ELAHMED RETAIL SUITE — API Server
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import productsRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import inventoryRoutes from './routes/inventory.js';
import customersRoutes from './routes/customers.js';
import suppliersRoutes from './routes/suppliers.js';
import settingsRoutes from './routes/settings.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/products', authMiddleware, productsRoutes);
app.use('/api/sales', authMiddleware, salesRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/customers', authMiddleware, customersRoutes);
app.use('/api/suppliers', authMiddleware, suppliersRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 ElAhmed Retail API running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
});

export default app;
