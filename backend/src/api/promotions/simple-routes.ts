import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get activations
router.get('/activations', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { status, limit = 20 } = req.query;

    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    const activations = await prisma.activation.findMany({
      where,
      include: {
        campaign: {
          select: {
            name: true,
            brand: {
              select: {
                name: true
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

    res.json({
      success: true,
      data: activations
    });
  } catch (error) {
    console.error('Activations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load activations'
    });
  }
});

// Get campaigns
router.get('/campaigns', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;

    const campaigns = await prisma.campaign.findMany({
      where: {
        companyId
      },
      include: {
        brand: {
          select: {
            name: true,
            logo: true
          }
        },
        _count: {
          select: {
            activations: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('Promotion campaigns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load campaigns'
    });
  }
});

// Start activation
router.put('/activations/:id/start', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const agentId = req.user!.id;

    const activation = await prisma.activation.findFirst({
      where: { id }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found'
      });
    }

    const updatedActivation = await prisma.activation.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS'
      },
      include: {
        campaign: {
          select: {
            name: true,
            brand: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedActivation
    });
  } catch (error) {
    console.error('Start activation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start activation'
    });
  }
});

// Complete activation
router.put('/activations/:id/complete', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { notes, location, performance } = req.body;
    const agentId = req.user!.id;

    const activation = await prisma.activation.findFirst({
      where: { id }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found'
      });
    }

    const updatedActivation = await prisma.activation.update({
      where: { id },
      data: {
        status: 'COMPLETED'
      },
      include: {
        campaign: {
          select: {
            name: true,
            brand: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedActivation
    });
  } catch (error) {
    console.error('Complete activation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete activation'
    });
  }
});

// Get dashboard data
router.get('/dashboard', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;

    // Get active campaigns
    const activeCampaigns = await prisma.campaign.count({
      where: {
        companyId
      }
    });

    // Get today's activations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayActivations = await prisma.activation.count({
      where: {
        companyId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Get completed activations this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyActivations = await prisma.activation.count({
      where: {
        companyId,
        status: 'COMPLETED',
        createdAt: {
          gte: weekAgo
        }
      }
    });

    // Get recent activations
    const recentActivations = await prisma.activation.findMany({
      where: {
        companyId
      },
      include: {
        campaign: {
          select: {
            name: true,
            brand: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    res.json({
      success: true,
      data: {
        activeCampaigns,
        todayActivations,
        weeklyActivations,
        recentActivations
      }
    });
  } catch (error) {
    console.error('Promotions dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data'
    });
  }
});

export default router;