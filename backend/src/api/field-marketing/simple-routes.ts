import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

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
    console.error('Campaigns error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load campaigns'
    });
  }
});

// Get brands
router.get('/brands', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;

    const brands = await prisma.brand.findMany({
      where: {
        companyId
      },
      include: {
        _count: {
          select: {
            products: true,
            campaigns: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Brands error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load brands'
    });
  }
});

// Get surveys
router.get('/surveys', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { status, limit = 20 } = req.query;

    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    const surveys = await prisma.survey.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: Number(limit)
    });

    res.json({
      success: true,
      data: surveys
    });
  } catch (error) {
    console.error('Surveys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load surveys'
    });
  }
});

// Submit survey response
router.post('/surveys/:id/responses', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const agentId = req.user!.id;
    const { customerId, responses, location } = req.body;

    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        surveyId: id,
        agentId,
        responses: JSON.stringify(responses),
        completionTime: 60 // Default completion time in seconds
      },
      include: {
        survey: {
          select: {
            title: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: surveyResponse
    });
  } catch (error) {
    console.error('Survey response error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit survey response'
    });
  }
});

// Get dashboard data
router.get('/dashboard', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const companyId = req.user!.companyId;

    // Get active campaigns
    const activeCampaigns = await prisma.campaign.count({
      where: {
        companyId
      }
    });

    // Get completed surveys
    const completedSurveys = await prisma.surveyResponse.count({
      where: {
        agentId
      }
    });

    // Get recent survey responses
    const recentResponses = await prisma.surveyResponse.findMany({
      where: {
        agentId
      },
      include: {
        survey: {
          select: {
            title: true
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
        completedSurveys,
        recentResponses
      }
    });
  } catch (error) {
    console.error('Marketing dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data'
    });
  }
});

export default router;