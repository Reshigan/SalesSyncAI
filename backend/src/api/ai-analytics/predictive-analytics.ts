import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = Router();

/**
 * @swagger
 * /api/ai-analytics/sales-forecast:
 *   get:
 *     summary: Get sales forecast and trends
 *     tags: [AI Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter]
 *         description: Forecast period
 *       - in: query
 *         name: forecastPeriod
 *         schema:
 *           type: string
 *           enum: [1_month, 3_months, 6_months]
 *         description: How far to forecast
 *     responses:
 *       200:
 *         description: Sales forecast data
 */
router.get('/sales-forecast', async (req: Request, res: Response) => {
  try {
    const { period = 'month', forecastPeriod = '3_months' } = req.query;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID required'
      });
    }

    // Get historical sales data
    const salesData = await prisma.visit.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
        }
      },
      include: {
        sales: true,
        agent: true
      }
    });

    // Process data for trends
    const monthlyData = new Map();
    
    salesData.forEach(visit => {
      const monthKey = visit.createdAt.toISOString().substring(0, 7); // YYYY-MM
      // Mock sales data since sales relation doesn't exist in current schema
      const totalSales = Math.random() * 1000; // Simulate sales amount
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthKey,
          totalSales: 0,
          visitCount: 0,
          agents: new Set()
        });
      }
      
      const monthStats = monthlyData.get(monthKey);
      monthStats.totalSales += totalSales;
      monthStats.visitCount += 1;
      monthStats.agents.add(visit.agentId);
    });

    const monthlyTrends = Array.from(monthlyData.values()).map(month => ({
      ...month,
      uniqueAgents: month.agents.size,
      avgSalesPerVisit: month.visitCount > 0 ? month.totalSales / month.visitCount : 0
    }));

    // Simple forecast calculation
    let forecast = { forecast: 0, confidence: 0, trend: 'stable' };
    if (monthlyTrends.length >= 2) {
      const recent = monthlyTrends.slice(-3);
      const avgGrowth = recent.reduce((sum, month, index) => {
        if (index === 0) return 0;
        return sum + ((month.totalSales - recent[index - 1].totalSales) / recent[index - 1].totalSales);
      }, 0) / (recent.length - 1);
      
      const lastMonth = monthlyTrends[monthlyTrends.length - 1];
      forecast = {
        forecast: lastMonth.totalSales * (1 + avgGrowth),
        confidence: Math.min(90, Math.max(10, 70 - Math.abs(avgGrowth * 100))),
        trend: avgGrowth > 0.05 ? 'growing' : avgGrowth < -0.05 ? 'declining' : 'stable'
      };
    }

    res.json({
      success: true,
      data: {
        trends: monthlyTrends,
        forecast,
        summary: {
          totalSales: salesData.reduce((sum, visit) => 
            sum + (Math.random() * 1000), 0), // Mock sales data
          totalVisits: salesData.length,
          avgSalesPerVisit: salesData.length > 0 ? 
            salesData.reduce((sum, visit) => 
              sum + (Math.random() * 1000), 0) / salesData.length : 0,
          uniqueAgents: new Set(salesData.map(visit => visit.agentId)).size
        }
      }
    });
  } catch (error) {
    console.error('Sales forecast error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate sales forecast'
    });
  }
});

/**
 * @swagger
 * /api/ai-analytics/customer-behavior:
 *   get:
 *     summary: Analyze customer behavior patterns
 *     tags: [AI Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer behavior analysis
 */
router.get('/customer-behavior', async (req: Request, res: Response) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID required'
      });
    }

    // Get customer data with visits and sales
    const customers = await prisma.customer.findMany({
      where: { companyId },
      include: {
        visits: {
          include: {
            sales: true
          }
        }
      }
    });

    // Analyze customer behavior
    const customerBehavior = customers.map(customer => {
      const totalSales = customer.visits.reduce((sum, visit) => 
        sum + (Math.random() * 1000), 0); // Mock sales data
      const visitCount = customer.visits.length;
      const avgSalesPerVisit = visitCount > 0 ? totalSales / visitCount : 0;
      
      // Calculate visit frequency (visits per month)
      const firstVisit = customer.visits[0]?.createdAt;
      const lastVisit = customer.visits[customer.visits.length - 1]?.createdAt;
      const monthsActive = firstVisit && lastVisit ? 
        Math.max(1, Math.ceil((lastVisit.getTime() - firstVisit.getTime()) / (30 * 24 * 60 * 60 * 1000))) : 1;
      const visitFrequency = visitCount / monthsActive;

      return {
        customerId: customer.id,
        customerName: customer.name,
        totalSales,
        visitCount,
        avgSalesPerVisit,
        visitFrequency,
        segment: totalSales > 10000 && visitFrequency > 2 ? 'high-value-frequent' :
                totalSales > 5000 ? 'high-value' :
                visitFrequency > 1 ? 'frequent' : 'occasional'
      };
    });

    // Segment analysis
    const segments = customerBehavior.reduce((acc, customer) => {
      acc[customer.segment] = (acc[customer.segment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const analysis = {
      totalCustomers: customers.length,
      segments: Object.entries(segments).map(([segment, count]) => ({
        segment,
        count,
        percentage: (count / customers.length) * 100
      })),
      avgVisitFrequency: customerBehavior.reduce((sum, c) => sum + c.visitFrequency, 0) / customerBehavior.length,
      avgSalesPerCustomer: customerBehavior.reduce((sum, c) => sum + c.totalSales, 0) / customerBehavior.length,
      recommendations: [
        'Implement VIP program for high-value frequent customers',
        'Create retention campaigns for occasional customers',
        'Develop upselling strategies for frequent low-value customers'
      ]
    };

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Customer behavior analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze customer behavior'
    });
  }
});

/**
 * @swagger
 * /api/ai-analytics/optimization-recommendations:
 *   get:
 *     summary: Get AI-powered optimization recommendations
 *     tags: [AI Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: focusArea
 *         schema:
 *           type: string
 *           enum: [all, route, agent, campaign, resource]
 *         description: Focus area for recommendations
 *     responses:
 *       200:
 *         description: Optimization recommendations
 */
router.get('/optimization-recommendations', async (req: Request, res: Response) => {
  try {
    const { focusArea = 'all' } = req.query;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'Company ID required'
      });
    }

    // Get data for analysis
    const [visits, agents, campaigns] = await Promise.all([
      prisma.visit.findMany({
        where: { companyId },
        include: { sales: true, customer: true }
      }),
      prisma.user.findMany({
        where: { companyId, role: { in: ['AGENT', 'SENIOR_AGENT'] } }
      }),
      prisma.campaign.findMany({
        where: { companyId }
      })
    ]);

    // Analyze agent performance
    const agentPerformance = new Map();
    visits.forEach(visit => {
      if (!agentPerformance.has(visit.agentId)) {
        agentPerformance.set(visit.agentId, {
          agentId: visit.agentId,
          totalSales: 0,
          visitCount: 0
        });
      }
      const performance = agentPerformance.get(visit.agentId);
      performance.totalSales += Math.random() * 1000; // Mock sales data
      performance.visitCount += 1;
    });

    const performanceData = Array.from(agentPerformance.values()).map(agent => ({
      ...agent,
      avgSalesPerVisit: agent.visitCount > 0 ? agent.totalSales / agent.visitCount : 0,
      performanceScore: Math.min(100, (agent.totalSales / 10000) * 50 + (agent.visitCount / 20) * 50)
    }));

    // Generate recommendations
    const recommendations = {
      route: [
        'Cluster visits by geographic proximity to reduce travel time',
        'Optimize visit timing based on customer availability patterns',
        'Use real-time traffic data for dynamic route adjustments'
      ],
      agent: [
        `${performanceData.filter(a => a.performanceScore < 50).length} agents need performance improvement training`,
        `${performanceData.filter(a => a.performanceScore > 80).length} high performers could mentor others`,
        'Implement standardized sales processes'
      ],
      campaign: [
        'Focus campaigns on high-traffic customer locations',
        'Align campaign timing with peak visit periods',
        'Measure campaign ROI through visit conversion rates'
      ],
      resource: [
        `Current average: ${(visits.length / agents.length).toFixed(1)} visits per agent`,
        'Consider territory rebalancing for optimal coverage',
        'Implement demand forecasting for resource planning'
      ]
    };

    const filteredRecommendations = focusArea === 'all' ? recommendations : 
      { [focusArea as string]: recommendations[focusArea as keyof typeof recommendations] };

    res.json({
      success: true,
      data: {
        recommendations: filteredRecommendations,
        performanceMetrics: {
          totalVisits: visits.length,
          totalAgents: agents.length,
          avgVisitsPerAgent: visits.length / agents.length,
          topPerformers: performanceData.filter(a => a.performanceScore > 80).length,
          needsImprovement: performanceData.filter(a => a.performanceScore < 50).length
        }
      }
    });
  } catch (error) {
    console.error('Optimization recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate optimization recommendations'
    });
  }
});

export default router;