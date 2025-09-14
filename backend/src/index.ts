import express from 'express';
import cors from 'cors';
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

// Import advanced middleware
import { 
  securityHeaders, 
  rateLimitMiddleware, 
  bruteForceProtection, 
  ipFilteringMiddleware, 
  suspiciousActivityMiddleware 
} from './middleware/security';
import { 
  performanceMiddleware, 
  errorTrackingMiddleware,
  getSystemHealth,
  getMetrics,
  getErrorLogs,
  getAlerts
} from './middleware/monitoring';

// Import route handlers
import authRoutes from './api/auth/routes';
import adminRoutes from './api/admin/routes';
import fieldSalesRoutes from './api/field-sales/routes';
import fieldMarketingRoutes from './api/field-marketing/routes';
import promotionsRoutes from './api/promotions/routes';
import reportingRoutes from './api/reporting/routes';
import aiAnalyticsRoutes from './api/ai-analytics';

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

// Security middleware (applied first)
app.use(securityHeaders());
app.use(ipFilteringMiddleware());
app.use(rateLimitMiddleware());
app.use(bruteForceProtection());
app.use(suspiciousActivityMiddleware());

// Performance monitoring middleware
app.use(performanceMiddleware());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://salessync.com', 'https://www.salessync.com', 'https://app.salessync.com', 'https://admin.salessync.com']
    : ['http://localhost:3001', 'http://localhost:12001', 'http://localhost:12000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Requested-With'],
}));

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
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      instanceId: process.env.INSTANCE_ID || 'unknown',
      database: 'connected',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
      uptime: process.uptime()
    });
  }
});

// System health endpoint (detailed)
app.get('/api/system/health', async (req, res) => {
  try {
    const health = await getSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get system health',
      message: error.message 
    });
  }
});

// Performance metrics endpoint
app.get('/metrics', (req, res) => {
  try {
    const metrics = getMetrics(100);
    const alerts = getAlerts(false);
    
    // Convert to Prometheus format
    let prometheusMetrics = '';
    
    // Request metrics
    prometheusMetrics += '# HELP http_requests_total Total number of HTTP requests\n';
    prometheusMetrics += '# TYPE http_requests_total counter\n';
    prometheusMetrics += `http_requests_total ${metrics.length}\n\n`;
    
    // Response time metrics
    if (metrics.length > 0) {
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
      prometheusMetrics += '# HELP http_request_duration_ms Average HTTP request duration in milliseconds\n';
      prometheusMetrics += '# TYPE http_request_duration_ms gauge\n';
      prometheusMetrics += `http_request_duration_ms ${avgResponseTime.toFixed(2)}\n\n`;
    }
    
    // Error rate
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = metrics.length > 0 ? (errorCount / metrics.length) * 100 : 0;
    prometheusMetrics += '# HELP http_error_rate_percent HTTP error rate percentage\n';
    prometheusMetrics += '# TYPE http_error_rate_percent gauge\n';
    prometheusMetrics += `http_error_rate_percent ${errorRate.toFixed(2)}\n\n`;
    
    // Memory usage
    const memUsage = process.memoryUsage();
    prometheusMetrics += '# HELP nodejs_memory_heap_used_bytes Node.js heap memory used in bytes\n';
    prometheusMetrics += '# TYPE nodejs_memory_heap_used_bytes gauge\n';
    prometheusMetrics += `nodejs_memory_heap_used_bytes ${memUsage.heapUsed}\n\n`;
    
    // Active alerts
    prometheusMetrics += '# HELP system_alerts_active Number of active system alerts\n';
    prometheusMetrics += '# TYPE system_alerts_active gauge\n';
    prometheusMetrics += `system_alerts_active ${alerts.length}\n\n`;
    
    res.set('Content-Type', 'text/plain');
    res.send(prometheusMetrics);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get metrics',
      message: error.message 
    });
  }
});

// Error logs endpoint (admin only)
app.get('/api/system/errors', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const errors = await getErrorLogs(limit);
    res.json({ success: true, data: errors });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get error logs',
      message: error.message 
    });
  }
});

// System alerts endpoint (admin only)
app.get('/api/system/alerts', (req, res) => {
  try {
    const resolved = req.query.resolved === 'true';
    const alerts = getAlerts(resolved);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get alerts',
      message: error.message 
    });
  }
});

// Status endpoint for load balancer
app.get('/status', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: Date.now(),
    instance: process.env.INSTANCE_ID || 'unknown'
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
app.use('/api/ai-analytics', authMiddleware, tenantMiddleware, aiAnalyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error tracking middleware (applied after routes)
app.use(errorTrackingMiddleware());

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