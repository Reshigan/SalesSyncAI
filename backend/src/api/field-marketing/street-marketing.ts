import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// Start street marketing interaction
router.post('/interactions/start', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      campaignId,
      location,
      customerType
    } = req.body;

    // Verify campaign exists and agent is assigned
    const campaign = await prisma.marketingCampaign.findFirst({
      where: {
        id: campaignId,
        companyId: req.user!.companyId,
        assignments: {
          some: {
            agentId: req.user!.id,
            status: 'ASSIGNED'
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found or not assigned to agent'
      });
    }

    // Create interaction record
    const interaction = await prisma.streetMarketingInteraction.create({
      data: {
        campaignId,
        agentId: req.user!.id,
        location: location || {},
        customerType: customerType || 'PROSPECT',
        status: 'IN_PROGRESS',
        startTime: new Date(),
        scriptSections: [],
        qualityMetrics: {}
      }
    });

    res.status(201).json({
      success: true,
      data: interaction
    });
  } catch (error) {
    console.error('Error starting interaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start interaction'
    });
  }
});

// Update interaction with customer data
router.put('/interactions/:id/customer', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      fullName,
      surname,
      idNumber,
      idType,
      contactPhone,
      contactEmail,
      age,
      consentMarketing
    } = req.body;

    const interaction = await prisma.streetMarketingInteraction.findFirst({
      where: {
        id: req.params.id,
        agentId: req.user!.id
      }
    });

    if (!interaction) {
      return res.status(404).json({
        success: false,
        error: 'Interaction not found'
      });
    }

    // Create or find customer
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { idNumber },
          { contactPhone }
        ],
        companyId: req.user!.companyId
      }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          fullName,
          surname,
          idNumber,
          idType: idType || 'ID',
          contactPhone,
          contactEmail,
          age,
          consentMarketing: consentMarketing || false,
          companyId: req.user!.companyId,
          customerType: 'PROSPECT',
          status: 'ACTIVE'
        }
      });
    }

    // Update interaction with customer
    const updatedInteraction = await prisma.streetMarketingInteraction.update({
      where: {
        id: req.params.id
      },
      data: {
        customerId: customer.id,
        customerData: {
          fullName,
          surname,
          idNumber,
          idType,
          contactPhone,
          contactEmail,
          age,
          consentMarketing
        }
      },
      include: {
        customer: true,
        campaign: true
      }
    });

    res.json({
      success: true,
      data: updatedInteraction
    });
  } catch (error) {
    console.error('Error updating interaction customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update interaction customer'
    });
  }
});

// Complete registration (e.g., GoldRush Online, SIM distribution)
router.post('/interactions/:id/register', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      registrationType,
      registrationData,
      verificationPhotos,
      servicePackage
    } = req.body;

    const interaction = await prisma.streetMarketingInteraction.findFirst({
      where: {
        id: req.params.id,
        agentId: req.user!.id
      },
      include: {
        campaign: true,
        customer: true
      }
    });

    if (!interaction) {
      return res.status(404).json({
        success: false,
        error: 'Interaction not found'
      });
    }

    // Generate unique tracking code for commission
    const trackingCode = generateTrackingCode(
      req.user!.id,
      interaction.customerId!,
      registrationType
    );

    // Calculate commission based on campaign settings
    const commissionAmount = calculateCommission(
      interaction.campaign,
      registrationType,
      servicePackage
    );

    // Update interaction with registration details
    const updatedInteraction = await prisma.streetMarketingInteraction.update({
      where: {
        id: req.params.id
      },
      data: {
        registrationSuccess: true,
        registrationType,
        registrationData: registrationData || {},
        verificationPhotos: verificationPhotos || [],
        servicePackage: servicePackage || {},
        commissionTrackingCode: trackingCode,
        commissionAmount,
        status: 'COMPLETED',
        endTime: new Date()
      },
      include: {
        customer: true,
        campaign: true,
        agent: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        }
      }
    });

    // Create commission record
    await prisma.commission.create({
      data: {
        agentId: req.user!.id,
        customerId: interaction.customerId!,
        campaignId: interaction.campaignId,
        interactionId: interaction.id,
        amount: commissionAmount,
        trackingCode,
        type: 'REGISTRATION',
        status: 'PENDING',
        companyId: req.user!.companyId
      }
    });

    res.json({
      success: true,
      data: {
        interaction: updatedInteraction,
        trackingCode,
        commissionAmount
      }
    });
  } catch (error) {
    console.error('Error completing registration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete registration'
    });
  }
});

// Record script section delivery
router.post('/interactions/:id/script', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      sectionId,
      sectionName,
      duration,
      customerQuestions,
      customerResponse
    } = req.body;

    const interaction = await prisma.streetMarketingInteraction.findFirst({
      where: {
        id: req.params.id,
        agentId: req.user!.id
      }
    });

    if (!interaction) {
      return res.status(404).json({
        success: false,
        error: 'Interaction not found'
      });
    }

    // Update script sections
    const scriptSections = interaction.scriptSections as any[] || [];
    const existingSectionIndex = scriptSections.findIndex(s => s.sectionId === sectionId);

    const scriptSection = {
      sectionId,
      sectionName,
      delivered: true,
      duration: duration || 0,
      customerQuestions: customerQuestions || [],
      customerResponse: customerResponse || 'neutral',
      timestamp: new Date()
    };

    if (existingSectionIndex >= 0) {
      scriptSections[existingSectionIndex] = scriptSection;
    } else {
      scriptSections.push(scriptSection);
    }

    const updatedInteraction = await prisma.streetMarketingInteraction.update({
      where: {
        id: req.params.id
      },
      data: {
        scriptSections
      }
    });

    res.json({
      success: true,
      data: updatedInteraction
    });
  } catch (error) {
    console.error('Error recording script section:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record script section'
    });
  }
});

// Complete interaction
router.put('/interactions/:id/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      outcome,
      notes,
      followUpRequired,
      qualityMetrics
    } = req.body;

    const interaction = await prisma.streetMarketingInteraction.update({
      where: {
        id: req.params.id,
        agentId: req.user!.id
      },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
        outcome: outcome || 'NEUTRAL',
        notes: notes || '',
        followUpRequired: followUpRequired || false,
        qualityMetrics: qualityMetrics || {}
      },
      include: {
        customer: true,
        campaign: true,
        agent: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: interaction
    });
  } catch (error) {
    console.error('Error completing interaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete interaction'
    });
  }
});

// Get agent's interactions
router.get('/interactions/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, campaignId, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      agentId: req.user!.id
    };

    if (campaignId) {
      where.campaignId = campaignId;
    }

    if (status) {
      where.status = status;
    }

    const interactions = await prisma.streetMarketingInteraction.findMany({
      where,
      include: {
        customer: true,
        campaign: {
          include: {
            brand: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: Number(limit)
    });

    const total = await prisma.streetMarketingInteraction.count({ where });

    res.json({
      success: true,
      data: interactions,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interactions'
    });
  }
});

// Get interaction analytics for agent
router.get('/analytics/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, campaignId } = req.query;

    const where: any = {
      agentId: req.user!.id
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (campaignId) {
      where.campaignId = campaignId;
    }

    const interactions = await prisma.streetMarketingInteraction.findMany({
      where,
      include: {
        campaign: true
      }
    });

    // Calculate analytics
    const totalInteractions = interactions.length;
    const completedInteractions = interactions.filter(i => i.status === 'COMPLETED').length;
    const successfulRegistrations = interactions.filter(i => i.registrationSuccess).length;
    const totalCommission = interactions.reduce((sum, i) => sum + (i.commissionAmount || 0), 0);

    const conversionRate = totalInteractions > 0 ? (successfulRegistrations / totalInteractions) * 100 : 0;
    const completionRate = totalInteractions > 0 ? (completedInteractions / totalInteractions) * 100 : 0;

    // Daily stats
    const dailyStats = interactions.reduce((acc, interaction) => {
      const date = interaction.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          interactions: 0,
          registrations: 0,
          commission: 0
        };
      }
      acc[date].interactions++;
      if (interaction.registrationSuccess) {
        acc[date].registrations++;
        acc[date].commission += interaction.commissionAmount || 0;
      }
      return acc;
    }, {} as any);

    const analytics = {
      totalInteractions,
      completedInteractions,
      successfulRegistrations,
      totalCommission,
      conversionRate: Math.round(conversionRate * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      averageInteractionDuration: interactions.length > 0 
        ? interactions
            .filter(i => i.startTime && i.endTime)
            .reduce((sum, i) => {
              const duration = new Date(i.endTime!).getTime() - new Date(i.startTime).getTime();
              return sum + duration;
            }, 0) / interactions.length / 1000 / 60 // Convert to minutes
        : 0,
      dailyStats
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching interaction analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interaction analytics'
    });
  }
});

// Helper functions
function generateTrackingCode(agentId: string, customerId: string, registrationType: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const prefix = registrationType.substring(0, 2).toUpperCase();
  
  return `${prefix}-${agentId.substring(0, 8)}-${customerId.substring(0, 8)}-${timestamp}-${random}`.toUpperCase();
}

function calculateCommission(campaign: any, registrationType: string, servicePackage?: any): number {
  // This would be configurable based on campaign settings
  const commissionRates: { [key: string]: number } = {
    'GOLDRUSH_ONLINE': 50, // R50 per registration
    'SIM_DISTRIBUTION': 25, // R25 per SIM
    'PRODUCT_DEMO': 10,     // R10 per demo
    'SURVEY_COMPLETION': 5   // R5 per survey
  };

  let baseCommission = commissionRates[registrationType] || 0;

  // Add service package bonus if applicable
  if (servicePackage && servicePackage.monthlyFee) {
    baseCommission += servicePackage.monthlyFee * 0.1; // 10% of monthly fee
  }

  return baseCommission;
}

export default router;