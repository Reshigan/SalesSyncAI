import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all campaigns for a company
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.marketingCampaign.findMany({
      where: {
        companyId: req.user!.companyId
      },
      include: {
        brand: true,
        products: true,
        materials: true,
        questionnaire: {
          include: {
            questions: true
          }
        },
        assignments: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            }
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
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
});

// Get campaign by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaign = await prisma.marketingCampaign.findFirst({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      },
      include: {
        brand: true,
        products: true,
        materials: true,
        questionnaire: {
          include: {
            questions: true
          }
        },
        assignments: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            }
          }
        },
        interactions: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            },
            customer: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign'
    });
  }
});

// Create new campaign
router.post('/', authenticateToken, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      description,
      brandId,
      productIds,
      territories,
      startDate,
      endDate,
      materials,
      questionnaire,
      targets,
      agentIds
    } = req.body;

    // Create campaign with related data
    const campaign = await prisma.marketingCampaign.create({
      data: {
        name,
        description,
        brandId,
        territories: territories || [],
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        targets: targets || {},
        status: 'DRAFT',
        companyId: req.user!.companyId,
        products: {
          connect: productIds?.map((id: string) => ({ id })) || []
        },
        materials: {
          create: materials?.map((material: any) => ({
            type: material.type,
            name: material.name,
            description: material.description,
            quantityPerAgent: material.quantityPerAgent,
            specifications: material.specifications || {},
            trackingRequired: material.trackingRequired || false
          })) || []
        },
        questionnaire: questionnaire ? {
          create: {
            brandId,
            estimatedDuration: questionnaire.estimatedDuration || 5,
            incentivePerCompletion: questionnaire.incentivePerCompletion || 0,
            questions: {
              create: questionnaire.questions?.map((q: any, index: number) => ({
                questionText: q.questionText,
                type: q.type,
                required: q.required || false,
                options: q.options || [],
                photoRequirements: q.photoRequirements || {},
                validationRules: q.validationRules || {},
                order: index
              })) || []
            }
          }
        } : undefined,
        assignments: agentIds ? {
          create: agentIds.map((agentId: string) => ({
            agentId,
            assignedAt: new Date(),
            status: 'ASSIGNED'
          }))
        } : undefined
      },
      include: {
        brand: true,
        products: true,
        materials: true,
        questionnaire: {
          include: {
            questions: true
          }
        },
        assignments: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign'
    });
  }
});

// Update campaign
router.put('/:id', authenticateToken, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      description,
      territories,
      startDate,
      endDate,
      targets,
      status
    } = req.body;

    const campaign = await prisma.marketingCampaign.update({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      },
      data: {
        name,
        description,
        territories,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        targets,
        status,
        updatedAt: new Date()
      },
      include: {
        brand: true,
        products: true,
        materials: true,
        questionnaire: {
          include: {
            questions: true
          }
        },
        assignments: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign'
    });
  }
});

// Assign agents to campaign
router.post('/:id/assign', authenticateToken, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentIds } = req.body;

    // Remove existing assignments
    await prisma.campaignAssignment.deleteMany({
      where: {
        campaignId: req.params.id
      }
    });

    // Create new assignments
    const assignments = await prisma.campaignAssignment.createMany({
      data: agentIds.map((agentId: string) => ({
        campaignId: req.params.id,
        agentId,
        assignedAt: new Date(),
        status: 'ASSIGNED'
      }))
    });

    res.json({
      success: true,
      data: { assignedCount: assignments.count }
    });
  } catch (error) {
    console.error('Error assigning agents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign agents'
    });
  }
});

// Get campaign performance metrics
router.get('/:id/performance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaignId = req.params.id;

    // Get campaign interactions
    const interactions = await prisma.streetMarketingInteraction.findMany({
      where: {
        campaignId,
        agent: {
          companyId: req.user!.companyId
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        },
        customer: true
      }
    });

    // Calculate performance metrics
    const totalInteractions = interactions.length;
    const successfulRegistrations = interactions.filter(i => i.registrationSuccess).length;
    const conversionRate = totalInteractions > 0 ? (successfulRegistrations / totalInteractions) * 100 : 0;
    
    const agentPerformance = interactions.reduce((acc, interaction) => {
      const agentId = interaction.agentId;
      if (!acc[agentId]) {
        acc[agentId] = {
          agent: interaction.agent,
          totalInteractions: 0,
          successfulRegistrations: 0,
          totalCommission: 0
        };
      }
      acc[agentId].totalInteractions++;
      if (interaction.registrationSuccess) {
        acc[agentId].successfulRegistrations++;
        acc[agentId].totalCommission += interaction.commissionAmount || 0;
      }
      return acc;
    }, {} as any);

    const performanceMetrics = {
      totalInteractions,
      successfulRegistrations,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalCommission: interactions.reduce((sum, i) => sum + (i.commissionAmount || 0), 0),
      agentPerformance: Object.values(agentPerformance),
      dailyStats: interactions.reduce((acc, interaction) => {
        const date = interaction.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { interactions: 0, registrations: 0 };
        }
        acc[date].interactions++;
        if (interaction.registrationSuccess) {
          acc[date].registrations++;
        }
        return acc;
      }, {} as any)
    };

    res.json({
      success: true,
      data: performanceMetrics
    });
  } catch (error) {
    console.error('Error fetching campaign performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign performance'
    });
  }
});

export default router;