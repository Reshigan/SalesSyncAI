import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import winston from 'winston';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize database and cache
const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    message: 'SalesSyncAI API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic auth endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Simple demo response
  res.json({
    success: true,
    message: 'Login successful (demo)',
    user: {
      id: '1',
      email: email,
      name: 'Demo User',
      role: 'admin'
    },
    token: 'demo-jwt-token'
  });
});

// Dashboard data endpoint
app.get('/api/dashboard', (req, res) => {
  res.json({
    stats: {
      totalSales: 125000,
      totalVisits: 450,
      activeAgents: 25,
      completedTasks: 89
    },
    recentActivity: [
      { id: 1, type: 'sale', message: 'New sale completed', timestamp: new Date().toISOString() },
      { id: 2, type: 'visit', message: 'Store visit logged', timestamp: new Date().toISOString() }
    ]
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    error: {
      message: error.message || 'Internal server error',
      status: error.status || 500,
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404,
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
async function startServer() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Connected to Redis');
    
    // Test database connection
    await prisma.$connect();
    logger.info('Connected to database');
    
    app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 SalesSyncAI API server running on port ${port}`);
      logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Health check: http://localhost:${port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  await redis.disconnect();
  process.exit(0);
});

startServer();