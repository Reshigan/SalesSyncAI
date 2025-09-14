/**
 * Advanced Promotions & Activations API for SalesSync
 * Complete event activation management with GPS tracking and performance monitoring
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';
import { uploadToS3, compressImage, validateFile } from '../../utils/file-utils';
import { validateGPSAccuracy, calculateDistance, optimizeRoute } from '../../utils/gps-utils';
import { analyzeImage } from '../../services/ai-image-analysis';
import { detectFraud } from '../../services/fraud-detection';
import { sendNotification } from '../../services/notification-service';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 15
  }
});

interface ActivationEvent {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  type: 'PRODUCT_LAUNCH' | 'BRAND_ACTIVATION' | 'SAMPLING' | 'DEMONSTRATION' | 'SURVEY' | 'CONTEST' | 'ROADSHOW';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';
  location: EventLocation;
  schedule: EventSchedule;
  team: EventTeam;
  setup: EventSetup;
  execution: EventExecution;
  performance: EventPerformance;
  compliance: ComplianceTracking;
}

interface EventLocation {
  type: 'RETAIL_STORE' | 'SHOPPING_MALL' | 'PUBLIC_SPACE' | 'CORPORATE_OFFICE' | 'UNIVERSITY' | 'MOBILE_UNIT';
  name: string;
  address: string;
  coordinates: { latitude: number; longitude: number };
  accessInstructions: string;
  contactPerson?: ContactDetails;
  facilities: LocationFacilities;
  restrictions: string[];
  permits: PermitRequirement[];
}

interface ContactDetails {
  name: string;
  phone: string;
  email?: string;
  role: string;
}

interface LocationFacilities {
  electricityAvailable: boolean;
  waterAvailable: boolean;
  wifiAvailable: boolean;
  parkingAvailable: boolean;
  storageSpace: boolean;
  securityPresent: boolean;
  footTraffic: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  targetDemographic: string[];
}

interface PermitRequirement {
  type: string;
  required: boolean;
  obtained: boolean;
  expiryDate?: Date;
  documentUrl?: string;
}

interface EventSchedule {
  setupStart: Date;
  eventStart: Date;
  eventEnd: Date;
  teardownEnd: Date;
  breaks: ScheduleBreak[];
  milestones: ScheduleMilestone[];
}

interface ScheduleBreak {
  name: string;
  startTime: Date;
  endTime: Date;
  type: 'LUNCH' | 'COFFEE' | 'SHIFT_CHANGE' | 'MAINTENANCE';
}

interface ScheduleMilestone {
  name: string;
  targetTime: Date;
  description: string;
  critical: boolean;
}

interface EventTeam {
  leadPromoter: string;
  promoters: string[];
  supportStaff: string[];
  roles: TeamRole[];
  requirements: TeamRequirement[];
}

interface TeamRole {
  promoterId: string;
  role: 'LEAD' | 'PRESENTER' | 'SAMPLER' | 'SURVEYOR' | 'SETUP' | 'SECURITY' | 'PHOTOGRAPHER';
  responsibilities: string[];
  requiredSkills: string[];
}

interface TeamRequirement {
  skill: string;
  level: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  required: boolean;
  certified: boolean;
}

interface EventSetup {
  materials: SetupMaterial[];
  layout: SetupLayout;
  equipment: SetupEquipment[];
  safety: SafetyRequirement[];
  timeline: SetupTimeline[];
}

interface SetupMaterial {
  id: string;
  name: string;
  type: 'BANNER' | 'STANDEE' | 'TABLE' | 'CHAIR' | 'TENT' | 'DISPLAY' | 'PRODUCT' | 'SAMPLE' | 'BROCHURE';
  quantity: number;
  specifications: any;
  setupInstructions: string;
  safetyNotes?: string;
  storageRequirements?: string;
}

interface SetupLayout {
  diagram?: string;
  dimensions: { width: number; height: number; depth: number };
  zones: LayoutZone[];
  trafficFlow: TrafficFlowPattern[];
}

interface LayoutZone {
  name: string;
  purpose: string;
  coordinates: { x: number; y: number; width: number; height: number };
  materials: string[];
  accessibility: boolean;
}

interface TrafficFlowPattern {
  entry: string;
  exit: string;
  expectedVolume: number;
  peakHours: string[];
}

interface SetupEquipment {
  id: string;
  name: string;
  type: 'AUDIO' | 'VIDEO' | 'LIGHTING' | 'POWER' | 'COOLING' | 'HEATING' | 'SECURITY';
  specifications: any;
  powerRequirements?: string;
  setupComplexity: 'SIMPLE' | 'MODERATE' | 'COMPLEX';
  testingRequired: boolean;
}

interface SafetyRequirement {
  type: 'FIRE_SAFETY' | 'ELECTRICAL' | 'STRUCTURAL' | 'CROWD_CONTROL' | 'FOOD_SAFETY' | 'FIRST_AID';
  description: string;
  mandatory: boolean;
  checklistItems: string[];
  responsiblePerson: string;
}

interface SetupTimeline {
  task: string;
  startTime: Date;
  estimatedDuration: number; // minutes
  dependencies: string[];
  assignedTo: string[];
  critical: boolean;
}

interface EventExecution {
  activities: ExecutionActivity[];
  interactions: CustomerInteraction[];
  sales: ActivationSale[];
  surveys: SurveyResponse[];
  content: ContentCapture[];
  incidents: Incident[];
  realTimeMetrics: RealTimeMetrics;
}

interface ExecutionActivity {
  id: string;
  name: string;
  type: 'PRESENTATION' | 'DEMONSTRATION' | 'SAMPLING' | 'SURVEY' | 'GAME' | 'CONTEST' | 'PHOTO_OP';
  startTime: Date;
  endTime?: Date;
  participants: number;
  engagement: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCELLENT';
  outcome: 'SUCCESSFUL' | 'PARTIAL' | 'FAILED';
  notes: string;
  mediaCapture: string[];
}

interface CustomerInteraction {
  id: string;
  timestamp: Date;
  duration: number; // seconds
  demographics: CustomerDemographics;
  interactionType: 'INQUIRY' | 'SAMPLING' | 'PURCHASE' | 'SURVEY' | 'COMPLAINT' | 'COMPLIMENT';
  outcome: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  followUpRequired: boolean;
  contactCaptured: boolean;
  leadQuality: 'HOT' | 'WARM' | 'COLD';
  notes: string;
}

interface CustomerDemographics {
  ageGroup: string;
  gender: string;
  language: string;
  interests: string[];
  purchasingPower: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ActivationSale {
  id: string;
  timestamp: Date;
  customerId?: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE' | 'VOUCHER';
  promoterId: string;
  discountApplied?: number;
  upsellSuccess: boolean;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  totalPrice: number;
}

interface ContentCapture {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'AUDIO' | 'LIVE_STREAM';
  timestamp: Date;
  location: { latitude: number; longitude: number };
  description: string;
  url: string;
  quality: 'LOW' | 'MEDIUM' | 'HIGH' | 'PROFESSIONAL';
  approved: boolean;
  socialMediaReady: boolean;
  tags: string[];
}

interface Incident {
  id: string;
  timestamp: Date;
  type: 'SAFETY' | 'SECURITY' | 'EQUIPMENT' | 'WEATHER' | 'CROWD' | 'COMPLAINT' | 'TECHNICAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  actionTaken: string;
  resolved: boolean;
  reportedBy: string;
  photos?: string[];
}

interface RealTimeMetrics {
  currentAttendance: number;
  totalInteractions: number;
  salesGenerated: number;
  surveysCompleted: number;
  samplesDistributed: number;
  leadsCaptured: number;
  socialMediaMentions: number;
  sentimentScore: number;
  engagementRate: number;
  conversionRate: number;
}

interface EventPerformance {
  attendance: AttendanceMetrics;
  engagement: EngagementMetrics;
  sales: SalesMetrics;
  brand: BrandMetrics;
  roi: ROIMetrics;
  satisfaction: SatisfactionMetrics;
  comparison: BenchmarkComparison;
}

interface AttendanceMetrics {
  totalVisitors: number;
  uniqueVisitors: number;
  peakAttendance: number;
  peakTime: Date;
  averageDwellTime: number;
  returnVisitors: number;
  demographicBreakdown: any;
  hourlyBreakdown: any[];
}

interface EngagementMetrics {
  totalInteractions: number;
  averageInteractionDuration: number;
  engagementRate: number;
  activityParticipation: any;
  contentShares: number;
  feedbackScore: number;
  repeatEngagements: number;
}

interface SalesMetrics {
  totalRevenue: number;
  unitssold: number;
  averageTransactionValue: number;
  conversionRate: number;
  upsellRate: number;
  paymentMethodBreakdown: any;
  topSellingProducts: any[];
  salesByHour: any[];
}

interface BrandMetrics {
  brandAwareness: number;
  brandRecall: number;
  brandPreference: number;
  brandSentiment: number;
  socialMediaReach: number;
  socialMediaEngagement: number;
  mediaValue: number;
  competitorComparison: any;
}

interface ROIMetrics {
  totalCost: number;
  totalRevenue: number;
  netProfit: number;
  roi: number;
  costPerInteraction: number;
  costPerLead: number;
  costPerSale: number;
  paybackPeriod: number;
}

interface SatisfactionMetrics {
  customerSatisfaction: number;
  netPromoterScore: number;
  complaintRate: number;
  complimentRate: number;
  serviceQuality: number;
  productSatisfaction: number;
  overallExperience: number;
}

interface BenchmarkComparison {
  industryAverage: any;
  companyAverage: any;
  previousEvents: any;
  competitorEvents: any;
  performanceRanking: number;
}

interface ComplianceTracking {
  permits: PermitCompliance[];
  safety: SafetyCompliance[];
  brand: BrandCompliance[];
  legal: LegalCompliance[];
  environmental: EnvironmentalCompliance[];
  violations: ComplianceViolation[];
}

interface PermitCompliance {
  permitType: string;
  required: boolean;
  obtained: boolean;
  valid: boolean;
  expiryDate?: Date;
  violations: string[];
}

interface SafetyCompliance {
  requirement: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  checkDate: Date;
  checkedBy: string;
  notes: string;
  correctiveActions: string[];
}

interface BrandCompliance {
  guideline: string;
  compliant: boolean;
  deviations: string[];
  approvalRequired: boolean;
  approvedBy?: string;
}

interface LegalCompliance {
  regulation: string;
  applicable: boolean;
  compliant: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mitigationActions: string[];
}

interface EnvironmentalCompliance {
  requirement: string;
  impact: 'MINIMAL' | 'MODERATE' | 'SIGNIFICANT';
  mitigated: boolean;
  actions: string[];
}

interface ComplianceViolation {
  type: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  description: string;
  discoveredAt: Date;
  resolvedAt?: Date;
  penalty?: number;
  correctiveActions: string[];
}

/**
 * Create advanced activation event
 */
router.post('/activations/advanced',
  authMiddleware,
  upload.array('setupDiagrams', 5),
  [
    body('campaignId').isUUID().withMessage('Valid campaign ID required'),
    body('name').notEmpty().withMessage('Event name required'),
    body('type').isIn(['PRODUCT_LAUNCH', 'BRAND_ACTIVATION', 'SAMPLING', 'DEMONSTRATION', 'SURVEY', 'CONTEST', 'ROADSHOW']).withMessage('Valid event type required'),
    body('location.coordinates.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('location.coordinates.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('schedule.setupStart').isISO8601().withMessage('Valid setup start time required'),
    body('schedule.eventStart').isISO8601().withMessage('Valid event start time required'),
    body('schedule.eventEnd').isISO8601().withMessage('Valid event end time required'),
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

      const {
        campaignId,
        name,
        description,
        type,
        location,
        schedule,
        team,
        setup,
        compliance
      } = req.body;

      const files = req.files as Express.Multer.File[];

      // Validate campaign exists
      const campaign = await prisma.promotionCampaign.findFirst({
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

      // Process setup diagrams
      const setupDiagrams: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const diagramUrl = await uploadToS3(file.buffer, {
            bucket: process.env.AWS_S3_BUCKET!,
            key: `activations/diagrams/${Date.now()}-${file.originalname}`,
            contentType: file.mimetype
          });
          setupDiagrams.push(diagramUrl);
        }
      }

      // Create activation event
      const activation = await prisma.activationEvent.create({
        data: {
          campaignId,
          companyId: req.user!.companyId,
          name,
          description,
          type,
          status: 'SCHEDULED',
          location: JSON.stringify(location),
          schedule: JSON.stringify(schedule),
          team: JSON.stringify(team || {}),
          setup: JSON.stringify({
            ...setup,
            diagrams: setupDiagrams
          }),
          execution: JSON.stringify({
            activities: [],
            interactions: [],
            sales: [],
            surveys: [],
            content: [],
            incidents: [],
            realTimeMetrics: {
              currentAttendance: 0,
              totalInteractions: 0,
              salesGenerated: 0,
              surveysCompleted: 0,
              samplesDistributed: 0,
              leadsCaptured: 0,
              socialMediaMentions: 0,
              sentimentScore: 0,
              engagementRate: 0,
              conversionRate: 0
            }
          }),
          performance: JSON.stringify({}),
          compliance: JSON.stringify(compliance || {}),
          createdBy: req.user!.id
        }
      });

      // Create activation tracking
      await prisma.activationTracking.create({
        data: {
          activationId: activation.id,
          companyId: req.user!.companyId,
          trackingData: JSON.stringify({
            gpsLogs: [],
            attendanceLogs: [],
            performanceLogs: [],
            complianceLogs: []
          })
        }
      });

      // Notify assigned team members
      const assignedTeam = team?.promoters || [];
      if (assignedTeam.length > 0) {
        const notifications = assignedTeam.map((promoterId: string) => ({
          type: 'campaign' as const,
          recipientId: promoterId,
          title: 'New Activation Assignment',
          message: `You have been assigned to activation event "${name}"`,
          data: {
            activationId: activation.id,
            eventName: name,
            eventType: type,
            location: location.name,
            startTime: schedule.eventStart
          },
          priority: 'MEDIUM' as const
        }));

        await Promise.all(notifications.map(notification => sendNotification(notification)));
      }

      res.json({
        success: true,
        data: {
          activationId: activation.id,
          name: activation.name,
          status: activation.status,
          setupDiagrams: setupDiagrams.length,
          teamNotified: assignedTeam.length
        }
      });

    } catch (error) {
      console.error('Create activation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create activation event'
      });
    }
  }
);

/**
 * Start activation event with GPS verification
 */
router.post('/activations/:activationId/start',
  authMiddleware,
  [
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

      const { activationId } = req.params;
      const { location, setupPhotos } = req.body;

      // Get activation event
      const activation = await prisma.activationEvent.findFirst({
        where: {
          id: activationId,
          companyId: req.user!.companyId
        }
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: 'Activation event not found'
        });
      }

      if (activation.status !== 'SCHEDULED') {
        return res.status(400).json({
          success: false,
          error: 'Activation can only be started from scheduled status'
        });
      }

      // Validate GPS location against event location
      const eventLocation = JSON.parse(activation.location as string);
      const distance = calculateDistance(location, eventLocation.coordinates);
      const locationValid = distance <= 100; // 100 meter radius

      if (!locationValid) {
        return res.status(400).json({
          success: false,
          error: 'Location validation failed',
          details: {
            distance,
            maxAllowed: 100,
            eventLocation: eventLocation.coordinates
          }
        });
      }

      // Validate team member is assigned
      const team = JSON.parse(activation.team as string || '{}');
      const isAssigned = team.promoters?.includes(req.user!.id) || team.leadPromoter === req.user!.id;

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'User not assigned to this activation event'
        });
      }

      // Start activation
      await prisma.activationEvent.update({
        where: { id: activationId },
        data: {
          status: 'IN_PROGRESS',
          actualStartTime: new Date()
        }
      });

      // Initialize GPS tracking
      await initializeGPSTracking(activationId, req.user!.id, location);

      // Fraud detection check
      const fraudCheck = await detectFraud({
        agentId: req.user!.id,
        activityType: 'visit_start',
        location,
        timestamp: new Date(),
        metadata: { activationId, eventType: activation.type }
      });

      if (fraudCheck.riskLevel === 'HIGH') {
        await sendNotification({
          type: 'fraud_alert',
          recipientId: team.leadPromoter || 'system',
          title: 'Activation Fraud Alert',
          message: `High fraud risk detected for activation start by ${req.user!.firstName} ${req.user!.lastName}`,
          data: { activationId, fraudCheck },
          priority: 'HIGH'
        });
      }

      res.json({
        success: true,
        data: {
          activationId,
          status: 'IN_PROGRESS',
          locationValidation: {
            valid: locationValid,
            distance,
            accuracy: location.accuracy
          },
          fraudRisk: fraudCheck.riskLevel,
          startTime: new Date()
        }
      });

    } catch (error) {
      console.error('Start activation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start activation event'
      });
    }
  }
);

/**
 * Record customer interaction during activation
 */
router.post('/activations/:activationId/interactions',
  authMiddleware,
  [
    body('interactionType').isIn(['INQUIRY', 'SAMPLING', 'PURCHASE', 'SURVEY', 'COMPLAINT', 'COMPLIMENT']).withMessage('Valid interaction type required'),
    body('duration').isInt({ min: 1 }).withMessage('Valid duration required'),
    body('demographics.ageGroup').notEmpty().withMessage('Age group required'),
    body('demographics.gender').notEmpty().withMessage('Gender required'),
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

      const { activationId } = req.params;
      const { interactionType, duration, demographics, outcome, followUpRequired, contactCaptured, leadQuality, notes } = req.body;

      // Validate activation is in progress
      const activation = await prisma.activationEvent.findFirst({
        where: {
          id: activationId,
          companyId: req.user!.companyId,
          status: 'IN_PROGRESS'
        }
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: 'Active activation event not found'
        });
      }

      // Create interaction record
      const interaction: CustomerInteraction = {
        id: uuidv4(),
        timestamp: new Date(),
        duration,
        demographics,
        interactionType,
        outcome: outcome || 'NEUTRAL',
        followUpRequired: followUpRequired || false,
        contactCaptured: contactCaptured || false,
        leadQuality: leadQuality || 'COLD',
        notes: notes || ''
      };

      // Update activation execution data
      const execution = JSON.parse(activation.execution as string || '{}');
      execution.interactions = execution.interactions || [];
      execution.interactions.push(interaction);

      // Update real-time metrics
      execution.realTimeMetrics = execution.realTimeMetrics || {};
      execution.realTimeMetrics.totalInteractions = execution.interactions.length;
      execution.realTimeMetrics.leadsCaptured = execution.interactions.filter((i: any) => i.contactCaptured).length;
      execution.realTimeMetrics.engagementRate = calculateEngagementRate(execution.interactions);

      await prisma.activationEvent.update({
        where: { id: activationId },
        data: {
          execution: JSON.stringify(execution)
        }
      });

      // Log GPS tracking point
      await logGPSTrackingPoint(activationId, req.user!.id, 'INTERACTION');

      res.json({
        success: true,
        data: {
          interactionId: interaction.id,
          realTimeMetrics: execution.realTimeMetrics
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
 * Process sale during activation
 */
router.post('/activations/:activationId/sales',
  authMiddleware,
  [
    body('items').isArray().withMessage('Sale items required'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Valid total amount required'),
    body('paymentMethod').isIn(['CASH', 'CARD', 'MOBILE', 'VOUCHER']).withMessage('Valid payment method required'),
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

      const { activationId } = req.params;
      const { customerId, items, totalAmount, paymentMethod, discountApplied, upsellSuccess } = req.body;

      // Validate activation is in progress
      const activation = await prisma.activationEvent.findFirst({
        where: {
          id: activationId,
          companyId: req.user!.companyId,
          status: 'IN_PROGRESS'
        }
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: 'Active activation event not found'
        });
      }

      // Create sale record
      const sale: ActivationSale = {
        id: uuidv4(),
        timestamp: new Date(),
        customerId,
        items,
        totalAmount,
        paymentMethod,
        promoterId: req.user!.id,
        discountApplied,
        upsellSuccess: upsellSuccess || false
      };

      // Update activation execution data
      const execution = JSON.parse(activation.execution as string || '{}');
      execution.sales = execution.sales || [];
      execution.sales.push(sale);

      // Update real-time metrics
      execution.realTimeMetrics = execution.realTimeMetrics || {};
      execution.realTimeMetrics.salesGenerated = execution.sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0);
      execution.realTimeMetrics.conversionRate = calculateConversionRate(execution.interactions, execution.sales);

      await prisma.activationEvent.update({
        where: { id: activationId },
        data: {
          execution: JSON.stringify(execution)
        }
      });

      // Create sale transaction in main system
      await prisma.sale.create({
        data: {
          companyId: req.user!.companyId,
          agentId: req.user!.id,
          customerId,
          totalAmount,
          paymentMethod,
          status: 'COMPLETED',
          metadata: JSON.stringify({
            activationId,
            saleId: sale.id,
            eventType: activation.type
          })
        }
      });

      res.json({
        success: true,
        data: {
          saleId: sale.id,
          totalAmount: sale.totalAmount,
          realTimeMetrics: execution.realTimeMetrics
        }
      });

    } catch (error) {
      console.error('Process sale error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process sale'
      });
    }
  }
);

/**
 * Capture content during activation
 */
router.post('/activations/:activationId/content',
  authMiddleware,
  upload.array('content', 10),
  [
    body('type').isIn(['PHOTO', 'VIDEO', 'AUDIO', 'LIVE_STREAM']).withMessage('Valid content type required'),
    body('description').notEmpty().withMessage('Content description required'),
  ],
  async (req: AuthenticatedRequest, res) => {
    try {
      const { activationId } = req.params;
      const { type, description, tags, socialMediaReady } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No content files uploaded'
        });
      }

      // Validate activation is in progress
      const activation = await prisma.activationEvent.findFirst({
        where: {
          id: activationId,
          companyId: req.user!.companyId,
          status: 'IN_PROGRESS'
        }
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: 'Active activation event not found'
        });
      }

      const contentItems: ContentCapture[] = [];

      // Process each content file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file
        const validation = await validateFile({
          buffer: file.buffer,
          mimetype: file.mimetype,
          size: file.size
        });

        if (!validation.valid) {
          continue; // Skip invalid files
        }

        // Compress if image
        let processedBuffer = file.buffer;
        if (file.mimetype.startsWith('image/')) {
          processedBuffer = await compressImage(file.buffer, { quality: 85 });
        }

        // Upload to S3
        const contentUrl = await uploadToS3(processedBuffer, {
          bucket: process.env.AWS_S3_BUCKET!,
          key: `activations/${activationId}/content/${Date.now()}-${i}-${file.originalname}`,
          contentType: file.mimetype
        });

        // AI analysis for images
        let quality = 'MEDIUM';
        if (file.mimetype.startsWith('image/')) {
          const analysis = await analyzeImage(processedBuffer, {
            type: 'quality_check',
            companyId: req.user!.companyId
          });
          quality = analysis.qualityScore > 80 ? 'HIGH' : analysis.qualityScore > 60 ? 'MEDIUM' : 'LOW';
        }

        const contentItem: ContentCapture = {
          id: uuidv4(),
          type,
          timestamp: new Date(),
          location: { latitude: 0, longitude: 0 }, // Would get from current GPS
          description,
          url: contentUrl,
          quality: quality as any,
          approved: false,
          socialMediaReady: socialMediaReady || false,
          tags: tags || []
        };

        contentItems.push(contentItem);
      }

      // Update activation execution data
      const execution = JSON.parse(activation.execution as string || '{}');
      execution.content = execution.content || [];
      execution.content.push(...contentItems);

      await prisma.activationEvent.update({
        where: { id: activationId },
        data: {
          execution: JSON.stringify(execution)
        }
      });

      res.json({
        success: true,
        data: {
          contentUploaded: contentItems.length,
          contentItems: contentItems.map(c => ({
            id: c.id,
            type: c.type,
            url: c.url,
            quality: c.quality
          }))
        }
      });

    } catch (error) {
      console.error('Capture content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to capture content'
      });
    }
  }
);

/**
 * Report incident during activation
 */
router.post('/activations/:activationId/incidents',
  authMiddleware,
  upload.array('incidentPhotos', 5),
  [
    body('type').isIn(['SAFETY', 'SECURITY', 'EQUIPMENT', 'WEATHER', 'CROWD', 'COMPLAINT', 'TECHNICAL']).withMessage('Valid incident type required'),
    body('severity').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Valid severity required'),
    body('description').notEmpty().withMessage('Incident description required'),
  ],
  async (req: AuthenticatedRequest, res) => {
    try {
      const { activationId } = req.params;
      const { type, severity, description, actionTaken } = req.body;
      const files = req.files as Express.Multer.File[];

      // Validate activation is in progress
      const activation = await prisma.activationEvent.findFirst({
        where: {
          id: activationId,
          companyId: req.user!.companyId,
          status: 'IN_PROGRESS'
        }
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: 'Active activation event not found'
        });
      }

      // Process incident photos
      const incidentPhotos: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const photoUrl = await uploadToS3(file.buffer, {
            bucket: process.env.AWS_S3_BUCKET!,
            key: `activations/${activationId}/incidents/${Date.now()}-${file.originalname}`,
            contentType: file.mimetype
          });
          incidentPhotos.push(photoUrl);
        }
      }

      // Create incident record
      const incident: Incident = {
        id: uuidv4(),
        timestamp: new Date(),
        type,
        severity,
        description,
        actionTaken: actionTaken || '',
        resolved: false,
        reportedBy: req.user!.id,
        photos: incidentPhotos
      };

      // Update activation execution data
      const execution = JSON.parse(activation.execution as string || '{}');
      execution.incidents = execution.incidents || [];
      execution.incidents.push(incident);

      await prisma.activationEvent.update({
        where: { id: activationId },
        data: {
          execution: JSON.stringify(execution)
        }
      });

      // Send notifications for high severity incidents
      if (severity === 'HIGH' || severity === 'CRITICAL') {
        const team = JSON.parse(activation.team as string || '{}');
        if (team.leadPromoter) {
          await sendNotification({
            type: 'error',
            recipientId: team.leadPromoter,
            title: `${severity} Incident Reported`,
            message: `${type} incident reported at activation "${activation.name}"`,
            data: {
              activationId,
              incidentId: incident.id,
              type,
              severity,
              description
            },
            priority: severity === 'CRITICAL' ? 'URGENT' : 'HIGH'
          });
        }
      }

      res.json({
        success: true,
        data: {
          incidentId: incident.id,
          severity: incident.severity,
          photosUploaded: incidentPhotos.length
        }
      });

    } catch (error) {
      console.error('Report incident error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to report incident'
      });
    }
  }
);

/**
 * Complete activation event
 */
router.post('/activations/:activationId/complete',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { activationId } = req.params;
      const { notes, teardownPhotos } = req.body;

      // Validate activation is in progress
      const activation = await prisma.activationEvent.findFirst({
        where: {
          id: activationId,
          companyId: req.user!.companyId,
          status: 'IN_PROGRESS'
        }
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: 'Active activation event not found'
        });
      }

      // Calculate final performance metrics
      const execution = JSON.parse(activation.execution as string || '{}');
      const performance = calculateFinalPerformance(execution, activation);

      // Complete activation
      await prisma.activationEvent.update({
        where: { id: activationId },
        data: {
          status: 'COMPLETED',
          actualEndTime: new Date(),
          performance: JSON.stringify(performance),
          notes
        }
      });

      // Generate activation report
      const report = generateActivationReport(activation, execution, performance);

      // Notify team and management
      const team = JSON.parse(activation.team as string || '{}');
      const notifications = [];

      if (team.leadPromoter) {
        notifications.push({
          type: 'success' as const,
          recipientId: team.leadPromoter,
          title: 'Activation Completed',
          message: `Activation "${activation.name}" has been completed successfully`,
          data: {
            activationId,
            performance: performance.roi,
            report
          }
        });
      }

      if (notifications.length > 0) {
        await Promise.all(notifications.map(notification => sendNotification(notification)));
      }

      res.json({
        success: true,
        data: {
          activationId,
          status: 'COMPLETED',
          performance,
          report
        }
      });

    } catch (error) {
      console.error('Complete activation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete activation'
      });
    }
  }
);

/**
 * Get real-time activation metrics
 */
router.get('/activations/:activationId/metrics',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { activationId } = req.params;

      // Get activation with current data
      const activation = await prisma.activationEvent.findFirst({
        where: {
          id: activationId,
          companyId: req.user!.companyId
        }
      });

      if (!activation) {
        return res.status(404).json({
          success: false,
          error: 'Activation event not found'
        });
      }

      const execution = JSON.parse(activation.execution as string || '{}');
      const realTimeMetrics = execution.realTimeMetrics || {};

      // Calculate additional metrics
      const enhancedMetrics = {
        ...realTimeMetrics,
        currentTime: new Date(),
        eventDuration: activation.actualStartTime 
          ? Math.round((new Date().getTime() - new Date(activation.actualStartTime).getTime()) / 1000 / 60) // minutes
          : 0,
        interactionRate: calculateInteractionRate(execution.interactions),
        salesRate: calculateSalesRate(execution.sales),
        incidentCount: (execution.incidents || []).length,
        contentCount: (execution.content || []).length,
        teamPresent: calculateTeamPresence(activation.team)
      };

      res.json({
        success: true,
        data: enhancedMetrics
      });

    } catch (error) {
      console.error('Get activation metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get activation metrics'
      });
    }
  }
);

// Helper functions

async function initializeGPSTracking(activationId: string, promoterId: string, location: any): Promise<void> {
  await prisma.activationTracking.upsert({
    where: { activationId },
    update: {
      trackingData: JSON.stringify({
        gpsLogs: [{
          promoterId,
          timestamp: new Date(),
          location,
          activity: 'START'
        }],
        attendanceLogs: [],
        performanceLogs: [],
        complianceLogs: []
      })
    },
    create: {
      activationId,
      companyId: '', // Would be set properly
      trackingData: JSON.stringify({
        gpsLogs: [{
          promoterId,
          timestamp: new Date(),
          location,
          activity: 'START'
        }],
        attendanceLogs: [],
        performanceLogs: [],
        complianceLogs: []
      })
    }
  });
}

async function logGPSTrackingPoint(activationId: string, promoterId: string, activity: string): Promise<void> {
  const tracking = await prisma.activationTracking.findUnique({
    where: { activationId }
  });

  if (tracking) {
    const trackingData = JSON.parse(tracking.trackingData as string);
    trackingData.gpsLogs = trackingData.gpsLogs || [];
    trackingData.gpsLogs.push({
      promoterId,
      timestamp: new Date(),
      activity
    });

    await prisma.activationTracking.update({
      where: { activationId },
      data: {
        trackingData: JSON.stringify(trackingData)
      }
    });
  }
}

function calculateEngagementRate(interactions: any[]): number {
  if (!interactions || interactions.length === 0) return 0;
  const positiveInteractions = interactions.filter(i => i.outcome === 'POSITIVE').length;
  return (positiveInteractions / interactions.length) * 100;
}

function calculateConversionRate(interactions: any[], sales: any[]): number {
  if (!interactions || interactions.length === 0) return 0;
  return (sales.length / interactions.length) * 100;
}

function calculateInteractionRate(interactions: any[]): number {
  if (!interactions || interactions.length === 0) return 0;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentInteractions = interactions.filter(i => new Date(i.timestamp) >= oneHourAgo);
  return recentInteractions.length;
}

function calculateSalesRate(sales: any[]): number {
  if (!sales || sales.length === 0) return 0;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentSales = sales.filter(s => new Date(s.timestamp) >= oneHourAgo);
  return recentSales.reduce((sum, s) => sum + s.totalAmount, 0);
}

function calculateTeamPresence(team: any): number {
  // Mock implementation - would track actual team check-ins
  return team?.promoters?.length || 0;
}

function calculateFinalPerformance(execution: any, activation: any): EventPerformance {
  const interactions = execution.interactions || [];
  const sales = execution.sales || [];
  const content = execution.content || [];

  return {
    attendance: {
      totalVisitors: interactions.length,
      uniqueVisitors: interactions.length, // Simplified
      peakAttendance: Math.max(10, interactions.length),
      peakTime: new Date(),
      averageDwellTime: interactions.reduce((sum: number, i: any) => sum + i.duration, 0) / interactions.length || 0,
      returnVisitors: 0,
      demographicBreakdown: calculateDemographicBreakdown(interactions),
      hourlyBreakdown: calculateHourlyBreakdown(interactions)
    },
    engagement: {
      totalInteractions: interactions.length,
      averageInteractionDuration: interactions.reduce((sum: number, i: any) => sum + i.duration, 0) / interactions.length || 0,
      engagementRate: calculateEngagementRate(interactions),
      activityParticipation: {},
      contentShares: 0,
      feedbackScore: 85, // Mock
      repeatEngagements: 0
    },
    sales: {
      totalRevenue: sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
      unitsold: sales.reduce((sum: number, s: any) => sum + s.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0),
      averageTransactionValue: sales.length > 0 ? sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0) / sales.length : 0,
      conversionRate: calculateConversionRate(interactions, sales),
      upsellRate: sales.filter((s: any) => s.upsellSuccess).length / sales.length * 100 || 0,
      paymentMethodBreakdown: calculatePaymentMethodBreakdown(sales),
      topSellingProducts: calculateTopSellingProducts(sales),
      salesByHour: calculateSalesByHour(sales)
    },
    brand: {
      brandAwareness: 75, // Mock
      brandRecall: 68,
      brandPreference: 72,
      brandSentiment: 80,
      socialMediaReach: content.length * 100,
      socialMediaEngagement: content.length * 50,
      mediaValue: content.length * 200,
      competitorComparison: {}
    },
    roi: {
      totalCost: 5000, // Mock
      totalRevenue: sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
      netProfit: sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0) - 5000,
      roi: sales.length > 0 ? ((sales.reduce((sum: number, s: any) => sum + s.totalAmount, 0) - 5000) / 5000) * 100 : -100,
      costPerInteraction: interactions.length > 0 ? 5000 / interactions.length : 0,
      costPerLead: interactions.filter((i: any) => i.contactCaptured).length > 0 ? 5000 / interactions.filter((i: any) => i.contactCaptured).length : 0,
      costPerSale: sales.length > 0 ? 5000 / sales.length : 0,
      paybackPeriod: 30 // days
    },
    satisfaction: {
      customerSatisfaction: 85, // Mock
      netPromoterScore: 72,
      complaintRate: 2,
      complimentRate: 15,
      serviceQuality: 88,
      productSatisfaction: 82,
      overallExperience: 85
    },
    comparison: {
      industryAverage: {},
      companyAverage: {},
      previousEvents: {},
      competitorEvents: {},
      performanceRanking: 1
    }
  };
}

function calculateDemographicBreakdown(interactions: any[]): any {
  const breakdown = { ageGroups: {}, genders: {} };
  interactions.forEach(i => {
    const demo = i.demographics;
    breakdown.ageGroups[demo.ageGroup] = (breakdown.ageGroups[demo.ageGroup] || 0) + 1;
    breakdown.genders[demo.gender] = (breakdown.genders[demo.gender] || 0) + 1;
  });
  return breakdown;
}

function calculateHourlyBreakdown(interactions: any[]): any[] {
  const hourlyData: { [hour: number]: number } = {};
  interactions.forEach(i => {
    const hour = new Date(i.timestamp).getHours();
    hourlyData[hour] = (hourlyData[hour] || 0) + 1;
  });
  return Object.entries(hourlyData).map(([hour, count]) => ({ hour: parseInt(hour), interactions: count }));
}

function calculatePaymentMethodBreakdown(sales: any[]): any {
  const breakdown = {};
  sales.forEach(s => {
    breakdown[s.paymentMethod] = (breakdown[s.paymentMethod] || 0) + 1;
  });
  return breakdown;
}

function calculateTopSellingProducts(sales: any[]): any[] {
  const productSales: { [productId: string]: { name: string; quantity: number; revenue: number } } = {};
  
  sales.forEach(s => {
    s.items.forEach((item: any) => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
      }
      productSales[item.productId].quantity += item.quantity;
      productSales[item.productId].revenue += item.totalPrice;
    });
  });

  return Object.entries(productSales)
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

function calculateSalesByHour(sales: any[]): any[] {
  const hourlyData: { [hour: number]: { sales: number; revenue: number } } = {};
  
  sales.forEach(s => {
    const hour = new Date(s.timestamp).getHours();
    if (!hourlyData[hour]) {
      hourlyData[hour] = { sales: 0, revenue: 0 };
    }
    hourlyData[hour].sales++;
    hourlyData[hour].revenue += s.totalAmount;
  });

  return Object.entries(hourlyData).map(([hour, data]) => ({ hour: parseInt(hour), ...data }));
}

function generateActivationReport(activation: any, execution: any, performance: EventPerformance): any {
  return {
    summary: {
      eventName: activation.name,
      eventType: activation.type,
      duration: activation.actualEndTime && activation.actualStartTime 
        ? Math.round((new Date(activation.actualEndTime).getTime() - new Date(activation.actualStartTime).getTime()) / 1000 / 60)
        : 0,
      totalInteractions: performance.engagement.totalInteractions,
      totalRevenue: performance.sales.totalRevenue,
      roi: performance.roi.roi,
      customerSatisfaction: performance.satisfaction.customerSatisfaction
    },
    highlights: [
      `Generated ${performance.sales.totalRevenue.toFixed(2)} in revenue`,
      `Engaged with ${performance.attendance.totalVisitors} customers`,
      `Achieved ${performance.sales.conversionRate.toFixed(1)}% conversion rate`,
      `Created ${(execution.content || []).length} pieces of content`
    ],
    recommendations: generateActivationRecommendations(performance),
    nextSteps: [
      'Follow up with captured leads',
      'Analyze customer feedback',
      'Plan follow-up activations',
      'Share content on social media'
    ]
  };
}

function generateActivationRecommendations(performance: EventPerformance): string[] {
  const recommendations: string[] = [];

  if (performance.sales.conversionRate < 10) {
    recommendations.push('Improve engagement techniques to increase conversion rate');
  }

  if (performance.roi.roi < 0) {
    recommendations.push('Review cost structure and pricing strategy');
  }

  if (performance.engagement.engagementRate < 50) {
    recommendations.push('Enhance activation activities to improve customer engagement');
  }

  if (performance.satisfaction.customerSatisfaction < 80) {
    recommendations.push('Focus on improving customer experience and service quality');
  }

  return recommendations;
}

export default router;