/**
 * Real-time Dashboard API for SalesSync
 * WebSocket-based real-time metrics and live updates
 */

import { Router, Response } from 'express';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';
import { cacheMiddleware, CacheTags } from '../../middleware/cache';
import { query, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// WebSocket server instance (would be initialized in main server file)
let io: SocketIOServer;

export function initializeWebSocket(socketServer: SocketIOServer) {
  io = socketServer;
  setupWebSocketHandlers();
}

interface RealTimeMetrics {
  timestamp: Date;
  sales: {
    todayRevenue: number;
    todayTransactions: number;
    hourlyRevenue: number[];
    recentSales: RecentSale[];
    topPerformers: AgentPerformance[];
  };
  visits: {
    plannedToday: number;
    completedToday: number;
    inProgress: number;
    successRate: number;
    recentVisits: RecentVisit[];
  };
  agents: {
    totalActive: number;
    onlineNow: number;
    performanceDistribution: PerformanceDistribution[];
    alertsCount: number;
  };
  system: {
    syncStatus: 'healthy' | 'warning' | 'error';
    errorRate: number;
    responseTime: number;
    activeConnections: number;
  };
  alerts: SystemAlert[];
}

interface RecentSale {
  id: string;
  agentName: string;
  customerName: string;
  amount: number;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
}

interface RecentVisit {
  id: string;
  agentName: string;
  customerName: string;
  status: 'planned' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  duration?: number;
}

interface AgentPerformance {
  agentId: string;
  agentName: string;
  todayRevenue: number;
  todayVisits: number;
  status: 'online' | 'offline' | 'busy';
  lastActivity: Date;
}

interface PerformanceDistribution {
  range: string;
  count: number;
  percentage: number;
}

interface SystemAlert {
  id: string;
  type: 'performance' | 'system' | 'fraud' | 'target';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface LiveUpdate {
  type: 'sale' | 'visit' | 'agent_status' | 'alert' | 'system';
  data: any;
  timestamp: Date;
}

/**
 * Get real-time dashboard metrics
 */
router.get('/metrics',
  authMiddleware,
  cacheMiddleware(30), // 30 seconds cache
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.companyId;
      const metrics = await generateRealTimeMetrics(companyId);

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('Real-time metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get real-time metrics'
      });
    }
  }
);

/**
 * Get live activity feed
 */
router.get('/activity',
  authMiddleware,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('type').optional().isIn(['sale', 'visit', 'agent_status', 'alert', 'system']).withMessage('Invalid activity type')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const companyId = req.user!.companyId;
      const limit = parseInt(req.query.limit as string) || 50;
      const type = req.query.type as string;

      const activities = await getRecentActivities(companyId, limit, type);

      res.json({
        success: true,
        data: activities
      });

    } catch (error) {
      console.error('Activity feed error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get activity feed'
      });
    }
  }
);

/**
 * Get agent status overview
 */
router.get('/agents/status',
  authMiddleware,
  cacheMiddleware(60), // 1 minute cache
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.companyId;
      const agentStatus = await getAgentStatusOverview(companyId);

      res.json({
        success: true,
        data: agentStatus
      });

    } catch (error) {
      console.error('Agent status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get agent status'
      });
    }
  }
);

/**
 * Get system health metrics
 */
router.get('/system/health',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.companyId;
      const systemHealth = await getSystemHealthMetrics(companyId);

      res.json({
        success: true,
        data: systemHealth
      });

    } catch (error) {
      console.error('System health error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system health'
      });
    }
  }
);

/**
 * Get performance alerts
 */
router.get('/alerts',
  authMiddleware,
  [
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
    query('acknowledged').optional().isBoolean().withMessage('Acknowledged must be boolean')
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const companyId = req.user!.companyId;
      const severity = req.query.severity as string;
      const acknowledged = req.query.acknowledged === 'true';

      const alerts = await getSystemAlerts(companyId, severity, acknowledged);

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      console.error('Alerts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alerts'
      });
    }
  }
);

/**
 * Acknowledge alert
 */
router.post('/alerts/:alertId/acknowledge',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { alertId } = req.params;
      const userId = req.user!.id;

      // In production, would update alert in database
      const acknowledged = await acknowledgeAlert(alertId, userId);

      if (acknowledged) {
        // Broadcast alert acknowledgment
        broadcastUpdate({
          type: 'alert',
          data: {
            alertId,
            acknowledged: true,
            acknowledgedBy: userId,
            acknowledgedAt: new Date()
          },
          timestamp: new Date()
        });

        res.json({
          success: true,
          message: 'Alert acknowledged successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

    } catch (error) {
      console.error('Acknowledge alert error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge alert'
      });
    }
  }
);

/**
 * Get hourly performance data
 */
router.get('/performance/hourly',
  authMiddleware,
  cacheMiddleware(300), // 5 minutes cache
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = req.user!.companyId;
      const hourlyData = await getHourlyPerformanceData(companyId);

      res.json({
        success: true,
        data: hourlyData
      });

    } catch (error) {
      console.error('Hourly performance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get hourly performance data'
      });
    }
  }
);

// WebSocket handlers
function setupWebSocketHandlers() {
  if (!io) return;

  io.on('connection', (socket: Socket) => {
    console.log('Client connected to real-time dashboard:', socket.id);

    // Join company room for targeted updates
    socket.on('join-company', (companyId: string) => {
      socket.join(`company:${companyId}`);
      console.log(`Client ${socket.id} joined company room: ${companyId}`);
    });

    // Handle subscription to specific metrics
    socket.on('subscribe-metrics', (metrics: string[]) => {
      metrics.forEach(metric => {
        socket.join(`metric:${metric}`);
      });
      console.log(`Client ${socket.id} subscribed to metrics:`, metrics);
    });

    // Handle unsubscription
    socket.on('unsubscribe-metrics', (metrics: string[]) => {
      metrics.forEach(metric => {
        socket.leave(`metric:${metric}`);
      });
      console.log(`Client ${socket.id} unsubscribed from metrics:`, metrics);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected from real-time dashboard:', socket.id);
    });
  });
}

// Helper functions

async function generateRealTimeMetrics(companyId: string): Promise<RealTimeMetrics> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's sales data
  const todaySales = await prisma.sale.findMany({
    where: {
      companyId,
      createdAt: {
        gte: today
      }
    },
    include: {
      agent: true,
      customer: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Get today's visits data
  const todayVisits = await prisma.visit.findMany({
    where: {
      companyId,
      createdAt: {
        gte: today
      }
    },
    include: {
      agent: true,
      customer: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Get active agents
  const activeAgents = await prisma.user.findMany({
    where: {
      companyId,
      role: {
        in: ['FIELD_SALES_AGENT', 'FIELD_MARKETING_AGENT', 'PROMOTER']
      }
    }
  });

  // Calculate metrics
  const todayRevenue = todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
  const todayTransactions = todaySales.length;
  
  const plannedVisits = todayVisits.length;
  const completedVisits = todayVisits.filter(v => v.status === 'COMPLETED').length;
  const inProgressVisits = todayVisits.filter(v => v.status === 'IN_PROGRESS').length;
  const successRate = plannedVisits > 0 ? (completedVisits / plannedVisits) * 100 : 0;

  // Generate hourly revenue data
  const hourlyRevenue = generateHourlyRevenue(todaySales);

  // Get recent sales (last 10)
  const recentSales: RecentSale[] = todaySales.slice(0, 10).map(sale => ({
    id: sale.id,
    agentName: `${sale.agent.firstName} ${sale.agent.lastName}`,
    customerName: sale.customer.name,
    amount: Number(sale.totalAmount),
    timestamp: sale.createdAt,
    status: 'completed'
  }));

  // Get recent visits (last 10)
  const recentVisits: RecentVisit[] = todayVisits.slice(0, 10).map(visit => ({
    id: visit.id,
    agentName: `${visit.agent.firstName} ${visit.agent.lastName}`,
    customerName: visit.customer.name,
    status: visit.status.toLowerCase() as any,
    startTime: visit.actualStartTime || visit.createdAt,
    duration: visit.actualEndTime && visit.actualStartTime 
      ? Math.round((new Date(visit.actualEndTime).getTime() - new Date(visit.actualStartTime).getTime()) / 60000)
      : undefined
  }));

  // Get top performers
  const agentSales = new Map();
  todaySales.forEach(sale => {
    const agentId = sale.agentId;
    if (!agentSales.has(agentId)) {
      agentSales.set(agentId, {
        agentId,
        agentName: `${sale.agent.firstName} ${sale.agent.lastName}`,
        todayRevenue: 0,
        todayVisits: 0,
        status: 'online',
        lastActivity: sale.createdAt
      });
    }
    const agent = agentSales.get(agentId);
    agent.todayRevenue += Number(sale.totalAmount);
  });

  // Add visit counts
  todayVisits.forEach(visit => {
    const agentId = visit.agentId;
    if (agentSales.has(agentId)) {
      agentSales.get(agentId).todayVisits++;
    }
  });

  const topPerformers = Array.from(agentSales.values())
    .sort((a, b) => b.todayRevenue - a.todayRevenue)
    .slice(0, 5);

  // Generate performance distribution
  const performanceDistribution = generatePerformanceDistribution(Array.from(agentSales.values()));

  // Get system alerts
  const alerts = await getSystemAlerts(companyId);

  return {
    timestamp: new Date(),
    sales: {
      todayRevenue,
      todayTransactions,
      hourlyRevenue,
      recentSales,
      topPerformers
    },
    visits: {
      plannedToday: plannedVisits,
      completedToday: completedVisits,
      inProgress: inProgressVisits,
      successRate,
      recentVisits
    },
    agents: {
      totalActive: activeAgents.length,
      onlineNow: Math.floor(activeAgents.length * 0.8), // Mock online status
      performanceDistribution,
      alertsCount: alerts.filter(a => !a.acknowledged).length
    },
    system: {
      syncStatus: 'healthy',
      errorRate: 0.02,
      responseTime: 150,
      activeConnections: io ? io.engine.clientsCount : 0
    },
    alerts: alerts.slice(0, 5) // Latest 5 alerts
  };
}

function generateHourlyRevenue(sales: any[]): number[] {
  const hourlyData = new Array(24).fill(0);
  
  sales.forEach(sale => {
    const hour = new Date(sale.createdAt).getHours();
    hourlyData[hour] += Number(sale.totalAmount);
  });
  
  return hourlyData;
}

function generatePerformanceDistribution(agents: any[]): PerformanceDistribution[] {
  const ranges = [
    { range: '0-1000', min: 0, max: 1000 },
    { range: '1001-5000', min: 1001, max: 5000 },
    { range: '5001-10000', min: 5001, max: 10000 },
    { range: '10000+', min: 10001, max: Infinity }
  ];

  const distribution = ranges.map(range => {
    const count = agents.filter(agent => 
      agent.todayRevenue >= range.min && agent.todayRevenue <= range.max
    ).length;
    
    return {
      range: range.range,
      count,
      percentage: agents.length > 0 ? (count / agents.length) * 100 : 0
    };
  });

  return distribution;
}

async function getRecentActivities(companyId: string, limit: number, type?: string): Promise<LiveUpdate[]> {
  // Mock implementation - in production would query activity log
  const activities: LiveUpdate[] = [
    {
      type: 'sale',
      data: {
        agentName: 'John Smith',
        customerName: 'ABC Store',
        amount: 1250.00,
        products: ['Product A', 'Product B']
      },
      timestamp: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    },
    {
      type: 'visit',
      data: {
        agentName: 'Jane Doe',
        customerName: 'XYZ Shop',
        status: 'completed',
        duration: 45
      },
      timestamp: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
    },
    {
      type: 'alert',
      data: {
        severity: 'medium',
        message: 'Agent performance below target',
        agentName: 'Bob Johnson'
      },
      timestamp: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
    }
  ];

  return type ? activities.filter(a => a.type === type).slice(0, limit) : activities.slice(0, limit);
}

async function getAgentStatusOverview(companyId: string): Promise<any> {
  const agents = await prisma.user.findMany({
    where: {
      companyId,
      role: {
        in: ['FIELD_SALES_AGENT', 'FIELD_MARKETING_AGENT', 'PROMOTER']
      }
    }
  });

  // Mock status data
  return {
    total: agents.length,
    online: Math.floor(agents.length * 0.8),
    busy: Math.floor(agents.length * 0.15),
    offline: Math.floor(agents.length * 0.05),
    agents: agents.map(agent => ({
      id: agent.id,
      name: `${agent.firstName} ${agent.lastName}`,
      status: Math.random() > 0.2 ? 'online' : 'offline',
      lastActivity: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
      currentLocation: 'Territory A'
    }))
  };
}

async function getSystemHealthMetrics(companyId: string): Promise<any> {
  return {
    database: {
      status: 'healthy',
      responseTime: 25,
      connections: 15
    },
    redis: {
      status: 'healthy',
      memory: '45MB',
      hitRate: 85.5
    },
    api: {
      status: 'healthy',
      responseTime: 150,
      errorRate: 0.02
    },
    sync: {
      status: 'healthy',
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      pendingItems: 3
    }
  };
}

async function getSystemAlerts(companyId: string, severity?: string, acknowledged?: boolean): Promise<SystemAlert[]> {
  // Mock alerts - in production would query from database
  const mockAlerts: SystemAlert[] = [
    {
      id: '1',
      type: 'performance',
      severity: 'medium',
      message: 'Agent John Smith performance below target (65% of goal)',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      acknowledged: false
    },
    {
      id: '2',
      type: 'system',
      severity: 'low',
      message: 'Database connection pool at 80% capacity',
      timestamp: new Date(Date.now() - 45 * 60 * 1000),
      acknowledged: true
    },
    {
      id: '3',
      type: 'fraud',
      severity: 'high',
      message: 'Suspicious activity detected for Agent Bob Johnson',
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      acknowledged: false
    }
  ];

  let filteredAlerts = mockAlerts;

  if (severity) {
    filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
  }

  if (acknowledged !== undefined) {
    filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged === acknowledged);
  }

  return filteredAlerts;
}

async function getHourlyPerformanceData(companyId: string): Promise<any> {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  return {
    sales: hours.map(hour => ({
      hour,
      revenue: Math.random() * 5000,
      transactions: Math.floor(Math.random() * 20)
    })),
    visits: hours.map(hour => ({
      hour,
      planned: Math.floor(Math.random() * 15),
      completed: Math.floor(Math.random() * 12)
    }))
  };
}

async function acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
  // Mock implementation - in production would update database
  console.log(`Alert ${alertId} acknowledged by user ${userId}`);
  return true;
}

// Broadcast functions
export function broadcastUpdate(update: LiveUpdate, companyId?: string): void {
  if (!io) return;

  if (companyId) {
    io.to(`company:${companyId}`).emit('live-update', update);
  } else {
    io.emit('live-update', update);
  }
}

export function broadcastMetrics(metrics: RealTimeMetrics, companyId: string): void {
  if (!io) return;
  
  io.to(`company:${companyId}`).emit('metrics-update', metrics);
}

export function broadcastAlert(alert: SystemAlert, companyId: string): void {
  if (!io) return;
  
  io.to(`company:${companyId}`).emit('alert', alert);
}

// Periodic metrics update (would be called by a scheduler)
export async function updateRealTimeMetrics(): Promise<void> {
  try {
    // Get all companies
    const companies = await prisma.company.findMany({
      select: { id: true }
    });

    // Update metrics for each company
    for (const company of companies) {
      const metrics = await generateRealTimeMetrics(company.id);
      broadcastMetrics(metrics, company.id);
    }
  } catch (error) {
    console.error('Error updating real-time metrics:', error);
  }
}

export default router;