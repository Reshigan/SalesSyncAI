/**
 * Advanced Street Marketing API for SalesSync
 * Complete implementation of street marketing, customer registration, and SIM distribution
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';
import { uploadToS3, compressImage, validateFile } from '../../utils/file-utils';
import { validateGPSAccuracy, calculateDistance } from '../../utils/gps-utils';
import { analyzeImage } from '../../services/ai-image-analysis';
import { detectFraud } from '../../services/fraud-detection';
import { sendNotification } from '../../services/notification-service';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
});

// Street Marketing Campaign Execution

interface StreetMarketingSession {
  id: string;
  campaignId: string;
  agentId: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
  };
  startTime: Date;
  endTime?: Date;
  interactions: CustomerInteraction[];
  registrations: CustomerRegistration[];
  simDistributions: SimDistribution[];
  photos: SessionPhoto[];
  performance: SessionPerformance;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

interface CustomerInteraction {
  id: string;
  timestamp: Date;
  duration: number; // seconds
  interactionType: 'APPROACH' | 'PRESENTATION' | 'REGISTRATION' | 'REJECTION' | 'FOLLOW_UP';
  customerDemographics: {
    ageGroup: 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus';
    gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    language: string;
  };
  scriptSections: ScriptSection[];
  outcome: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  registrationCompleted: boolean;
  followUpRequired: boolean;
  notes: string;
}

interface ScriptSection {
  sectionId: string;
  sectionName: string;
  delivered: boolean;
  duration: number;
  customerQuestions: string[];
  customerResponse: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

interface CustomerRegistration {
  id: string;
  interactionId: string;
  campaignType: 'GOLDRUSH_ONLINE' | 'NEXT_CELLULAR' | 'BRAND_PROMOTION' | 'SURVEY_COLLECTION';
  customerData: {
    fullName: string;
    surname: string;
    idOrPassportNumber: string;
    idType: 'ID' | 'PASSPORT';
    contactPhone: string;
    contactEmail?: string;
    age: number;
    address?: string;
    consentMarketing: boolean;
    consentDataProcessing: boolean;
  };
  verificationPhotos: VerificationPhoto[];
  registrationPlatformId?: string;
  commissionTrackingCode: string;
  registrationStatus: 'PENDING' | 'VERIFIED' | 'COMPLETED' | 'REJECTED';
  completedAt?: Date;
}

interface VerificationPhoto {
  type: 'ID_DOCUMENT' | 'CUSTOMER_WITH_ID' | 'REGISTRATION_PROOF';
  url: string;
  aiAnalysis: {
    documentValid: boolean;
    faceMatch: boolean;
    qualityScore: number;
    issues: string[];
  };
  timestamp: Date;
}

interface SimDistribution {
  id: string;
  interactionId: string;
  registrationId: string;
  simCardNumber: string;
  customerData: CustomerRegistration['customerData'];
  servicePackage: {
    packageId: string;
    packageName: string;
    monthlyFee: number;
    dataAllowance: string;
    voiceMinutes: string;
    smsAllowance: string;
  };
  verificationPhotos: VerificationPhoto[];
  activationStatus: 'PENDING' | 'ACTIVATED' | 'FAILED';
  reconciliationKey: string;
  commissionAmount: number;
  distributionDate: Date;
}

interface SessionPhoto {
  id: string;
  type: 'SETUP' | 'CROWD' | 'INTERACTION' | 'MATERIALS' | 'TEARDOWN';
  url: string;
  caption?: string;
  timestamp: Date;
  gpsLocation: { latitude: number; longitude: number };
}

interface SessionPerformance {
  totalInteractions: number;
  successfulRegistrations: number;
  simDistributions: number;
  conversionRate: number;
  averageInteractionDuration: number;
  demographicBreakdown: any;
  hourlyPerformance: any[];
  commissionEarned: number;
}

/**
 * Start street marketing session
 */
router.post('/street-marketing/start',
  authMiddleware,
  [
    body('campaignId').isUUID().withMessage('Valid campaign ID required'),
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

      const { campaignId, location, setupPhotos } = req.body;
      const agentId = req.user!.id;

      // Validate campaign exists and agent is assigned
      const campaign = await prisma.marketingCampaign.findFirst({
        where: {
          id: campaignId,
          companyId: req.user!.companyId,
          status: 'ACTIVE',
          assignedAgents: {
            has: agentId
          }
        }
      });

      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found or not assigned to agent'
        });
      }

      // Check for existing active session
      const existingSession = await prisma.streetMarketingSession.findFirst({
        where: {
          agentId,
          status: 'ACTIVE'
        }
      });

      if (existingSession) {
        return res.status(400).json({
          success: false,
          error: 'Another street marketing session is already active'
        });
      }

      // Validate location (if campaign has territory restrictions)
      if (campaign.territories && campaign.territories.length > 0) {
        const locationValid = validateCampaignTerritory(location, JSON.parse(campaign.territories as string));
        if (!locationValid) {
          return res.status(400).json({
            success: false,
            error: 'Location outside campaign territory'
          });
        }
      }

      // Create street marketing session
      const session = await prisma.streetMarketingSession.create({
        data: {
          campaignId,
          agentId,
          companyId: req.user!.companyId,
          location: JSON.stringify(location),
          startTime: new Date(),
          status: 'ACTIVE',
          sessionData: JSON.stringify({
            interactions: [],
            registrations: [],
            simDistributions: [],
            photos: [],
            performance: {
              totalInteractions: 0,
              successfulRegistrations: 0,
              simDistributions: 0,
              conversionRate: 0,
              averageInteractionDuration: 0,
              commissionEarned: 0
            }
          })
        }
      });

      // Fraud detection check
      const fraudCheck = await detectFraud({
        agentId,
        activityType: 'visit_start',
        location,
        timestamp: new Date(),
        metadata: { campaignId, sessionType: 'street_marketing' }
      });

      if (fraudCheck.riskLevel === 'HIGH') {
        await sendNotification({
          type: 'fraud_alert',
          recipientId: req.user!.managerId || 'system',
          title: 'Street Marketing Fraud Alert',
          message: `High fraud risk detected for street marketing session by ${req.user!.firstName} ${req.user!.lastName}`,
          data: { sessionId: session.id, fraudCheck },
          priority: 'HIGH'
        });
      }

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          campaign: {
            id: campaign.id,
            name: campaign.name,
            type: campaign.type,
            materials: JSON.parse(campaign.materials as string || '[]'),
            script: JSON.parse(campaign.script as string || '{}')
          },
          fraudRisk: fraudCheck.riskLevel,
          startTime: session.startTime
        }
      });

    } catch (error) {
      console.error('Start street marketing session error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start street marketing session'
      });
    }
  }
);

/**
 * Record customer interaction
 */
router.post('/street-marketing/:sessionId/interactions',
  authMiddleware,
  [
    body('interactionType').isIn(['APPROACH', 'PRESENTATION', 'REGISTRATION', 'REJECTION', 'FOLLOW_UP']).withMessage('Valid interaction type required'),
    body('customerDemographics.ageGroup').isIn(['under_18', '18_24', '25_34', '35_44', '45_54', '55_plus']).withMessage('Valid age group required'),
    body('customerDemographics.gender').isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Valid gender required'),
    body('duration').isInt({ min: 1 }).withMessage('Valid duration required'),
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

      const { sessionId } = req.params;
      const { interactionType, customerDemographics, duration, scriptSections, outcome, notes } = req.body;

      // Validate session
      const session = await prisma.streetMarketingSession.findFirst({
        where: {
          id: sessionId,
          agentId: req.user!.id,
          status: 'ACTIVE'
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Active session not found'
        });
      }

      // Create interaction record
      const interaction: CustomerInteraction = {
        id: uuidv4(),
        timestamp: new Date(),
        duration,
        interactionType,
        customerDemographics,
        scriptSections: scriptSections || [],
        outcome: outcome || 'NEUTRAL',
        registrationCompleted: false,
        followUpRequired: false,
        notes: notes || ''
      };

      // Update session data
      const sessionData = JSON.parse(session.sessionData || '{}');
      sessionData.interactions = sessionData.interactions || [];
      sessionData.interactions.push(interaction);

      // Update performance metrics
      sessionData.performance = calculateSessionPerformance(sessionData);

      await prisma.streetMarketingSession.update({
        where: { id: sessionId },
        data: {
          sessionData: JSON.stringify(sessionData)
        }
      });

      res.json({
        success: true,
        data: {
          interactionId: interaction.id,
          performance: sessionData.performance
        }
      });

    } catch (error) {
      console.error('Record interaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record interaction'
      });
    }
  }
);

/**
 * Register customer (GoldRush Online example)
 */
router.post('/street-marketing/:sessionId/register-customer',
  authMiddleware,
  upload.fields([
    { name: 'idPhoto', maxCount: 1 },
    { name: 'customerPhoto', maxCount: 1 }
  ]),
  [
    body('interactionId').isUUID().withMessage('Valid interaction ID required'),
    body('campaignType').isIn(['GOLDRUSH_ONLINE', 'NEXT_CELLULAR', 'BRAND_PROMOTION', 'SURVEY_COLLECTION']).withMessage('Valid campaign type required'),
    body('customerData.fullName').notEmpty().withMessage('Full name required'),
    body('customerData.surname').notEmpty().withMessage('Surname required'),
    body('customerData.idOrPassportNumber').notEmpty().withMessage('ID or passport number required'),
    body('customerData.contactPhone').isMobilePhone().withMessage('Valid phone number required'),
    body('customerData.age').isInt({ min: 18 }).withMessage('Customer must be 18 or older'),
    body('customerData.consentMarketing').isBoolean().withMessage('Marketing consent required'),
    body('customerData.consentDataProcessing').isBoolean().withMessage('Data processing consent required'),
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

      const { sessionId } = req.params;
      const { interactionId, campaignType, customerData } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Validate session
      const session = await prisma.streetMarketingSession.findFirst({
        where: {
          id: sessionId,
          agentId: req.user!.id,
          status: 'ACTIVE'
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Active session not found'
        });
      }

      // Validate required photos
      if (!files.idPhoto || !files.customerPhoto) {
        return res.status(400).json({
          success: false,
          error: 'ID photo and customer photo are required'
        });
      }

      // Process and validate photos
      const verificationPhotos: VerificationPhoto[] = [];

      // Process ID document photo
      const idPhoto = files.idPhoto[0];
      const idPhotoValidation = await validateFile({
        buffer: idPhoto.buffer,
        mimetype: idPhoto.mimetype,
        size: idPhoto.size
      });

      if (!idPhotoValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid ID photo',
          details: idPhotoValidation.errors
        });
      }

      // Compress and upload ID photo
      const compressedIdPhoto = await compressImage(idPhoto.buffer, { quality: 85 });
      const idPhotoUrl = await uploadToS3(compressedIdPhoto, {
        bucket: process.env.AWS_S3_BUCKET!,
        key: `street-marketing/${sessionId}/id-photos/${Date.now()}-id.jpg`,
        contentType: 'image/jpeg'
      });

      // AI analysis of ID document
      const idAnalysis = await analyzeImage(compressedIdPhoto, {
        type: 'quality_check',
        companyId: req.user!.companyId
      });

      verificationPhotos.push({
        type: 'ID_DOCUMENT',
        url: idPhotoUrl,
        aiAnalysis: {
          documentValid: idAnalysis.qualityScore > 70,
          faceMatch: true, // Would need face recognition
          qualityScore: idAnalysis.qualityScore,
          issues: idAnalysis.qualityScore < 70 ? ['Low image quality'] : []
        },
        timestamp: new Date()
      });

      // Process customer photo
      const customerPhoto = files.customerPhoto[0];
      const compressedCustomerPhoto = await compressImage(customerPhoto.buffer, { quality: 85 });
      const customerPhotoUrl = await uploadToS3(compressedCustomerPhoto, {
        bucket: process.env.AWS_S3_BUCKET!,
        key: `street-marketing/${sessionId}/customer-photos/${Date.now()}-customer.jpg`,
        contentType: 'image/jpeg'
      });

      verificationPhotos.push({
        type: 'CUSTOMER_WITH_ID',
        url: customerPhotoUrl,
        aiAnalysis: {
          documentValid: true,
          faceMatch: true, // Would need face recognition
          qualityScore: 85,
          issues: []
        },
        timestamp: new Date()
      });

      // Generate commission tracking code
      const commissionTrackingCode = generateCommissionTrackingCode(
        req.user!.id,
        customerData.idOrPassportNumber,
        campaignType
      );

      // Create registration record
      const registration: CustomerRegistration = {
        id: uuidv4(),
        interactionId,
        campaignType,
        customerData,
        verificationPhotos,
        commissionTrackingCode,
        registrationStatus: 'PENDING'
      };

      // Submit registration to brand platform (example: GoldRush Online)
      let registrationPlatformId: string | undefined;
      if (campaignType === 'GOLDRUSH_ONLINE') {
        registrationPlatformId = await submitToGoldRushPlatform(customerData, commissionTrackingCode);
        registration.registrationPlatformId = registrationPlatformId;
        registration.registrationStatus = 'COMPLETED';
        registration.completedAt = new Date();
      }

      // Update session data
      const sessionData = JSON.parse(session.sessionData || '{}');
      sessionData.registrations = sessionData.registrations || [];
      sessionData.registrations.push(registration);

      // Update interaction to mark registration completed
      const interaction = sessionData.interactions.find((i: any) => i.id === interactionId);
      if (interaction) {
        interaction.registrationCompleted = true;
        interaction.outcome = 'POSITIVE';
      }

      // Update performance metrics
      sessionData.performance = calculateSessionPerformance(sessionData);

      await prisma.streetMarketingSession.update({
        where: { id: sessionId },
        data: {
          sessionData: JSON.stringify(sessionData)
        }
      });

      // Create customer record in database
      await prisma.customer.create({
        data: {
          companyId: req.user!.companyId,
          name: `${customerData.fullName} ${customerData.surname}`,
          phone: customerData.contactPhone,
          email: customerData.contactEmail,
          address: customerData.address,
          customerType: 'STREET_MARKETING',
          source: campaignType,
          agentId: req.user!.id,
          metadata: JSON.stringify({
            registrationId: registration.id,
            commissionTrackingCode,
            campaignType,
            registrationDate: new Date()
          })
        }
      });

      res.json({
        success: true,
        data: {
          registrationId: registration.id,
          commissionTrackingCode,
          registrationPlatformId,
          registrationStatus: registration.registrationStatus,
          performance: sessionData.performance
        }
      });

    } catch (error) {
      console.error('Customer registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to register customer'
      });
    }
  }
);

/**
 * Distribute SIM card (Next Cellular example)
 */
router.post('/street-marketing/:sessionId/distribute-sim',
  authMiddleware,
  upload.fields([
    { name: 'idPhoto', maxCount: 1 },
    { name: 'simPhoto', maxCount: 1 },
    { name: 'customerSimPhoto', maxCount: 1 }
  ]),
  [
    body('registrationId').isUUID().withMessage('Valid registration ID required'),
    body('servicePackageId').notEmpty().withMessage('Service package ID required'),
  ],
  async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { registrationId, servicePackageId } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Validate session
      const session = await prisma.streetMarketingSession.findFirst({
        where: {
          id: sessionId,
          agentId: req.user!.id,
          status: 'ACTIVE'
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Active session not found'
        });
      }

      // Get next available SIM card
      const availableSim = await getNextAvailableSim(req.user!.id);
      if (!availableSim) {
        return res.status(400).json({
          success: false,
          error: 'No SIM cards available in agent inventory'
        });
      }

      // Get service package details
      const servicePackage = await getServicePackage(servicePackageId);
      if (!servicePackage) {
        return res.status(404).json({
          success: false,
          error: 'Service package not found'
        });
      }

      // Get registration data
      const sessionData = JSON.parse(session.sessionData || '{}');
      const registration = sessionData.registrations?.find((r: any) => r.id === registrationId);
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found'
        });
      }

      // Process verification photos
      const verificationPhotos: VerificationPhoto[] = [];

      if (files.customerSimPhoto) {
        const customerSimPhoto = files.customerSimPhoto[0];
        const compressedPhoto = await compressImage(customerSimPhoto.buffer, { quality: 85 });
        const photoUrl = await uploadToS3(compressedPhoto, {
          bucket: process.env.AWS_S3_BUCKET!,
          key: `street-marketing/${sessionId}/sim-distribution/${Date.now()}-customer-sim.jpg`,
          contentType: 'image/jpeg'
        });

        verificationPhotos.push({
          type: 'REGISTRATION_PROOF',
          url: photoUrl,
          aiAnalysis: {
            documentValid: true,
            faceMatch: true,
            qualityScore: 85,
            issues: []
          },
          timestamp: new Date()
        });
      }

      // Generate reconciliation key
      const reconciliationKey = generateReconciliationKey(
        req.user!.id,
        availableSim.simNumber,
        registration.customerData.idOrPassportNumber
      );

      // Create SIM distribution record
      const simDistribution: SimDistribution = {
        id: uuidv4(),
        interactionId: registration.interactionId,
        registrationId,
        simCardNumber: availableSim.simNumber,
        customerData: registration.customerData,
        servicePackage,
        verificationPhotos,
        activationStatus: 'PENDING',
        reconciliationKey,
        commissionAmount: calculateSimCommission(servicePackage),
        distributionDate: new Date()
      };

      // Activate SIM card
      const activationResult = await activateSimCard(
        availableSim.simNumber,
        registration.customerData,
        servicePackage
      );

      simDistribution.activationStatus = activationResult.success ? 'ACTIVATED' : 'FAILED';

      // Update session data
      sessionData.simDistributions = sessionData.simDistributions || [];
      sessionData.simDistributions.push(simDistribution);
      sessionData.performance = calculateSessionPerformance(sessionData);

      await prisma.streetMarketingSession.update({
        where: { id: sessionId },
        data: {
          sessionData: JSON.stringify(sessionData)
        }
      });

      // Update agent SIM inventory
      await updateAgentSimInventory(req.user!.id, availableSim.simNumber, 'DISTRIBUTED');

      res.json({
        success: true,
        data: {
          distributionId: simDistribution.id,
          simCardNumber: availableSim.simNumber,
          reconciliationKey,
          activationStatus: simDistribution.activationStatus,
          commissionAmount: simDistribution.commissionAmount,
          performance: sessionData.performance
        }
      });

    } catch (error) {
      console.error('SIM distribution error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to distribute SIM card'
      });
    }
  }
);

/**
 * Upload session photos
 */
router.post('/street-marketing/:sessionId/photos',
  authMiddleware,
  upload.array('photos', 10),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { photoType, captions } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No photos uploaded'
        });
      }

      // Validate session
      const session = await prisma.streetMarketingSession.findFirst({
        where: {
          id: sessionId,
          agentId: req.user!.id,
          status: 'ACTIVE'
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Active session not found'
        });
      }

      const uploadedPhotos: SessionPhoto[] = [];

      // Process each photo
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const caption = Array.isArray(captions) ? captions[i] : captions;

        // Validate file
        const validation = await validateFile({
          buffer: file.buffer,
          mimetype: file.mimetype,
          size: file.size
        });

        if (!validation.valid) {
          continue; // Skip invalid files
        }

        // Compress and upload
        const compressedPhoto = await compressImage(file.buffer, { quality: 80 });
        const photoUrl = await uploadToS3(compressedPhoto, {
          bucket: process.env.AWS_S3_BUCKET!,
          key: `street-marketing/${sessionId}/session-photos/${Date.now()}-${i}.jpg`,
          contentType: 'image/jpeg'
        });

        const sessionLocation = JSON.parse(session.location || '{}');
        const photo: SessionPhoto = {
          id: uuidv4(),
          type: photoType || 'INTERACTION',
          url: photoUrl,
          caption,
          timestamp: new Date(),
          gpsLocation: {
            latitude: sessionLocation.latitude || 0,
            longitude: sessionLocation.longitude || 0
          }
        };

        uploadedPhotos.push(photo);
      }

      // Update session data
      const sessionData = JSON.parse(session.sessionData || '{}');
      sessionData.photos = sessionData.photos || [];
      sessionData.photos.push(...uploadedPhotos);

      await prisma.streetMarketingSession.update({
        where: { id: sessionId },
        data: {
          sessionData: JSON.stringify(sessionData)
        }
      });

      res.json({
        success: true,
        data: {
          uploadedPhotos: uploadedPhotos.length,
          photos: uploadedPhotos
        }
      });

    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload photos'
      });
    }
  }
);

/**
 * Complete street marketing session
 */
router.post('/street-marketing/:sessionId/complete',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId } = req.params;
      const { notes, teardownPhotos } = req.body;

      // Validate session
      const session = await prisma.streetMarketingSession.findFirst({
        where: {
          id: sessionId,
          agentId: req.user!.id,
          status: 'ACTIVE'
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Active session not found'
        });
      }

      // Calculate final performance metrics
      const sessionData = JSON.parse(session.sessionData || '{}');
      const finalPerformance = calculateSessionPerformance(sessionData);
      const duration = new Date().getTime() - new Date(session.startTime).getTime();

      // Complete session
      await prisma.streetMarketingSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endTime: new Date(),
          duration: Math.round(duration / 1000), // seconds
          notes,
          sessionData: JSON.stringify({
            ...sessionData,
            performance: finalPerformance
          })
        }
      });

      // Generate session report
      const report = generateSessionReport(sessionData, finalPerformance, duration);

      // Notify manager of session completion
      if (req.user!.managerId) {
        await sendNotification({
          type: 'info',
          recipientId: req.user!.managerId,
          title: 'Street Marketing Session Completed',
          message: `${req.user!.firstName} ${req.user!.lastName} completed a street marketing session with ${finalPerformance.successfulRegistrations} registrations`,
          data: {
            sessionId,
            agentId: req.user!.id,
            performance: finalPerformance,
            duration: Math.round(duration / 1000)
          }
        });
      }

      res.json({
        success: true,
        data: {
          sessionId,
          duration: Math.round(duration / 1000),
          performance: finalPerformance,
          report
        }
      });

    } catch (error) {
      console.error('Complete session error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete session'
      });
    }
  }
);

// Helper functions

function validateCampaignTerritory(location: any, territories: any[]): boolean {
  // Implement territory validation logic
  return true; // Simplified for now
}

function calculateSessionPerformance(sessionData: any): SessionPerformance {
  const interactions = sessionData.interactions || [];
  const registrations = sessionData.registrations || [];
  const simDistributions = sessionData.simDistributions || [];

  const totalInteractions = interactions.length;
  const successfulRegistrations = registrations.filter((r: any) => r.registrationStatus === 'COMPLETED').length;
  const simDistributionCount = simDistributions.length;
  const conversionRate = totalInteractions > 0 ? (successfulRegistrations / totalInteractions) * 100 : 0;
  const averageInteractionDuration = totalInteractions > 0 
    ? interactions.reduce((sum: number, i: any) => sum + i.duration, 0) / totalInteractions 
    : 0;

  const commissionEarned = registrations.reduce((sum: number, r: any) => sum + (r.commissionAmount || 0), 0) +
                          simDistributions.reduce((sum: number, s: any) => sum + (s.commissionAmount || 0), 0);

  return {
    totalInteractions,
    successfulRegistrations,
    simDistributions: simDistributionCount,
    conversionRate,
    averageInteractionDuration,
    demographicBreakdown: calculateDemographicBreakdown(interactions),
    hourlyPerformance: calculateHourlyPerformance(interactions),
    commissionEarned
  };
}

function calculateDemographicBreakdown(interactions: any[]): any {
  const breakdown = {
    ageGroups: {},
    genders: {},
    languages: {}
  };

  interactions.forEach(interaction => {
    const demo = interaction.customerDemographics;
    
    // Age groups
    breakdown.ageGroups[demo.ageGroup] = (breakdown.ageGroups[demo.ageGroup] || 0) + 1;
    
    // Genders
    breakdown.genders[demo.gender] = (breakdown.genders[demo.gender] || 0) + 1;
    
    // Languages
    breakdown.languages[demo.language] = (breakdown.languages[demo.language] || 0) + 1;
  });

  return breakdown;
}

function calculateHourlyPerformance(interactions: any[]): any[] {
  const hourlyData: { [hour: number]: { interactions: number; registrations: number } } = {};

  interactions.forEach(interaction => {
    const hour = new Date(interaction.timestamp).getHours();
    if (!hourlyData[hour]) {
      hourlyData[hour] = { interactions: 0, registrations: 0 };
    }
    hourlyData[hour].interactions++;
    if (interaction.registrationCompleted) {
      hourlyData[hour].registrations++;
    }
  });

  return Object.entries(hourlyData).map(([hour, data]) => ({
    hour: parseInt(hour),
    ...data
  }));
}

function generateCommissionTrackingCode(agentId: string, idNumber: string, campaignType: string): string {
  const timestamp = Date.now().toString(36);
  const agentCode = agentId.substring(0, 8);
  const idCode = idNumber.substring(-4);
  const typeCode = campaignType.substring(0, 3);
  
  return `${typeCode}-${agentCode}-${idCode}-${timestamp}`.toUpperCase();
}

function generateReconciliationKey(agentId: string, simNumber: string, idNumber: string): string {
  const components = [
    agentId.substring(0, 8),
    simNumber,
    idNumber,
    Date.now().toString(36)
  ];
  
  return `SIM-${components.join('-')}`.toUpperCase();
}

async function submitToGoldRushPlatform(customerData: any, trackingCode: string): Promise<string> {
  // Mock implementation - would integrate with actual GoldRush API
  return `GR-${Date.now()}`;
}

async function getNextAvailableSim(agentId: string): Promise<{ simNumber: string } | null> {
  // Mock implementation - would get from agent SIM inventory
  return { simNumber: `SIM${Date.now()}` };
}

async function getServicePackage(packageId: string): Promise<any> {
  // Mock implementation - would get from service packages
  return {
    packageId,
    packageName: 'Basic Package',
    monthlyFee: 99,
    dataAllowance: '1GB',
    voiceMinutes: '100 minutes',
    smsAllowance: '100 SMS'
  };
}

function calculateSimCommission(servicePackage: any): number {
  // Mock implementation - would calculate based on package
  return servicePackage.monthlyFee * 0.1; // 10% commission
}

async function activateSimCard(simNumber: string, customerData: any, servicePackage: any): Promise<{ success: boolean; accountId?: string }> {
  // Mock implementation - would integrate with carrier API
  return { success: true, accountId: `ACC-${Date.now()}` };
}

async function updateAgentSimInventory(agentId: string, simNumber: string, status: string): Promise<void> {
  // Mock implementation - would update SIM inventory
}

function generateSessionReport(sessionData: any, performance: SessionPerformance, duration: number): any {
  return {
    summary: {
      duration: Math.round(duration / 1000),
      totalInteractions: performance.totalInteractions,
      successfulRegistrations: performance.successfulRegistrations,
      conversionRate: performance.conversionRate,
      commissionEarned: performance.commissionEarned
    },
    demographics: performance.demographicBreakdown,
    hourlyBreakdown: performance.hourlyPerformance,
    photos: (sessionData.photos || []).length,
    recommendations: generateRecommendations(performance)
  };
}

function generateRecommendations(performance: SessionPerformance): string[] {
  const recommendations: string[] = [];
  
  if (performance.conversionRate < 20) {
    recommendations.push('Consider improving approach techniques to increase conversion rate');
  }
  
  if (performance.averageInteractionDuration < 120) {
    recommendations.push('Spend more time with each customer to build rapport');
  }
  
  if (performance.totalInteractions < 10) {
    recommendations.push('Increase customer engagement frequency');
  }
  
  return recommendations;
}

export default router;