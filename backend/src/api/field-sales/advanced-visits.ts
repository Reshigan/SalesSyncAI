import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';
import { calculateDistance, validateGPSAccuracy } from '../../utils/gps-utils';
import { uploadToS3, compressImage } from '../../utils/file-utils';
import { sendNotification } from '../../services/notification-service';
import { analyzeImage } from '../../services/ai-image-analysis';
import { detectFraud } from '../../services/fraud-detection';

const router = Router();
const prisma = new PrismaClient();

// Advanced Visit Execution System
interface VisitExecutionData {
  customerId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };
  activities: VisitActivity[];
  photos: VisitPhoto[];
  surveys: SurveyResponse[];
  sales: SaleTransaction[];
  assetAudits: AssetAudit[];
}

interface VisitActivity {
  type: 'arrival' | 'survey' | 'sale' | 'audit' | 'photo' | 'departure';
  timestamp: Date;
  duration?: number;
  data: any;
  required: boolean;
  completed: boolean;
}

interface VisitPhoto {
  type: 'exterior' | 'interior' | 'product_display' | 'asset' | 'receipt';
  url: string;
  metadata: {
    gps: { latitude: number; longitude: number };
    timestamp: Date;
    quality: 'high' | 'medium' | 'low';
    aiAnalysis?: ImageAnalysisResult;
  };
}

interface ImageAnalysisResult {
  brandVisibility: number;
  shelfShare: number;
  competitorPresence: string[];
  qualityScore: number;
  recommendations: string[];
}

// Start advanced visit execution
router.post('/visits/start-advanced', 
  authMiddleware,
  [
    body('customerId').isUUID().withMessage('Valid customer ID required'),
    body('location.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('location.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('location.accuracy').isFloat({ min: 0 }).withMessage('GPS accuracy required'),
  ],
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { customerId, location } = req.body;
      const agentId = req.user!.id;
      const companyId = req.user!.companyId;

      // Get customer details
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId }
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      // Validate GPS location against customer address
      const customerLocation = {
        latitude: parseFloat(customer.latitude || '0'),
        longitude: parseFloat(customer.longitude || '0')
      };

      const distance = calculateDistance(location, customerLocation);
      const locationValid = distance <= 100; // 100 meter radius

      if (!locationValid) {
        return res.status(400).json({
          success: false,
          error: 'Location validation failed',
          details: {
            distance,
            maxAllowed: 100,
            customerLocation
          }
        });
      }

      // Check for existing active visit
      const existingVisit = await prisma.visit.findFirst({
        where: {
          agentId,
          status: 'IN_PROGRESS'
        }
      });

      if (existingVisit) {
        return res.status(400).json({
          success: false,
          error: 'Another visit is already in progress'
        });
      }

      // Create advanced visit record
      const visit = await prisma.visit.create({
        data: {
          companyId,
          agentId,
          customerId,
          status: 'IN_PROGRESS',
          startTime: new Date(),
          location: JSON.stringify(location),
          visitData: JSON.stringify({
            activities: [],
            photos: [],
            surveys: [],
            sales: [],
            assetAudits: [],
            gpsValidation: {
              valid: locationValid,
              distance,
              accuracy: location.accuracy
            }
          })
        }
      });

      // Log arrival activity
      const arrivalActivity: VisitActivity = {
        type: 'arrival',
        timestamp: new Date(),
        data: { location, customer: customer.name },
        required: true,
        completed: true
      };

      // Update visit with arrival activity
      await prisma.visit.update({
        where: { id: visit.id },
        data: {
          visitData: JSON.stringify({
            activities: [arrivalActivity],
            photos: [],
            surveys: [],
            sales: [],
            assetAudits: []
          })
        }
      });

      // Get required activities for this customer
      const requiredActivities = await getRequiredActivities(customerId, companyId);

      // Fraud detection check
      const fraudCheck = await detectFraud({
        agentId,
        activityType: 'visit_start',
        location,
        timestamp: new Date(),
        customerId
      });

      if (fraudCheck.riskLevel === 'HIGH') {
        await sendNotification({
          type: 'fraud_alert',
          recipientId: req.user!.managerId || 'system',
          message: `High fraud risk detected for agent ${req.user!.firstName} ${req.user!.lastName}`,
          data: fraudCheck
        });
      }

      res.json({
        success: true,
        data: {
          visitId: visit.id,
          customer,
          requiredActivities,
          locationValidation: {
            valid: locationValid,
            distance,
            accuracy: location.accuracy
          },
          fraudRisk: fraudCheck.riskLevel
        }
      });

    } catch (error) {
      console.error('Start visit error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start visit'
      });
    }
  }
);

// Upload and analyze visit photo
router.post('/visits/:visitId/photos',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { visitId } = req.params;
      const { photoType, metadata } = req.body;

      // Validate visit ownership
      const visit = await prisma.visit.findFirst({
        where: {
          id: visitId,
          agentId: req.user!.id,
          status: 'IN_PROGRESS'
        }
      });

      if (!visit) {
        return res.status(404).json({
          success: false,
          error: 'Visit not found or not in progress'
        });
      }

      // Process uploaded image
      const imageFile = req.files?.image as any;
      if (!imageFile) {
        return res.status(400).json({
          success: false,
          error: 'Image file required'
        });
      }

      // Compress and optimize image
      const compressedImage = await compressImage(imageFile.buffer, {
        quality: 80,
        maxWidth: 1920,
        maxHeight: 1080
      });

      // Upload to S3
      const imageUrl = await uploadToS3(compressedImage, {
        bucket: process.env.AWS_S3_BUCKET!,
        key: `visits/${visitId}/photos/${Date.now()}-${photoType}.jpg`,
        contentType: 'image/jpeg'
      });

      // AI Image Analysis
      let aiAnalysis: ImageAnalysisResult | undefined;
      if (photoType === 'product_display' || photoType === 'interior') {
        aiAnalysis = await analyzeImage(compressedImage, {
          type: 'brand_analysis',
          companyId: req.user!.companyId
        });
      }

      // Create photo record
      const photo: VisitPhoto = {
        type: photoType,
        url: imageUrl,
        metadata: {
          gps: metadata.gps,
          timestamp: new Date(),
          quality: metadata.quality || 'medium',
          aiAnalysis
        }
      };

      // Update visit data
      const visitData = JSON.parse(visit.visitData || '{}');
      visitData.photos = visitData.photos || [];
      visitData.photos.push(photo);

      await prisma.visit.update({
        where: { id: visitId },
        data: {
          visitData: JSON.stringify(visitData)
        }
      });

      res.json({
        success: true,
        data: {
          photo,
          aiAnalysis
        }
      });

    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload photo'
      });
    }
  }
);

// Execute survey during visit
router.post('/visits/:visitId/surveys',
  authMiddleware,
  [
    body('surveyId').isUUID().withMessage('Valid survey ID required'),
    body('responses').isArray().withMessage('Survey responses required'),
  ],
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { visitId } = req.params;
      const { surveyId, responses } = req.body;

      // Validate visit
      const visit = await prisma.visit.findFirst({
        where: {
          id: visitId,
          agentId: req.user!.id,
          status: 'IN_PROGRESS'
        }
      });

      if (!visit) {
        return res.status(404).json({
          success: false,
          error: 'Visit not found or not in progress'
        });
      }

      // Get survey template
      const survey = await prisma.survey.findFirst({
        where: {
          id: surveyId,
          companyId: req.user!.companyId
        },
        include: {
          questions: true
        }
      });

      if (!survey) {
        return res.status(404).json({
          success: false,
          error: 'Survey not found'
        });
      }

      // Validate responses
      const validationResult = validateSurveyResponses(survey.questions, responses);
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid survey responses',
          details: validationResult.errors
        });
      }

      // Create survey response
      const surveyResponse = await prisma.surveyResponse.create({
        data: {
          surveyId,
          agentId: req.user!.id,
          customerId: visit.customerId,
          visitId,
          responses: JSON.stringify(responses),
          completedAt: new Date()
        }
      });

      // Update visit data
      const visitData = JSON.parse(visit.visitData || '{}');
      visitData.surveys = visitData.surveys || [];
      visitData.surveys.push({
        surveyId,
        responseId: surveyResponse.id,
        completedAt: new Date(),
        responses
      });

      await prisma.visit.update({
        where: { id: visitId },
        data: {
          visitData: JSON.stringify(visitData)
        }
      });

      res.json({
        success: true,
        data: {
          surveyResponse,
          validationResult
        }
      });

    } catch (error) {
      console.error('Survey execution error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute survey'
      });
    }
  }
);

// Process sale during visit
router.post('/visits/:visitId/sales',
  authMiddleware,
  [
    body('items').isArray().withMessage('Sale items required'),
    body('paymentMethod').isIn(['CASH', 'CARD', 'CREDIT']).withMessage('Valid payment method required'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Valid total amount required'),
  ],
  async (req: AuthenticatedRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { visitId } = req.params;
      const { items, paymentMethod, totalAmount, cashReceived, changeGiven } = req.body;

      // Validate visit
      const visit = await prisma.visit.findFirst({
        where: {
          id: visitId,
          agentId: req.user!.id,
          status: 'IN_PROGRESS'
        },
        include: {
          customer: true
        }
      });

      if (!visit) {
        return res.status(404).json({
          success: false,
          error: 'Visit not found or not in progress'
        });
      }

      // Validate stock availability
      const stockValidation = await validateStockAvailability(req.user!.id, items);
      if (!stockValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient stock',
          details: stockValidation.errors
        });
      }

      // Check customer credit limit if credit sale
      if (paymentMethod === 'CREDIT') {
        const creditCheck = await checkCustomerCredit(visit.customerId, totalAmount);
        if (!creditCheck.approved) {
          return res.status(400).json({
            success: false,
            error: 'Credit limit exceeded',
            details: creditCheck
          });
        }
      }

      // Create sale transaction
      const sale = await prisma.sale.create({
        data: {
          companyId: req.user!.companyId,
          agentId: req.user!.id,
          customerId: visit.customerId,
          visitId,
          totalAmount,
          paymentMethod,
          cashReceived: paymentMethod === 'CASH' ? cashReceived : null,
          changeGiven: paymentMethod === 'CASH' ? changeGiven : null,
          status: 'COMPLETED'
        }
      });

      // Create sale items
      for (const item of items) {
        await prisma.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice
          }
        });

        // Update agent stock
        await updateAgentStock(req.user!.id, item.productId, -item.quantity);
      }

      // Generate invoice
      const invoice = await generateInvoice(sale.id);

      // Update visit data
      const visitData = JSON.parse(visit.visitData || '{}');
      visitData.sales = visitData.sales || [];
      visitData.sales.push({
        saleId: sale.id,
        totalAmount,
        paymentMethod,
        items,
        timestamp: new Date()
      });

      await prisma.visit.update({
        where: { id: visitId },
        data: {
          visitData: JSON.stringify(visitData)
        }
      });

      res.json({
        success: true,
        data: {
          sale,
          invoice,
          stockUpdated: true
        }
      });

    } catch (error) {
      console.error('Sale processing error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process sale'
      });
    }
  }
);

// Complete visit
router.post('/visits/:visitId/complete',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { visitId } = req.params;
      const { departureLocation, notes } = req.body;

      // Validate visit
      const visit = await prisma.visit.findFirst({
        where: {
          id: visitId,
          agentId: req.user!.id,
          status: 'IN_PROGRESS'
        },
        include: {
          customer: true
        }
      });

      if (!visit) {
        return res.status(404).json({
          success: false,
          error: 'Visit not found or not in progress'
        });
      }

      // Validate required activities completed
      const visitData = JSON.parse(visit.visitData || '{}');
      const requiredActivities = await getRequiredActivities(visit.customerId, req.user!.companyId);
      const completionCheck = validateVisitCompletion(visitData, requiredActivities);

      if (!completionCheck.complete) {
        return res.status(400).json({
          success: false,
          error: 'Required activities not completed',
          details: completionCheck.missing
        });
      }

      // Calculate visit duration
      const duration = new Date().getTime() - new Date(visit.startTime!).getTime();

      // Add departure activity
      const departureActivity: VisitActivity = {
        type: 'departure',
        timestamp: new Date(),
        data: { location: departureLocation, notes },
        required: true,
        completed: true
      };

      visitData.activities = visitData.activities || [];
      visitData.activities.push(departureActivity);

      // Complete visit
      await prisma.visit.update({
        where: { id: visitId },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          duration: Math.round(duration / 1000), // seconds
          visitData: JSON.stringify(visitData),
          notes
        }
      });

      // Generate visit summary
      const summary = generateVisitSummary(visitData, duration);

      // Update customer last visit
      await prisma.customer.update({
        where: { id: visit.customerId },
        data: {
          lastVisitDate: new Date()
        }
      });

      res.json({
        success: true,
        data: {
          visitId,
          duration: Math.round(duration / 1000),
          summary,
          completionStatus: completionCheck
        }
      });

    } catch (error) {
      console.error('Complete visit error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete visit'
      });
    }
  }
);

// Helper functions
async function getRequiredActivities(customerId: string, companyId: string) {
  // Get customer-specific requirements
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId }
  });

  // Default required activities
  const activities = [
    { type: 'arrival', required: true },
    { type: 'photo', required: true, minCount: 2 },
    { type: 'departure', required: true }
  ];

  // Add customer-specific requirements
  if (customer?.customerType === 'KEY_ACCOUNT') {
    activities.push(
      { type: 'survey', required: true, minCount: 1 },
      { type: 'audit', required: true, minCount: 1 }
    );
  }

  return activities;
}

function validateSurveyResponses(questions: any[], responses: any[]) {
  const errors: string[] = [];
  
  for (const question of questions) {
    const response = responses.find(r => r.questionId === question.id);
    
    if (question.required && !response) {
      errors.push(`Question "${question.text}" is required`);
      continue;
    }

    if (response) {
      // Validate response format based on question type
      switch (question.type) {
        case 'MULTIPLE_CHOICE':
          if (!question.options.includes(response.value)) {
            errors.push(`Invalid option for question "${question.text}"`);
          }
          break;
        case 'NUMBER':
          if (isNaN(parseFloat(response.value))) {
            errors.push(`Numeric value required for question "${question.text}"`);
          }
          break;
        case 'TEXT':
          if (typeof response.value !== 'string' || response.value.trim().length === 0) {
            errors.push(`Text response required for question "${question.text}"`);
          }
          break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

async function validateStockAvailability(agentId: string, items: any[]) {
  const errors: string[] = [];
  
  for (const item of items) {
    const stock = await prisma.agentStock.findFirst({
      where: {
        agentId,
        productId: item.productId
      }
    });

    if (!stock || stock.quantity < item.quantity) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });
      errors.push(`Insufficient stock for ${product?.name || 'product'}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

async function checkCustomerCredit(customerId: string, amount: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    return { approved: false, reason: 'Customer not found' };
  }

  const currentCredit = parseFloat(customer.creditBalance || '0');
  const creditLimit = parseFloat(customer.creditLimit || '0');

  if (currentCredit + amount > creditLimit) {
    return {
      approved: false,
      reason: 'Credit limit exceeded',
      currentCredit,
      creditLimit,
      requestedAmount: amount
    };
  }

  return { approved: true };
}

async function updateAgentStock(agentId: string, productId: string, quantityChange: number) {
  const stock = await prisma.agentStock.findFirst({
    where: { agentId, productId }
  });

  if (stock) {
    await prisma.agentStock.update({
      where: { id: stock.id },
      data: {
        quantity: stock.quantity + quantityChange
      }
    });
  }
}

async function generateInvoice(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          product: true
        }
      },
      customer: true,
      agent: true
    }
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  const invoice = {
    invoiceNumber: `INV-${sale.id.substring(0, 8).toUpperCase()}`,
    date: sale.createdAt,
    customer: {
      name: sale.customer.name,
      address: sale.customer.address
    },
    agent: {
      name: `${sale.agent.firstName} ${sale.agent.lastName}`,
      email: sale.agent.email
    },
    items: sale.items.map(item => ({
      product: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    })),
    totalAmount: sale.totalAmount,
    paymentMethod: sale.paymentMethod
  };

  return invoice;
}

function validateVisitCompletion(visitData: any, requiredActivities: any[]) {
  const missing: string[] = [];
  const activities = visitData.activities || [];
  const photos = visitData.photos || [];

  for (const required of requiredActivities) {
    switch (required.type) {
      case 'arrival':
      case 'departure':
        if (!activities.find((a: any) => a.type === required.type)) {
          missing.push(`${required.type} activity required`);
        }
        break;
      case 'photo':
        if (photos.length < (required.minCount || 1)) {
          missing.push(`At least ${required.minCount || 1} photos required`);
        }
        break;
      case 'survey':
        if ((visitData.surveys || []).length < (required.minCount || 1)) {
          missing.push(`At least ${required.minCount || 1} surveys required`);
        }
        break;
    }
  }

  return {
    complete: missing.length === 0,
    missing
  };
}

function generateVisitSummary(visitData: any, duration: number) {
  return {
    duration: Math.round(duration / 1000),
    activitiesCompleted: (visitData.activities || []).length,
    photosUploaded: (visitData.photos || []).length,
    surveysCompleted: (visitData.surveys || []).length,
    salesMade: (visitData.sales || []).length,
    totalSalesAmount: (visitData.sales || []).reduce((sum: number, sale: any) => sum + sale.totalAmount, 0)
  };
}

export default router;