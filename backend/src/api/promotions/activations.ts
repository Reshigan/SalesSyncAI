import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all activations for a company
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activations = await prisma.activation.findMany({
      where: {
        companyId: req.user!.companyId
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            type: true
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
    const activation = await prisma.activation.findFirst({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true
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
      requiredMaterials,
      targetMetrics
    } = req.body;

    const activation = await prisma.activation.create({
      data: {
        companyId: req.user!.companyId,
        campaignId,
        name,
        description,
        location: location || {},
        scheduledStart: new Date(scheduledStart),
        scheduledEnd: new Date(scheduledEnd),
        requiredMaterials: requiredMaterials || [],
        targetMetrics: targetMetrics || {},
        status: 'SCHEDULED'
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
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

// Start activation
router.post('/:id/start', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { location, setupPhotos } = req.body;

    const activation = await prisma.activation.update({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      },
      data: {
        actualStart: new Date(),
        status: 'IN_PROGRESS',
        gpsTracking: {
          checkInLocation: location,
          checkInTime: new Date(),
          setupPhotos: setupPhotos || []
        }
      }
    });

    res.json({
      success: true,
      data: {
        activationId: activation.id,
        status: 'started',
        message: 'Activation started successfully'
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

// Complete activation
router.post('/:id/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { teardownPhotos, performanceNotes } = req.body;

    // First get the current activation
    const currentActivation = await prisma.activation.findFirst({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      }
    });

    if (!currentActivation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found'
      });
    }

    const activation = await prisma.activation.update({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      },
      data: {
        actualEnd: new Date(),
        status: 'COMPLETED',
        gpsTracking: {
          ...((currentActivation.gpsTracking as any) || {}),
          checkOutTime: new Date(),
          teardownPhotos: teardownPhotos || []
        }
      }
    });

    res.json({
      success: true,
      data: {
        activationId: activation.id,
        status: 'completed',
        message: 'Activation completed successfully'
      }
    });
  } catch (error) {
    console.error('Error completing activation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete activation'
    });
  }
});

// Get activation performance
router.get('/:id/performance', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activation = await prisma.activation.findFirst({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      },
      include: {
        performance: true
      }
    });

    if (!activation) {
      return res.status(404).json({
        success: false,
        error: 'Activation not found'
      });
    }

    // Calculate basic performance metrics
    const duration = activation.actualStart && activation.actualEnd 
      ? Math.floor((activation.actualEnd.getTime() - activation.actualStart.getTime()) / (1000 * 60)) // minutes
      : 0;

    const performanceData = {
      activationId: activation.id,
      duration,
      status: activation.status,
      scheduledDuration: Math.floor((activation.scheduledEnd.getTime() - activation.scheduledStart.getTime()) / (1000 * 60)),
      onTime: activation.actualStart ? activation.actualStart <= activation.scheduledStart : false,
      gpsTracking: activation.gpsTracking,
      performance: activation.performance
    };

    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    console.error('Error fetching activation performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch activation performance'
    });
  }
});

export default router;