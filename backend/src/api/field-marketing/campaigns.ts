import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all campaigns for a company
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        companyId: req.user!.companyId
      },
      include: {
        brand: {
          select: {
            id: true,
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
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logo: true
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
      type,
      startDate,
      endDate,
      budget,
      materials,
      targets,
      territories
    } = req.body;

    const campaign = await prisma.campaign.create({
      data: {
        companyId: req.user!.companyId,
        name,
        description,
        brandId,
        type: type || 'FIELD_MARKETING',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        budget: budget ? parseFloat(budget) : null,
        materials: materials || [],
        targets: targets || {},
        territories: territories || [],
        status: 'DRAFT'
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logo: true
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

export default router;