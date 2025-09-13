import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all activations for a company
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, startDate, endDate, promoterId } = req.query;

    const where: any = {
      campaign: {
        companyId: req.user!.companyId
      }
    };

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.scheduledStart = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }

    if (promoterId) {
      where.assignments = {
        some: {
          promoterId: promoterId
        }
      };
    }

    const activations = await prisma.campaignActivation.findMany({
      where,
      include: {
        campaign: {
          include: {
            brand: true
          }
        },
        location: true,
        assignments: {
          include: {
            promoter: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            }
          }
        },
        materials: true,
        performance: {
          include: {
            interactions: true,
            contentCreated: true,
            salesGenerated: true
          }
        }
      },
      orderBy: {
        scheduledStart: 'desc'
      }
    });

    res.json({
      success: true,
      data: activations
    });
  } catch (error) {
    console.error('Error fetching activations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activations'
    });
  }
});

// Get activation by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activation = await prisma.campaignActivation.findFirst({
      where: {
        id: req.params.id,
        campaign: {
          companyId: req.user!.companyId
        }
      },
      include: {
        campaign: {
          include: {
            brand: true,
            products: true
          }
        },
        location: true,
        assignments: {
          include: {
            promoter: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            }
          }
        },
        materials: true,
        performance: {
          include: {
            interactions: {
              orderBy: {
                timestamp: 'desc'
              }
            },
            contentCreated: {
              orderBy: {
                createdAt: 'desc'
              }
            },
            salesGenerated: true
          }
        },
        gpsTracking: {
          include: {
            trackingPoints: {
              orderBy: {
                timestamp: 'asc'
              }
            }
          }
        }
      }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found'
      });
    }

    res.json({
      success: true,
      data: activation
    });
  } catch (error) {
    console.error('Error fetching activation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activation'
    });
  }
});

// Create new activation
router.post('/', authenticateToken, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      campaignId,
      name,
      description,
      location,
      scheduledStart,
      scheduledEnd,
      promoterIds,
      materials,
      targetMetrics
    } = req.body;

    // Verify campaign belongs to company
    const campaign = await prisma.marketingCampaign.findFirst({
      where: {
        id: campaignId,
        companyId: req.user!.companyId
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const activation = await prisma.campaignActivation.create({
      data: {
        campaignId,
        name,
        description,
        scheduledStart: new Date(scheduledStart),
        scheduledEnd: new Date(scheduledEnd),
        targetMetrics: targetMetrics || {},
        status: 'SCHEDULED',
        location: {
          create: {
            type: location.type,
            name: location.name,
            address: location.address,
            coordinates: location.coordinates || {},
            accessInstructions: location.accessInstructions,
            contactPerson: location.contactPerson || {},
            parkingAvailable: location.parkingAvailable || false,
            electricityAvailable: location.electricityAvailable || false,
            permitsRequired: location.permitsRequired || false
          }
        },
        assignments: promoterIds ? {
          create: promoterIds.map((promoterId: string) => ({
            promoterId,
            assignedAt: new Date(),
            status: 'ASSIGNED'
          }))
        } : undefined,
        materials: materials ? {
          create: materials.map((material: any) => ({
            type: material.type,
            name: material.name,
            description: material.description,
            quantity: material.quantity,
            specifications: material.specifications || {},
            setupInstructions: material.setupInstructions
          }))
        } : undefined
      },
      include: {
        campaign: {
          include: {
            brand: true
          }
        },
        location: true,
        assignments: {
          include: {
            promoter: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            }
          }
        },
        materials: true
      }
    });

    res.status(201).json({
      success: true,
      data: activation
    });
  } catch (error) {
    console.error('Error creating activation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create activation'
    });
  }
});

// Start activation (promoter check-in)
router.post('/:id/start', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { location, setupPhotos } = req.body;

    const activation = await prisma.campaignActivation.findFirst({
      where: {
        id: req.params.id,
        assignments: {
          some: {
            promoterId: req.user!.id,
            status: 'ASSIGNED'
          }
        }
      },
      include: {
        location: true
      }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found or not assigned to promoter'
      });
    }

    // Validate location (within acceptable radius)
    const locationValid = validateActivationLocation(
      location,
      activation.location?.coordinates as any
    );

    if (!locationValid) {
      return res.status(400).json({
        success: false,
        error: 'Location validation failed - not at activation venue'
      });
    }

    // Start GPS tracking
    const gpsTracking = await prisma.gPSTrackingData.create({
      data: {
        activationId: activation.id,
        checkInLocation: location,
        checkInTime: new Date(),
        locationCompliance: true,
        trackingPoints: {
          create: [{
            coordinates: location,
            timestamp: new Date(),
            accuracy: location.accuracy || 10,
            activity: 'SETUP'
          }]
        }
      }
    });

    // Update activation status
    const updatedActivation = await prisma.campaignActivation.update({
      where: {
        id: req.params.id
      },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date()
      },
      include: {
        campaign: true,
        location: true,
        assignments: {
          include: {
            promoter: {
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

    // Create performance tracking session
    await prisma.activationPerformance.create({
      data: {
        activationId: activation.id,
        promoterId: req.user!.id,
        setupPhotos: setupPhotos || [],
        performanceMetrics: {}
      }
    });

    res.json({
      success: true,
      data: {
        activation: updatedActivation,
        gpsTrackingId: gpsTracking.id
      }
    });
  } catch (error) {
    console.error('Error starting activation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start activation'
    });
  }
});

// Record customer interaction during activation
router.post('/:id/interactions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      demographics,
      interactionType,
      duration,
      engagementLevel,
      outcome,
      contactCaptured,
      notes
    } = req.body;

    // Verify activation is in progress and promoter is assigned
    const activation = await prisma.campaignActivation.findFirst({
      where: {
        id: req.params.id,
        status: 'IN_PROGRESS',
        assignments: {
          some: {
            promoterId: req.user!.id
          }
        }
      }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found or not in progress'
      });
    }

    // Get or create performance record
    let performance = await prisma.activationPerformance.findFirst({
      where: {
        activationId: req.params.id,
        promoterId: req.user!.id
      }
    });

    if (!performance) {
      performance = await prisma.activationPerformance.create({
        data: {
          activationId: req.params.id,
          promoterId: req.user!.id,
          performanceMetrics: {}
        }
      });
    }

    // Create customer interaction record
    const interaction = await prisma.customerInteraction.create({
      data: {
        performanceId: performance.id,
        timestamp: new Date(),
        demographics: demographics || {},
        interactionType,
        duration: duration || 0,
        engagementLevel: engagementLevel || 'MEDIUM',
        outcome: outcome || 'NEUTRAL',
        contactCaptured: contactCaptured || false,
        followUpRequired: false,
        notes: notes || ''
      }
    });

    res.status(201).json({
      success: true,
      data: interaction
    });
  } catch (error) {
    console.error('Error recording interaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record interaction'
    });
  }
});

// Upload content during activation
router.post('/:id/content', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      type,
      title,
      description,
      fileUrl,
      metadata
    } = req.body;

    // Verify activation and promoter
    const activation = await prisma.campaignActivation.findFirst({
      where: {
        id: req.params.id,
        status: 'IN_PROGRESS',
        assignments: {
          some: {
            promoterId: req.user!.id
          }
        }
      }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found or not in progress'
      });
    }

    // Get performance record
    const performance = await prisma.activationPerformance.findFirst({
      where: {
        activationId: req.params.id,
        promoterId: req.user!.id
      }
    });

    if (!performance) {
      return res.status(404).json({
        success: false,
        error: 'Performance record not found'
      });
    }

    // Create content record
    const content = await prisma.contentItem.create({
      data: {
        performanceId: performance.id,
        type,
        title,
        description,
        fileUrl,
        metadata: metadata || {},
        qualityScore: 100, // Would be calculated by AI analysis
        approved: false
      }
    });

    res.status(201).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error uploading content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload content'
    });
  }
});

// Complete activation (promoter check-out)
router.post('/:id/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      location,
      teardownPhotos,
      qualitativeReport,
      recommendations
    } = req.body;

    const activation = await prisma.campaignActivation.findFirst({
      where: {
        id: req.params.id,
        status: 'IN_PROGRESS',
        assignments: {
          some: {
            promoterId: req.user!.id
          }
        }
      }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found or not in progress'
      });
    }

    // Update GPS tracking with checkout
    await prisma.gPSTrackingData.updateMany({
      where: {
        activationId: req.params.id
      },
      data: {
        checkOutLocation: location,
        checkOutTime: new Date(),
        totalTimeOnSite: Math.floor(
          (new Date().getTime() - new Date(activation.actualStart!).getTime()) / 1000 / 60
        )
      }
    });

    // Update performance record
    await prisma.activationPerformance.updateMany({
      where: {
        activationId: req.params.id,
        promoterId: req.user!.id
      },
      data: {
        teardownPhotos: teardownPhotos || [],
        qualitativeReport: qualitativeReport || '',
        recommendations: recommendations || []
      }
    });

    // Complete activation
    const completedActivation = await prisma.campaignActivation.update({
      where: {
        id: req.params.id
      },
      data: {
        status: 'COMPLETED',
        actualEnd: new Date()
      },
      include: {
        campaign: true,
        performance: {
          include: {
            interactions: true,
            contentCreated: true,
            salesGenerated: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: completedActivation
    });
  } catch (error) {
    console.error('Error completing activation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete activation'
    });
  }
});

// Get activation performance metrics
router.get('/:id/performance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activation = await prisma.campaignActivation.findFirst({
      where: {
        id: req.params.id,
        campaign: {
          companyId: req.user!.companyId
        }
      },
      include: {
        performance: {
          include: {
            promoter: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            },
            interactions: true,
            contentCreated: true,
            salesGenerated: true
          }
        },
        gpsTracking: {
          include: {
            trackingPoints: true
          }
        }
      }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found'
      });
    }

    // Calculate performance metrics
    const totalInteractions = activation.performance.reduce(
      (sum, p) => sum + p.interactions.length, 0
    );
    
    const totalContent = activation.performance.reduce(
      (sum, p) => sum + p.contentCreated.length, 0
    );
    
    const totalSales = activation.performance.reduce(
      (sum, p) => sum + p.salesGenerated.reduce((s, sale) => s + sale.amount, 0), 0
    );

    const duration = activation.actualStart && activation.actualEnd
      ? Math.floor((new Date(activation.actualEnd).getTime() - new Date(activation.actualStart).getTime()) / 1000 / 60)
      : 0;

    const metrics = {
      totalInteractions,
      totalContent,
      totalSales,
      duration,
      averageInteractionDuration: totalInteractions > 0 
        ? activation.performance.reduce((sum, p) => 
            sum + p.interactions.reduce((s, i) => s + i.duration, 0), 0
          ) / totalInteractions
        : 0,
      engagementBreakdown: activation.performance.reduce((acc, p) => {
        p.interactions.forEach(i => {
          acc[i.engagementLevel] = (acc[i.engagementLevel] || 0) + 1;
        });
        return acc;
      }, {} as any),
      outcomeBreakdown: activation.performance.reduce((acc, p) => {
        p.interactions.forEach(i => {
          acc[i.outcome] = (acc[i.outcome] || 0) + 1;
        });
        return acc;
      }, {} as any)
    };

    res.json({
      success: true,
      data: {
        activation,
        metrics
      }
    });
  } catch (error) {
    console.error('Error fetching activation performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activation performance'
    });
  }
});

// Helper function to validate activation location
function validateActivationLocation(
  currentLocation: any,
  targetLocation: any
): boolean {
  if (!currentLocation || !targetLocation) return false;
  
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    targetLocation.latitude,
    targetLocation.longitude
  );
  
  const ACCEPTABLE_RADIUS = 100; // meters
  return distance <= ACCEPTABLE_RADIUS;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2 - lat1) * Math.PI/180;
  const Δλ = (lon2 - lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

export default router;