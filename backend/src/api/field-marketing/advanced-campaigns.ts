/**
 * Advanced Campaign Management API for SalesSync
 * Complete campaign lifecycle management with advanced features
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';
import { body, query, validationResult } from 'express-validator';
import { uploadToS3, compressImage } from '../../utils/file-utils';
import { sendNotification, sendBulkNotifications } from '../../services/notification-service';
import { analyzeImage } from '../../services/ai-image-analysis';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for campaign materials
    files: 20
  }
});

interface CampaignConfiguration {
  id: string;
  name: string;
  description: string;
  type: 'BRAND_AWARENESS' | 'PRODUCT_LAUNCH' | 'CUSTOMER_ACQUISITION' | 'SURVEY_COLLECTION' | 'SIM_DISTRIBUTION';
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startDate: Date;
  endDate: Date;
  budget: number;
  targetMetrics: CampaignTargets;
  territories: Territory[];
  assignedAgents: string[];
  materials: CampaignMaterial[];
  script: CampaignScript;
  questionnaire?: Questionnaire;
  incentives: IncentiveStructure;
  complianceRules: ComplianceRule[];
}

interface CampaignTargets {
  totalInteractions: number;
  successfulRegistrations: number;
  conversionRate: number; // percentage
  revenueTarget?: number;
  geographicCoverage: number; // percentage of territory
  demographicTargets: DemographicTarget[];
}

interface DemographicTarget {
  ageGroup: string;
  gender: string;
  targetPercentage: number;
}

interface Territory {
  id: string;
  name: string;
  boundaries: GeoBoundary[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  expectedTraffic: number;
  restrictions?: string[];
}

interface GeoBoundary {
  latitude: number;
  longitude: number;
}

interface CampaignMaterial {
  id: string;
  type: 'BANNER' | 'BROCHURE' | 'SAMPLE' | 'STANDEE' | 'DIGITAL_ASSET' | 'UNIFORM' | 'EQUIPMENT';
  name: string;
  description: string;
  specifications: MaterialSpecification;
  quantityPerAgent: number;
  setupInstructions?: string;
  complianceRequirements?: string[];
  digitalAssetUrl?: string;
  physicalAssetTracking: boolean;
}

interface MaterialSpecification {
  dimensions?: string;
  weight?: string;
  color?: string;
  material?: string;
  durability?: string;
  weatherResistance?: boolean;
}

interface CampaignScript {
  sections: ScriptSection[];
  branching: ScriptBranching[];
  timeEstimate: number; // minutes
  languages: string[];
  adaptations: ScriptAdaptation[];
}

interface ScriptSection {
  id: string;
  name: string;
  content: string;
  duration: number; // seconds
  required: boolean;
  triggers: string[];
  followUpQuestions: string[];
}

interface ScriptBranching {
  fromSection: string;
  toSection: string;
  condition: string;
  conditionType: 'RESPONSE' | 'DEMOGRAPHIC' | 'TIME' | 'LOCATION';
}

interface ScriptAdaptation {
  demographic: string;
  modifications: string[];
  culturalConsiderations: string[];
}

interface Questionnaire {
  id: string;
  name: string;
  questions: Question[];
  logic: QuestionLogic[];
  estimatedDuration: number;
  incentivePerCompletion: number;
}

interface Question {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'TEXT' | 'NUMBER' | 'RATING' | 'PHOTO' | 'LOCATION';
  required: boolean;
  options?: string[];
  validation?: ValidationRule[];
  photoRequirements?: PhotoRequirement[];
}

interface QuestionLogic {
  questionId: string;
  condition: string;
  action: 'SHOW' | 'HIDE' | 'REQUIRE' | 'SKIP_TO';
  targetQuestionId?: string;
}

interface ValidationRule {
  type: 'MIN_LENGTH' | 'MAX_LENGTH' | 'PATTERN' | 'RANGE';
  value: any;
  message: string;
}

interface PhotoRequirement {
  type: 'PRODUCT' | 'SHELF' | 'STORE' | 'RECEIPT' | 'ASSET';
  minResolution: string;
  maxFileSize: number;
  requiredElements: string[];
}

interface IncentiveStructure {
  baseCommission: number;
  bonuses: IncentiveBonus[];
  penalties: IncentivePenalty[];
  paymentSchedule: 'IMMEDIATE' | 'WEEKLY' | 'MONTHLY';
  qualificationCriteria: QualificationCriteria[];
}

interface IncentiveBonus {
  type: 'VOLUME' | 'QUALITY' | 'SPEED' | 'TERRITORY' | 'DEMOGRAPHIC';
  threshold: number;
  amount: number;
  description: string;
}

interface IncentivePenalty {
  type: 'QUALITY' | 'COMPLIANCE' | 'FRAUD';
  threshold: number;
  amount: number;
  description: string;
}

interface QualificationCriteria {
  metric: string;
  operator: 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE';
  value: number;
  description: string;
}

interface ComplianceRule {
  id: string;
  type: 'LEGAL' | 'BRAND' | 'SAFETY' | 'PRIVACY';
  description: string;
  requirements: string[];
  violations: ComplianceViolation[];
  monitoring: boolean;
}

interface ComplianceViolation {
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  action: 'WARNING' | 'SUSPENSION' | 'TERMINATION';
  description: string;
}

/**
 * Create advanced campaign
 */
router.post('/campaigns/advanced',
  authMiddleware,
  upload.array('materials', 20),
  [
    body('name').notEmpty().withMessage('Campaign name required'),
    body('type').isIn(['BRAND_AWARENESS', 'PRODUCT_LAUNCH', 'CUSTOMER_ACQUISITION', 'SURVEY_COLLECTION', 'SIM_DISTRIBUTION']).withMessage('Valid campaign type required'),
    body('startDate').isISO8601().withMessage('Valid start date required'),
    body('endDate').isISO8601().withMessage('Valid end date required'),
    body('budget').isFloat({ min: 0 }).withMessage('Valid budget required'),
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
        name,
        description,
        type,
        startDate,
        endDate,
        budget,
        targetMetrics,
        territories,
        assignedAgents,
        script,
        questionnaire,
        incentives,
        complianceRules
      } = req.body;

      const files = req.files as Express.Multer.File[];

      // Process uploaded materials
      const materials: CampaignMaterial[] = [];
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          // Upload to S3
          const materialUrl = await uploadToS3(file.buffer, {
            bucket: process.env.AWS_S3_BUCKET!,
            key: `campaigns/materials/${Date.now()}-${file.originalname}`,
            contentType: file.mimetype
          });

          materials.push({
            id: uuidv4(),
            type: 'DIGITAL_ASSET',
            name: file.originalname,
            description: `Uploaded material: ${file.originalname}`,
            specifications: {
              dimensions: `${file.size} bytes`
            },
            quantityPerAgent: 1,
            digitalAssetUrl: materialUrl,
            physicalAssetTracking: false
          });
        }
      }

      // Create campaign
      const campaign = await prisma.marketingCampaign.create({
        data: {
          companyId: req.user!.companyId,
          name,
          description,
          type,
          status: 'DRAFT',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          budget,
          targetMetrics: JSON.stringify(targetMetrics),
          territories: JSON.stringify(territories || []),
          assignedAgents: JSON.stringify(assignedAgents || []),
          materials: JSON.stringify(materials),
          script: JSON.stringify(script || {}),
          questionnaire: JSON.stringify(questionnaire || {}),
          incentives: JSON.stringify(incentives || {}),
          complianceRules: JSON.stringify(complianceRules || []),
          createdBy: req.user!.id
        }
      });

      // Create campaign performance tracking
      await prisma.campaignPerformance.create({
        data: {
          campaignId: campaign.id,
          companyId: req.user!.companyId,
          metrics: JSON.stringify({
            totalInteractions: 0,
            successfulRegistrations: 0,
            conversionRate: 0,
            revenue: 0,
            agentPerformance: {},
            territoryPerformance: {},
            demographicBreakdown: {}
          })
        }
      });

      res.json({
        success: true,
        data: {
          campaignId: campaign.id,
          name: campaign.name,
          status: campaign.status,
          materialsUploaded: materials.length
        }
      });

    } catch (error) {
      console.error('Create campaign error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create campaign'
      });
    }
  }
);

/**
 * Activate campaign
 */
router.post('/campaigns/:campaignId/activate',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { campaignId } = req.params;

      // Get campaign
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

      if (campaign.status !== 'DRAFT') {
        return res.status(400).json({
          success: false,
          error: 'Campaign can only be activated from draft status'
        });
      }

      // Validate campaign readiness
      const validationResult = await validateCampaignReadiness(campaign);
      if (!validationResult.ready) {
        return res.status(400).json({
          success: false,
          error: 'Campaign not ready for activation',
          details: validationResult.issues
        });
      }

      // Activate campaign
      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          activatedBy: req.user!.id
        }
      });

      // Notify assigned agents
      const assignedAgents = JSON.parse(campaign.assignedAgents as string || '[]');
      if (assignedAgents.length > 0) {
        const notifications = assignedAgents.map((agentId: string) => ({
          type: 'campaign' as const,
          recipientId: agentId,
          title: 'New Campaign Activated',
          message: `Campaign "${campaign.name}" has been activated and is ready for execution`,
          data: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            campaignType: campaign.type,
            startDate: campaign.startDate,
            endDate: campaign.endDate
          },
          priority: 'MEDIUM' as const
        }));

        await sendBulkNotifications(notifications);
      }

      // Initialize campaign tracking
      await initializeCampaignTracking(campaignId);

      res.json({
        success: true,
        data: {
          campaignId,
          status: 'ACTIVE',
          activatedAt: new Date(),
          agentsNotified: assignedAgents.length
        }
      });

    } catch (error) {
      console.error('Activate campaign error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to activate campaign'
      });
    }
  }
);

/**
 * Get campaign performance analytics
 */
router.get('/campaigns/:campaignId/analytics',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { campaignId } = req.params;
      const { timeframe = '7d', breakdown = 'daily' } = req.query;

      // Get campaign with performance data
      const campaign = await prisma.marketingCampaign.findFirst({
        where: {
          id: campaignId,
          companyId: req.user!.companyId
        },
        include: {
          performance: true,
          sessions: {
            where: {
              status: 'COMPLETED'
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

      // Calculate comprehensive analytics
      const analytics = await calculateCampaignAnalytics(campaign, timeframe as string, breakdown as string);

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      console.error('Get campaign analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get campaign analytics'
      });
    }
  }
);

/**
 * Update campaign materials
 */
router.put('/campaigns/:campaignId/materials',
  authMiddleware,
  upload.array('newMaterials', 10),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { campaignId } = req.params;
      const { materialsToRemove, materialUpdates } = req.body;
      const files = req.files as Express.Multer.File[];

      // Get campaign
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

      let materials = JSON.parse(campaign.materials as string || '[]');

      // Remove materials
      if (materialsToRemove && Array.isArray(materialsToRemove)) {
        materials = materials.filter((m: any) => !materialsToRemove.includes(m.id));
      }

      // Update existing materials
      if (materialUpdates && Array.isArray(materialUpdates)) {
        materialUpdates.forEach((update: any) => {
          const materialIndex = materials.findIndex((m: any) => m.id === update.id);
          if (materialIndex !== -1) {
            materials[materialIndex] = { ...materials[materialIndex], ...update };
          }
        });
      }

      // Add new materials
      if (files && files.length > 0) {
        for (const file of files) {
          const materialUrl = await uploadToS3(file.buffer, {
            bucket: process.env.AWS_S3_BUCKET!,
            key: `campaigns/materials/${campaignId}/${Date.now()}-${file.originalname}`,
            contentType: file.mimetype
          });

          materials.push({
            id: uuidv4(),
            type: 'DIGITAL_ASSET',
            name: file.originalname,
            description: `Updated material: ${file.originalname}`,
            specifications: {
              dimensions: `${file.size} bytes`
            },
            quantityPerAgent: 1,
            digitalAssetUrl: materialUrl,
            physicalAssetTracking: false
          });
        }
      }

      // Update campaign
      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          materials: JSON.stringify(materials),
          updatedAt: new Date()
        }
      });

      // Notify agents of material updates
      const assignedAgents = JSON.parse(campaign.assignedAgents as string || '[]');
      if (assignedAgents.length > 0) {
        const notifications = assignedAgents.map((agentId: string) => ({
          type: 'campaign' as const,
          recipientId: agentId,
          title: 'Campaign Materials Updated',
          message: `Materials for campaign "${campaign.name}" have been updated`,
          data: {
            campaignId: campaign.id,
            materialsCount: materials.length
          }
        }));

        await sendBulkNotifications(notifications);
      }

      res.json({
        success: true,
        data: {
          materialsCount: materials.length,
          agentsNotified: assignedAgents.length
        }
      });

    } catch (error) {
      console.error('Update campaign materials error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update campaign materials'
      });
    }
  }
);

/**
 * Generate campaign insights and recommendations
 */
router.get('/campaigns/:campaignId/insights',
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const { campaignId } = req.params;

      // Get campaign with all related data
      const campaign = await prisma.marketingCampaign.findFirst({
        where: {
          id: campaignId,
          companyId: req.user!.companyId
        },
        include: {
          performance: true,
          sessions: {
            include: {
              agent: true
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

      // Generate AI-powered insights
      const insights = await generateCampaignInsights(campaign);

      res.json({
        success: true,
        data: insights
      });

    } catch (error) {
      console.error('Generate campaign insights error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate campaign insights'
      });
    }
  }
);

/**
 * Clone campaign
 */
router.post('/campaigns/:campaignId/clone',
  authMiddleware,
  [
    body('name').notEmpty().withMessage('New campaign name required'),
  ],
  async (req: AuthenticatedRequest, res) => {
    try {
      const { campaignId } = req.params;
      const { name, modifications } = req.body;

      // Get original campaign
      const originalCampaign = await prisma.marketingCampaign.findFirst({
        where: {
          id: campaignId,
          companyId: req.user!.companyId
        }
      });

      if (!originalCampaign) {
        return res.status(404).json({
          success: false,
          error: 'Original campaign not found'
        });
      }

      // Create cloned campaign
      const clonedCampaign = await prisma.marketingCampaign.create({
        data: {
          companyId: req.user!.companyId,
          name,
          description: `Cloned from: ${originalCampaign.name}`,
          type: originalCampaign.type,
          status: 'DRAFT',
          startDate: modifications?.startDate ? new Date(modifications.startDate) : originalCampaign.startDate,
          endDate: modifications?.endDate ? new Date(modifications.endDate) : originalCampaign.endDate,
          budget: modifications?.budget || originalCampaign.budget,
          targetMetrics: originalCampaign.targetMetrics,
          territories: originalCampaign.territories,
          assignedAgents: modifications?.assignedAgents ? JSON.stringify(modifications.assignedAgents) : originalCampaign.assignedAgents,
          materials: originalCampaign.materials,
          script: originalCampaign.script,
          questionnaire: originalCampaign.questionnaire,
          incentives: originalCampaign.incentives,
          complianceRules: originalCampaign.complianceRules,
          createdBy: req.user!.id,
          clonedFrom: originalCampaign.id
        }
      });

      res.json({
        success: true,
        data: {
          campaignId: clonedCampaign.id,
          name: clonedCampaign.name,
          status: clonedCampaign.status,
          clonedFrom: originalCampaign.id
        }
      });

    } catch (error) {
      console.error('Clone campaign error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clone campaign'
      });
    }
  }
);

// Helper functions

async function validateCampaignReadiness(campaign: any): Promise<{ ready: boolean; issues: string[] }> {
  const issues: string[] = [];

  // Check if campaign has materials
  const materials = JSON.parse(campaign.materials as string || '[]');
  if (materials.length === 0) {
    issues.push('Campaign must have at least one material');
  }

  // Check if campaign has assigned agents
  const assignedAgents = JSON.parse(campaign.assignedAgents as string || '[]');
  if (assignedAgents.length === 0) {
    issues.push('Campaign must have at least one assigned agent');
  }

  // Check if campaign has valid dates
  const now = new Date();
  if (new Date(campaign.startDate) < now) {
    issues.push('Campaign start date must be in the future');
  }

  if (new Date(campaign.endDate) <= new Date(campaign.startDate)) {
    issues.push('Campaign end date must be after start date');
  }

  // Check if campaign has script
  const script = JSON.parse(campaign.script as string || '{}');
  if (!script.sections || script.sections.length === 0) {
    issues.push('Campaign must have a script with at least one section');
  }

  return {
    ready: issues.length === 0,
    issues
  };
}

async function initializeCampaignTracking(campaignId: string): Promise<void> {
  // Initialize tracking records for campaign
  await prisma.campaignTracking.create({
    data: {
      campaignId,
      trackingData: JSON.stringify({
        dailyMetrics: {},
        agentMetrics: {},
        territoryMetrics: {},
        materialUsage: {},
        complianceIssues: []
      })
    }
  });
}

async function calculateCampaignAnalytics(campaign: any, timeframe: string, breakdown: string): Promise<any> {
  const sessions = campaign.sessions || [];
  const performance = campaign.performance || {};

  // Calculate basic metrics
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s: any) => s.status === 'COMPLETED').length;
  
  let totalInteractions = 0;
  let totalRegistrations = 0;
  let totalCommission = 0;

  sessions.forEach((session: any) => {
    const sessionData = JSON.parse(session.sessionData || '{}');
    totalInteractions += sessionData.performance?.totalInteractions || 0;
    totalRegistrations += sessionData.performance?.successfulRegistrations || 0;
    totalCommission += sessionData.performance?.commissionEarned || 0;
  });

  const conversionRate = totalInteractions > 0 ? (totalRegistrations / totalInteractions) * 100 : 0;

  // Calculate time-based breakdown
  const timeBreakdown = calculateTimeBreakdown(sessions, breakdown);

  // Calculate agent performance
  const agentPerformance = calculateAgentPerformance(sessions);

  // Calculate territory performance
  const territoryPerformance = calculateTerritoryPerformance(sessions, JSON.parse(campaign.territories as string || '[]'));

  // Calculate ROI
  const roi = campaign.budget > 0 ? ((totalCommission - campaign.budget) / campaign.budget) * 100 : 0;

  return {
    overview: {
      totalSessions,
      completedSessions,
      totalInteractions,
      totalRegistrations,
      conversionRate,
      totalCommission,
      roi,
      budget: campaign.budget,
      budgetUtilization: (totalCommission / campaign.budget) * 100
    },
    timeBreakdown,
    agentPerformance,
    territoryPerformance,
    trends: calculateTrends(sessions),
    recommendations: generatePerformanceRecommendations({
      conversionRate,
      roi,
      agentPerformance,
      territoryPerformance
    })
  };
}

function calculateTimeBreakdown(sessions: any[], breakdown: string): any[] {
  const timeData: { [key: string]: any } = {};

  sessions.forEach(session => {
    const sessionData = JSON.parse(session.sessionData || '{}');
    const date = new Date(session.startTime);
    
    let key: string;
    switch (breakdown) {
      case 'hourly':
        key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
        break;
      case 'daily':
        key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
        break;
      default:
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    }

    if (!timeData[key]) {
      timeData[key] = {
        period: key,
        sessions: 0,
        interactions: 0,
        registrations: 0,
        commission: 0
      };
    }

    timeData[key].sessions++;
    timeData[key].interactions += sessionData.performance?.totalInteractions || 0;
    timeData[key].registrations += sessionData.performance?.successfulRegistrations || 0;
    timeData[key].commission += sessionData.performance?.commissionEarned || 0;
  });

  return Object.values(timeData).sort((a: any, b: any) => a.period.localeCompare(b.period));
}

function calculateAgentPerformance(sessions: any[]): any[] {
  const agentData: { [agentId: string]: any } = {};

  sessions.forEach(session => {
    const sessionData = JSON.parse(session.sessionData || '{}');
    const agentId = session.agentId;

    if (!agentData[agentId]) {
      agentData[agentId] = {
        agentId,
        agentName: session.agent?.firstName + ' ' + session.agent?.lastName || 'Unknown',
        sessions: 0,
        interactions: 0,
        registrations: 0,
        commission: 0,
        averageSessionDuration: 0,
        conversionRate: 0
      };
    }

    agentData[agentId].sessions++;
    agentData[agentId].interactions += sessionData.performance?.totalInteractions || 0;
    agentData[agentId].registrations += sessionData.performance?.successfulRegistrations || 0;
    agentData[agentId].commission += sessionData.performance?.commissionEarned || 0;
    
    if (session.duration) {
      agentData[agentId].averageSessionDuration = 
        (agentData[agentId].averageSessionDuration * (agentData[agentId].sessions - 1) + session.duration) / agentData[agentId].sessions;
    }
  });

  // Calculate conversion rates
  Object.values(agentData).forEach((agent: any) => {
    agent.conversionRate = agent.interactions > 0 ? (agent.registrations / agent.interactions) * 100 : 0;
  });

  return Object.values(agentData).sort((a: any, b: any) => b.commission - a.commission);
}

function calculateTerritoryPerformance(sessions: any[], territories: any[]): any[] {
  const territoryData: { [territoryId: string]: any } = {};

  // Initialize territory data
  territories.forEach(territory => {
    territoryData[territory.id] = {
      territoryId: territory.id,
      territoryName: territory.name,
      priority: territory.priority,
      sessions: 0,
      interactions: 0,
      registrations: 0,
      commission: 0,
      coverage: 0
    };
  });

  sessions.forEach(session => {
    const sessionData = JSON.parse(session.sessionData || '{}');
    const sessionLocation = JSON.parse(session.location || '{}');
    
    // Determine which territory this session belongs to
    const territory = findTerritoryForLocation(sessionLocation, territories);
    if (territory && territoryData[territory.id]) {
      territoryData[territory.id].sessions++;
      territoryData[territory.id].interactions += sessionData.performance?.totalInteractions || 0;
      territoryData[territory.id].registrations += sessionData.performance?.successfulRegistrations || 0;
      territoryData[territory.id].commission += sessionData.performance?.commissionEarned || 0;
    }
  });

  return Object.values(territoryData);
}

function findTerritoryForLocation(location: any, territories: any[]): any {
  // Simplified territory matching - in production would use proper geospatial queries
  return territories[0] || null;
}

function calculateTrends(sessions: any[]): any {
  // Calculate various trends over time
  const last7Days = sessions.filter(s => {
    const sessionDate = new Date(s.startTime);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessionDate >= weekAgo;
  });

  const previous7Days = sessions.filter(s => {
    const sessionDate = new Date(s.startTime);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessionDate >= twoWeeksAgo && sessionDate < weekAgo;
  });

  const currentPeriodMetrics = calculatePeriodMetrics(last7Days);
  const previousPeriodMetrics = calculatePeriodMetrics(previous7Days);

  return {
    sessionsGrowth: calculateGrowthRate(currentPeriodMetrics.sessions, previousPeriodMetrics.sessions),
    interactionsGrowth: calculateGrowthRate(currentPeriodMetrics.interactions, previousPeriodMetrics.interactions),
    registrationsGrowth: calculateGrowthRate(currentPeriodMetrics.registrations, previousPeriodMetrics.registrations),
    conversionRateChange: currentPeriodMetrics.conversionRate - previousPeriodMetrics.conversionRate
  };
}

function calculatePeriodMetrics(sessions: any[]): any {
  let interactions = 0;
  let registrations = 0;

  sessions.forEach(session => {
    const sessionData = JSON.parse(session.sessionData || '{}');
    interactions += sessionData.performance?.totalInteractions || 0;
    registrations += sessionData.performance?.successfulRegistrations || 0;
  });

  return {
    sessions: sessions.length,
    interactions,
    registrations,
    conversionRate: interactions > 0 ? (registrations / interactions) * 100 : 0
  };
}

function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function generateCampaignInsights(campaign: any): Promise<any> {
  const sessions = campaign.sessions || [];
  const performance = campaign.performance || {};

  // Analyze performance patterns
  const insights = {
    performanceInsights: [],
    optimizationRecommendations: [],
    riskAlerts: [],
    successFactors: [],
    benchmarkComparison: {}
  };

  // Performance insights
  const totalSessions = sessions.length;
  if (totalSessions > 0) {
    const avgSessionDuration = sessions.reduce((sum: number, s: any) => sum + (s.duration || 0), 0) / totalSessions;
    
    if (avgSessionDuration < 1800) { // 30 minutes
      insights.performanceInsights.push({
        type: 'duration',
        message: 'Sessions are shorter than average, consider extending engagement time',
        impact: 'medium'
      });
    }

    // Analyze conversion patterns
    let totalInteractions = 0;
    let totalRegistrations = 0;
    
    sessions.forEach((session: any) => {
      const sessionData = JSON.parse(session.sessionData || '{}');
      totalInteractions += sessionData.performance?.totalInteractions || 0;
      totalRegistrations += sessionData.performance?.successfulRegistrations || 0;
    });

    const conversionRate = totalInteractions > 0 ? (totalRegistrations / totalInteractions) * 100 : 0;
    
    if (conversionRate < 15) {
      insights.optimizationRecommendations.push({
        type: 'conversion',
        message: 'Low conversion rate detected, review script and approach techniques',
        priority: 'high'
      });
    }
  }

  // Risk alerts
  const recentSessions = sessions.filter((s: any) => {
    const sessionDate = new Date(s.startTime);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    return sessionDate >= threeDaysAgo;
  });

  if (recentSessions.length === 0 && campaign.status === 'ACTIVE') {
    insights.riskAlerts.push({
      type: 'activity',
      message: 'No recent activity detected, agents may need support',
      severity: 'high'
    });
  }

  return insights;
}

function generatePerformanceRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];

  if (metrics.conversionRate < 20) {
    recommendations.push('Consider improving agent training on customer engagement techniques');
    recommendations.push('Review and optimize campaign script for better conversion');
  }

  if (metrics.roi < 0) {
    recommendations.push('Campaign is not profitable - review budget allocation and commission structure');
    recommendations.push('Focus on high-performing territories and agents');
  }

  if (metrics.agentPerformance.length > 0) {
    const topPerformer = metrics.agentPerformance[0];
    const bottomPerformer = metrics.agentPerformance[metrics.agentPerformance.length - 1];
    
    if (topPerformer.conversionRate > bottomPerformer.conversionRate * 2) {
      recommendations.push('Large performance gap between agents - implement peer mentoring program');
    }
  }

  return recommendations;
}

export default router;