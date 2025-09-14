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

// Recognize brands in image
router.post('/detect', authenticateToken, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const user = (req as any).user;
    
    // Get company brands for recognition
    const company = await prisma.company.findUnique({
      where: { id: user.companyId }
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        error: 'Company not found'
      });
    }

    // Get products for brand recognition
    const products = await prisma.product.findMany({
      where: { companyId: user.companyId }
    });

    // Extract brand names from products
    const brandNames = new Set<string>();
    products.forEach(product => {
      if (product.name) brandNames.add(product.name);
      if (product.brandId) brandNames.add(product.brandId);
    });

    const companyBrands = Array.from(brandNames);
    
    if (companyBrands.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No brands configured for your company'
      });
    }

    const recognitionResults = await aiAnalyticsService.recognizeBrands(
      req.file.buffer,
      companyBrands
    );

    // Save recognition results
    await prisma.visit.create({
      data: {
        companyId: user.companyId,
        agentId: user.userId,
        customerId: req.body.customerId || 'unknown',
        status: 'COMPLETED',
        activities: JSON.parse(JSON.stringify({
          brandRecognition: {
            results: recognitionResults,
            totalBrandsDetected: recognitionResults.length,
            analysisTimestamp: new Date().toISOString(),
            imageMetadata: {
              originalName: req.file.originalname,
              size: req.file.size,
              mimeType: req.file.mimetype
            }
          }
        }))
      }
    });

    res.json({
      success: true,
      data: {
        detectedBrands: recognitionResults,
        totalDetected: recognitionResults.length,
        availableBrands: companyBrands,
        detectionRate: (recognitionResults.length / companyBrands.length) * 100
      }
    });
  } catch (error) {
    console.error('Error recognizing brands:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to recognize brands in image'
    });
  }
});

// Get brand recognition statistics
router.get('/statistics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { timeframe = 'month', brandName } = req.query;

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

    const where: any = {
      companyId: user.companyId,
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      activities: {
        path: ['brandRecognition'],
        not: Prisma.JsonNull
      }
    };

    const recognitionData = await prisma.visit.findMany({
      where,
      include: {
        agent: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Analyze brand recognition statistics
    const brandStats = new Map();
    let totalRecognitions = 0;
    let totalImages = recognitionData.length;

    recognitionData.forEach(visit => {
      const brandData = (visit.activities as any)?.brandRecognition;
      if (brandData?.results) {
        brandData.results.forEach((result: any) => {
          const brand = result.brandName;
          if (!brandStats.has(brand)) {
            brandStats.set(brand, {
              name: brand,
              detectionCount: 0,
              totalConfidence: 0,
              avgConfidence: 0,
              appearances: []
            });
          }
          
          const stats = brandStats.get(brand);
          stats.detectionCount++;
          stats.totalConfidence += result.confidence;
          stats.appearances.push({
            visitId: visit.id,
            agentName: `${visit.agent.firstName} ${visit.agent.lastName}`,
            confidence: result.confidence,
            date: visit.createdAt
          });
          totalRecognitions++;
        });
      }
    });

    // Calculate averages and sort by performance
    const brandPerformance = Array.from(brandStats.values())
      .map(stats => ({
        ...stats,
        avgConfidence: stats.totalConfidence / stats.detectionCount,
        detectionRate: (stats.detectionCount / totalImages) * 100
      }))
      .sort((a, b) => b.detectionCount - a.detectionCount);

    // Filter by specific brand if requested
    const filteredStats = brandName 
      ? brandPerformance.filter(brand => brand.name.toLowerCase().includes((brandName as string).toLowerCase()))
      : brandPerformance;

    res.json({
      success: true,
      data: {
        totalImages,
        totalRecognitions,
        uniqueBrands: brandStats.size,
        avgRecognitionsPerImage: totalImages > 0 ? totalRecognitions / totalImages : 0,
        brandPerformance: filteredStats.slice(0, 10), // Top 10 brands
        timeframe,
        period: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching brand recognition statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brand recognition statistics'
    });
  }
});

// Get brand recognition trends
router.get('/trends', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { brandName, period = 'daily' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - 3); // Last 3 months

    const recognitionData = await prisma.visit.findMany({
      where: {
        companyId: user.companyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        activities: {
          path: ['brandRecognition'],
          not: Prisma.JsonNull
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group data by time period
    const trends = new Map();
    
    recognitionData.forEach(visit => {
      const brandData = (visit.activities as any)?.brandRecognition;
      if (brandData?.results) {
        const date = visit.createdAt;
        let periodKey: string;
        
        switch (period) {
          case 'daily':
            periodKey = date.toISOString().split('T')[0];
            break;
          case 'weekly':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            periodKey = weekStart.toISOString().split('T')[0];
            break;
          case 'monthly':
            periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            periodKey = date.toISOString().split('T')[0];
        }

        if (!trends.has(periodKey)) {
          trends.set(periodKey, {
            period: periodKey,
            totalRecognitions: 0,
            brands: new Map()
          });
        }

        const periodData = trends.get(periodKey);
        
        brandData.results.forEach((result: any) => {
          if (!brandName || result.brandName.toLowerCase().includes((brandName as string).toLowerCase())) {
            periodData.totalRecognitions++;
            
            if (!periodData.brands.has(result.brandName)) {
              periodData.brands.set(result.brandName, {
                name: result.brandName,
                count: 0,
                totalConfidence: 0
              });
            }
            
            const brandStats = periodData.brands.get(result.brandName);
            brandStats.count++;
            brandStats.totalConfidence += result.confidence;
          }
        });
      }
    });

    // Convert to array and calculate averages
    const trendData = Array.from(trends.values())
      .map(trend => ({
        period: trend.period,
        totalRecognitions: trend.totalRecognitions,
        brands: Array.from(trend.brands.values()).map((brand: any) => ({
          name: brand.name,
          count: brand.count,
          avgConfidence: brand.totalConfidence / brand.count
        }))
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    res.json({
      success: true,
      data: {
        trends: trendData,
        period,
        totalPeriods: trendData.length,
        dateRange: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching brand recognition trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch brand recognition trends'
    });
  }
});

// Compare brand performance
router.get('/compare', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { brands, timeframe = 'month' } = req.query;

    if (!brands) {
      return res.status(400).json({
        success: false,
        error: 'Brands parameter is required'
      });
    }

    const brandList = (brands as string).split(',').map(b => b.trim());
    
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

    const recognitionData = await prisma.visit.findMany({
      where: {
        companyId: user.companyId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        activities: {
          path: ['brandRecognition'],
          not: Prisma.JsonNull
        }
      }
    });

    // Compare brand performance
    const brandComparison = brandList.map(brandName => {
      let detectionCount = 0;
      let totalConfidence = 0;
      let appearances = 0;

      recognitionData.forEach(visit => {
        const brandData = (visit.activities as any)?.brandRecognition;
        if (brandData?.results) {
          brandData.results.forEach((result: any) => {
            if (result.brandName.toLowerCase().includes(brandName.toLowerCase())) {
              detectionCount++;
              totalConfidence += result.confidence;
              appearances++;
            }
          });
        }
      });

      return {
        brandName,
        detectionCount,
        avgConfidence: appearances > 0 ? totalConfidence / appearances : 0,
        detectionRate: (detectionCount / recognitionData.length) * 100,
        marketShare: detectionCount // Simplified market share based on detection count
      };
    });

    // Sort by detection count
    brandComparison.sort((a, b) => b.detectionCount - a.detectionCount);

    res.json({
      success: true,
      data: {
        comparison: brandComparison,
        totalImages: recognitionData.length,
        timeframe,
        period: {
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error comparing brand performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare brand performance'
    });
  }
});

export default router;