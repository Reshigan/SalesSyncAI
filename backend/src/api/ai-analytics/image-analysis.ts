import { Router, Request, Response } from 'express';
import multer from 'multer';
import { aiAnalyticsService } from '../../services/ai-analytics';
import { authenticateToken } from '../../middleware/auth';
import { PrismaClient, Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Analyze photo quality
router.post('/quality', authenticateToken, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const analysis = await aiAnalyticsService.analyzePhotoQuality(req.file.buffer);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error analyzing photo quality:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze photo quality'
    });
  }
});

// Analyze shelf space and brand coverage
router.post('/shelf-space', authenticateToken, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const { targetBrand, competitorBrands } = req.body;

    if (!targetBrand) {
      return res.status(400).json({
        success: false,
        error: 'Target brand is required'
      });
    }

    const competitors = competitorBrands ? JSON.parse(competitorBrands) : [];
    const analysis = await aiAnalyticsService.analyzeShelfSpace(
      req.file.buffer,
      targetBrand,
      competitors
    );

    // Save analysis results to database
    const user = (req as any).user;
    await prisma.visit.create({
      data: {
        companyId: user.companyId,
        agentId: user.userId,
        customerId: req.body.customerId || 'unknown',
        visitDate: new Date(),
        status: 'COMPLETED',
        activities: JSON.parse(JSON.stringify({
          shelfSpaceAnalysis: analysis,
          analysisTimestamp: new Date().toISOString()
        }))
      }
    });

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error analyzing shelf space:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze shelf space'
    });
  }
});

// Batch analyze multiple images
router.post('/batch-analysis', authenticateToken, upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files provided'
      });
    }

    const { analysisType, targetBrand, competitorBrands } = req.body;
    const results = [];

    for (const file of files) {
      try {
        let analysis;
        
        switch (analysisType) {
          case 'quality':
            analysis = await aiAnalyticsService.analyzePhotoQuality(file.buffer);
            break;
          case 'shelf-space':
            const competitors = competitorBrands ? JSON.parse(competitorBrands) : [];
            analysis = await aiAnalyticsService.analyzeShelfSpace(
              file.buffer,
              targetBrand,
              competitors
            );
            break;
          default:
            analysis = await aiAnalyticsService.analyzePhotoQuality(file.buffer);
        }

        results.push({
          filename: file.originalname,
          success: true,
          analysis
        });
      } catch (error) {
        results.push({
          filename: file.originalname,
          success: false,
          error: error instanceof Error ? error.message : 'Analysis failed'
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalImages: files.length,
        successfulAnalyses: results.filter(r => r.success).length,
        results
      }
    });
  } catch (error) {
    console.error('Error in batch analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform batch analysis'
    });
  }
});

// Get image analysis history
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { page = 1, limit = 20, agentId, startDate, endDate } = req.query;

    const where: any = {
      companyId: user.companyId,
      visitData: {
        path: ['shelfSpaceAnalysis'],
        not: null
      }
    };

    if (agentId) {
      where.agentId = agentId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [analyses, total] = await Promise.all([
      prisma.visit.findMany({
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
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.visit.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        analyses: analyses.map(analysis => ({
          id: analysis.id,
          agentName: `${analysis.agent.firstName} ${analysis.agent.lastName}`,
          customerName: analysis.customer?.name || 'Unknown',
          analysisData: analysis.activities,
          createdAt: analysis.createdAt
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching analysis history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis history'
    });
  }
});

// Get analysis statistics
router.get('/statistics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { timeframe = 'month' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case 'week':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }

    const analyses = await prisma.visit.findMany({
      where: {
        companyId: user.companyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        activities: {
          path: ['shelfSpaceAnalysis'],
          not: Prisma.JsonNull
        }
      },
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Calculate statistics
    const totalAnalyses = analyses.length;
    const uniqueAgents = new Set(analyses.map(a => a.agentId)).size;
    
    // Calculate average share of voice
    let totalShareOfVoice = 0;
    let shareOfVoiceCount = 0;
    
    analyses.forEach(analysis => {
      const shelfData = (analysis.activities as any)?.shelfSpaceAnalysis;
      if (shelfData?.shareOfVoice) {
        totalShareOfVoice += shelfData.shareOfVoice;
        shareOfVoiceCount++;
      }
    });

    const avgShareOfVoice = shareOfVoiceCount > 0 ? totalShareOfVoice / shareOfVoiceCount : 0;

    // Top performing agents
    const agentPerformance = new Map();
    analyses.forEach(analysis => {
      const agentId = analysis.agentId;
      const agentName = `${(analysis as any).agent.firstName} ${(analysis as any).agent.lastName}`;
      
      if (!agentPerformance.has(agentId)) {
        agentPerformance.set(agentId, {
          name: agentName,
          analysisCount: 0,
          totalShareOfVoice: 0
        });
      }
      
      const agent = agentPerformance.get(agentId);
      agent.analysisCount++;
      
      const shelfData = (analysis.activities as any)?.shelfSpaceAnalysis;
      if (shelfData?.shareOfVoice) {
        agent.totalShareOfVoice += shelfData.shareOfVoice;
      }
    });

    const topAgents = Array.from(agentPerformance.values())
      .map(agent => ({
        ...agent,
        avgShareOfVoice: agent.analysisCount > 0 ? agent.totalShareOfVoice / agent.analysisCount : 0
      }))
      .sort((a, b) => b.avgShareOfVoice - a.avgShareOfVoice)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        totalAnalyses,
        uniqueAgents,
        avgShareOfVoice: Math.round(avgShareOfVoice * 100) / 100,
        topPerformingAgents: topAgents,
        timeframe,
        period: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching analysis statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analysis statistics'
    });
  }
});

export default router;