import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import winston from 'winston';
import expressWinston from 'express-winston';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { config } from './config/config';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { tenantMiddleware } from './middleware/tenant';

// Import route handlers
import authRoutes from './api/auth/routes';
import adminRoutes from './api/admin/routes';
import fieldSalesRoutes from './api/field-sales/routes';
import fieldMarketingRoutes from './api/field-marketing/routes';
import promotionsRoutes from './api/promotions/routes';
import reportingRoutes from './api/reporting/routes';
// import aiAnalyticsRoutes from './api/ai-analytics';

// Initialize Express app
const app = express();

// Initialize database and cache
export const prisma = new PrismaClient();
export const redis = createClient({ url: config.redis.url });

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'salessync-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SalesSync API',
      version: '1.0.0',
      description: 'Multi-Tenant Field Marketing Platform API',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.salessync.com' 
          : 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/api/**/*.ts'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://app.salessync.com', 'https://admin.salessync.com']
    : true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}}',
  expressFormat: true,
  colorize: false,
  ignoreRoute: function (req, res) { 
    return req.url === '/health'; 
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SalesSync API Documentation'
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api/field-sales', authMiddleware, tenantMiddleware, fieldSalesRoutes);
app.use('/api/field-marketing', authMiddleware, tenantMiddleware, fieldMarketingRoutes);
app.use('/api/promotions', authMiddleware, tenantMiddleware, promotionsRoutes);
app.use('/api/reporting', authMiddleware, tenantMiddleware, reportingRoutes);
// app.use('/api/ai-analytics', authMiddleware, tenantMiddleware, aiAnalyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use(expressWinston.errorLogger({
  winstonInstance: logger
}));

app.use(errorHandler);

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to Redis
    await redis.connect();
    logger.info('Connected to Redis');

    // Test database connection
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');

    const port = config.port || 3000;
    
    app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 SalesSync API server running on port ${port}`);
      logger.info(`📚 API Documentation available at http://localhost:${port}/api/docs`);
      logger.info(`🏥 Health check available at http://localhost:${port}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  await prisma.$disconnect();
  await redis.disconnect();
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  
  await prisma.$disconnect();
  await redis.disconnect();
  
  process.exit(0);
});

// Start the server
startServer();

export default app;