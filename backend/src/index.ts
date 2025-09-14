import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

import { config } from './config/config';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Import route handlers
import authRoutes from './api/auth/routes';
import adminRoutes from './api/admin/routes';
import fieldSalesRoutes from './api/field-sales/routes';
import fieldMarketingRoutes from './api/field-marketing/routes';
import promotionsRoutes from './api/promotions/routes';
import reportingRoutes from './api/reporting/routes';

// Initialize Express app
const app = express();

// Initialize database
export const prisma = new PrismaClient();

// Basic middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: ['http://localhost:3000', 'https://work-2-necpxcrvufxzrged.prod-runtime.all-hands.dev'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: 'connected'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/field-sales', authMiddleware, fieldSalesRoutes);
app.use('/api/field-marketing', authMiddleware, fieldMarketingRoutes);
app.use('/api/promotions', authMiddleware, promotionsRoutes);
app.use('/api/reporting', reportingRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use(errorHandler);

// Initialize connections and start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');

    const port = config.port || 12000;
    
    app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 SalesSync API server running on http://0.0.0.0:${port}`);
      console.log(`🏥 Health check available at http://0.0.0.0:${port}/health`);
      console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
startServer();

export default app;