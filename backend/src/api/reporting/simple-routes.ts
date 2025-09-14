import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get dashboard overview
router.get('/dashboard', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { period = '7d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get sales data
    const sales = await prisma.sale.findMany({
      where: {
        companyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    const salesCount = sales.length;

    // Get visits data
    const visits = await prisma.visit.findMany({
      where: {
        companyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const completedVisits = visits.filter(v => v.status === 'COMPLETED').length;
    const totalVisits = visits.length;

    // Get survey responses
    const surveyResponses = await prisma.surveyResponse.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Get activations
    const activations = await prisma.activation.findMany({
      where: {
        companyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const completedActivations = activations.filter(a => a.status === 'COMPLETED').length;

    res.json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate,
          end: endDate
        },
        metrics: {
          totalSales,
          salesCount,
          totalVisits,
          completedVisits,
          visitCompletionRate: totalVisits > 0 ? (completedVisits / totalVisits * 100).toFixed(1) : 0,
          surveyResponses: surveyResponses.length,
          totalActivations: activations.length,
          completedActivations,
          activationCompletionRate: activations.length > 0 ? (completedActivations / activations.length * 100).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data'
    });
  }
});

// Get sales report
router.get('/sales', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { startDate, endDate, agentId, limit = 100 } = req.query;

    const where: any = { companyId };
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (agentId) {
      where.agentId = agentId;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        customer: {
          select: {
            name: true,
            address: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Number(limit)
    });

    const totalAmount = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);

    res.json({
      success: true,
      data: {
        sales,
        summary: {
          totalSales: sales.length,
          totalAmount,
          averageAmount: sales.length > 0 ? totalAmount / sales.length : 0
        }
      }
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate sales report'
    });
  }
});

// Get visits report
router.get('/visits', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { startDate, endDate, agentId, status, limit = 100 } = req.query;

    const where: any = { companyId };
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (agentId) {
      where.agentId = agentId;
    }

    if (status) {
      where.status = status;
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        customer: {
          select: {
            name: true,
            address: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Number(limit)
    });

    const statusCounts = visits.reduce((acc, visit) => {
      acc[visit.status] = (acc[visit.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        visits,
        summary: {
          totalVisits: visits.length,
          statusBreakdown: statusCounts
        }
      }
    });
  } catch (error) {
    console.error('Visits report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate visits report'
    });
  }
});

// Get agent performance report
router.get('/agents', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { startDate, endDate } = req.query;

    const dateFilter = startDate && endDate ? {
      gte: new Date(startDate as string),
      lte: new Date(endDate as string)
    } : undefined;

    // Get all agents
    const agents = await prisma.user.findMany({
      where: {
        companyId,
        role: {
          in: ['AGENT', 'SENIOR_AGENT', 'FIELD_MARKETING_AGENT', 'PROMOTER']
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });

    // Get performance data for each agent
    const agentPerformance = await Promise.all(
      agents.map(async (agent) => {
        const [sales, visits, surveys] = await Promise.all([
          prisma.sale.findMany({
            where: {
              agentId: agent.id,
              ...(dateFilter && { createdAt: dateFilter })
            }
          }),
          prisma.visit.findMany({
            where: {
              agentId: agent.id,
              ...(dateFilter && { createdAt: dateFilter })
            }
          }),
          prisma.surveyResponse.findMany({
            where: {
              agentId: agent.id,
              ...(dateFilter && { createdAt: dateFilter })
            }
          })
        ]);

        const totalSales = sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
        const completedVisits = visits.filter(v => v.status === 'COMPLETED').length;

        return {
          agent,
          metrics: {
            totalSales,
            salesCount: sales.length,
            totalVisits: visits.length,
            completedVisits,
            visitCompletionRate: visits.length > 0 ? (completedVisits / visits.length * 100).toFixed(1) : 0,
            surveyResponses: surveys.length
          }
        };
      })
    );

    res.json({
      success: true,
      data: agentPerformance
    });
  } catch (error) {
    console.error('Agent performance error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate agent performance report'
    });
  }
});

export default router;