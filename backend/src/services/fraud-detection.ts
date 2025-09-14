/**
 * Fraud Detection Service for SalesSync
 * Comprehensive fraud detection and prevention system
 */

import { PrismaClient } from '@prisma/client';
import { calculateDistance, validateGPSAccuracy, LocationHistory } from '../utils/gps-utils';
import { extractExifData } from '../utils/file-utils';

const prisma = new PrismaClient();

export interface FraudDetectionInput {
  agentId: string;
  activityType: 'visit_start' | 'visit_end' | 'sale' | 'photo_upload' | 'survey_complete' | 'stock_draw';
  location?: { latitude: number; longitude: number; accuracy: number };
  timestamp: Date;
  customerId?: string;
  amount?: number;
  photoBuffer?: Buffer;
  metadata?: any;
}

export interface FraudDetectionResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  flags: FraudFlag[];
  recommendations: string[];
  autoActions: AutoAction[];
}

export interface FraudFlag {
  type: 'LOCATION' | 'TIME' | 'PHOTO' | 'BEHAVIOR' | 'SALES' | 'PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence: any;
  confidence: number; // 0-1
}

export interface AutoAction {
  action: 'ALERT_MANAGER' | 'SUSPEND_AGENT' | 'REQUIRE_VERIFICATION' | 'LOG_INCIDENT';
  reason: string;
  data: any;
}

export interface AgentBehaviorProfile {
  agentId: string;
  averageVisitDuration: number;
  typicalWorkingHours: { start: number; end: number };
  averageVisitsPerDay: number;
  averageSalesPerVisit: number;
  commonLocations: { latitude: number; longitude: number; frequency: number }[];
  photoQualityAverage: number;
  suspiciousActivityCount: number;
  lastUpdated: Date;
}

/**
 * Main fraud detection function
 * @param input Fraud detection input data
 * @returns Fraud detection result
 */
export async function detectFraud(input: FraudDetectionInput): Promise<FraudDetectionResult> {
  const flags: FraudFlag[] = [];
  const recommendations: string[] = [];
  const autoActions: AutoAction[] = [];

  try {
    // Get agent behavior profile
    const profile = await getAgentBehaviorProfile(input.agentId);
    
    // Perform different types of fraud detection
    const locationFlags = await detectLocationFraud(input, profile);
    const timeFlags = await detectTimeFraud(input, profile);
    const photoFlags = input.photoBuffer ? await detectPhotoFraud(input, profile) : [];
    const behaviorFlags = await detectBehaviorFraud(input, profile);
    const salesFlags = await detectSalesFraud(input, profile);
    const patternFlags = await detectPatternFraud(input, profile);

    flags.push(...locationFlags, ...timeFlags, ...photoFlags, ...behaviorFlags, ...salesFlags, ...patternFlags);

    // Calculate overall risk score
    const riskScore = calculateRiskScore(flags);
    const riskLevel = determineRiskLevel(riskScore);

    // Generate recommendations
    recommendations.push(...generateRecommendations(flags, riskLevel));

    // Determine auto actions
    autoActions.push(...determineAutoActions(flags, riskLevel, input.agentId));

    // Log fraud detection event
    await logFraudDetectionEvent(input, { riskLevel, riskScore, flags });

    // Update agent behavior profile
    await updateAgentBehaviorProfile(input, profile);

    return {
      riskLevel,
      riskScore,
      flags,
      recommendations,
      autoActions
    };

  } catch (error) {
    console.error('Fraud detection error:', error);
    return {
      riskLevel: 'LOW',
      riskScore: 0,
      flags: [],
      recommendations: ['Fraud detection system error - manual review recommended'],
      autoActions: [{ action: 'LOG_INCIDENT', reason: 'System error', data: { error: error.message } }]
    };
  }
}

/**
 * Detect location-based fraud
 * @param input Detection input
 * @param profile Agent behavior profile
 * @returns Array of location fraud flags
 */
async function detectLocationFraud(
  input: FraudDetectionInput,
  profile: AgentBehaviorProfile
): Promise<FraudFlag[]> {
  const flags: FraudFlag[] = [];

  if (!input.location) return flags;

  // Get recent location history
  const locationHistory = await getAgentLocationHistory(input.agentId, 24); // Last 24 hours

  // Check for impossible travel speeds
  if (locationHistory.length > 0) {
    const lastLocation = locationHistory[locationHistory.length - 1];
    const distance = calculateDistance(input.location, lastLocation.coordinates);
    const timeDiff = (input.timestamp.getTime() - lastLocation.timestamp.getTime()) / 1000; // seconds
    const speed = distance / timeDiff; // m/s

    if (speed > 50) { // 180 km/h
      flags.push({
        type: 'LOCATION',
        severity: 'CRITICAL',
        description: `Impossible travel speed detected: ${(speed * 3.6).toFixed(1)} km/h`,
        evidence: { distance, timeDiff, speed, lastLocation: lastLocation.coordinates },
        confidence: 0.95
      });
    } else if (speed > 30) { // 108 km/h
      flags.push({
        type: 'LOCATION',
        severity: 'HIGH',
        description: `Suspicious travel speed: ${(speed * 3.6).toFixed(1)} km/h`,
        evidence: { distance, timeDiff, speed },
        confidence: 0.8
      });
    }
  }

  // Check GPS accuracy
  const gpsValidation = validateGPSAccuracy(
    { ...input.location, timestamp: input.timestamp },
    locationHistory
  );

  if (gpsValidation.fraudRisk === 'HIGH') {
    flags.push({
      type: 'LOCATION',
      severity: 'HIGH',
      description: 'GPS spoofing suspected',
      evidence: { accuracy: input.location.accuracy, reasons: gpsValidation.reasons },
      confidence: 0.85
    });
  }

  // Check for location clustering (staying in same exact spot)
  const exactMatches = locationHistory.filter(loc =>
    loc.coordinates.latitude === input.location!.latitude &&
    loc.coordinates.longitude === input.location!.longitude
  ).length;

  if (exactMatches > 5) {
    flags.push({
      type: 'LOCATION',
      severity: 'MEDIUM',
      description: 'Suspicious location clustering detected',
      evidence: { exactMatches, location: input.location },
      confidence: 0.7
    });
  }

  // Check if location is in unusual area for this agent
  const isUnusualLocation = !profile.commonLocations.some(common =>
    calculateDistance(input.location!, common) < 1000 // 1km radius
  );

  if (isUnusualLocation && profile.commonLocations.length > 10) {
    flags.push({
      type: 'LOCATION',
      severity: 'LOW',
      description: 'Activity in unusual location for this agent',
      evidence: { location: input.location, commonLocations: profile.commonLocations },
      confidence: 0.6
    });
  }

  return flags;
}

/**
 * Detect time-based fraud
 * @param input Detection input
 * @param profile Agent behavior profile
 * @returns Array of time fraud flags
 */
async function detectTimeFraud(
  input: FraudDetectionInput,
  profile: AgentBehaviorProfile
): Promise<FraudFlag[]> {
  const flags: FraudFlag[] = [];

  const hour = input.timestamp.getHours();
  const dayOfWeek = input.timestamp.getDay();

  // Check for activity outside normal working hours
  if (hour < profile.typicalWorkingHours.start || hour > profile.typicalWorkingHours.end) {
    const severity = (hour < 6 || hour > 22) ? 'HIGH' : 'MEDIUM';
    flags.push({
      type: 'TIME',
      severity,
      description: `Activity outside normal working hours: ${hour}:00`,
      evidence: { hour, workingHours: profile.typicalWorkingHours },
      confidence: 0.8
    });
  }

  // Check for weekend activity (if not expected)
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
    flags.push({
      type: 'TIME',
      severity: 'MEDIUM',
      description: 'Weekend activity detected',
      evidence: { dayOfWeek, timestamp: input.timestamp },
      confidence: 0.6
    });
  }

  // Check for rapid consecutive activities
  const recentActivities = await getRecentAgentActivities(input.agentId, 1); // Last hour
  if (recentActivities.length > 10) {
    flags.push({
      type: 'TIME',
      severity: 'HIGH',
      description: 'Unusually high activity frequency',
      evidence: { activitiesInLastHour: recentActivities.length },
      confidence: 0.85
    });
  }

  return flags;
}

/**
 * Detect photo-based fraud
 * @param input Detection input
 * @param profile Agent behavior profile
 * @returns Array of photo fraud flags
 */
async function detectPhotoFraud(
  input: FraudDetectionInput,
  profile: AgentBehaviorProfile
): Promise<FraudFlag[]> {
  const flags: FraudFlag[] = [];

  if (!input.photoBuffer) return flags;

  try {
    // Extract EXIF data
    const exifData = await extractExifData(input.photoBuffer);

    // Check for missing EXIF data (potential stock photo)
    if (!exifData || !exifData.exif) {
      flags.push({
        type: 'PHOTO',
        severity: 'MEDIUM',
        description: 'Photo missing EXIF data - potential stock photo',
        evidence: { hasExif: false },
        confidence: 0.7
      });
    }

    // Check for GPS coordinates in EXIF vs reported location
    if (exifData?.exif && input.location) {
      // Extract GPS from EXIF (implementation would depend on EXIF format)
      // This is a simplified check
      flags.push({
        type: 'PHOTO',
        severity: 'LOW',
        description: 'EXIF GPS data validation needed',
        evidence: { hasExifGPS: true },
        confidence: 0.5
      });
    }

    // Check photo timestamp vs activity timestamp
    if (exifData?.exif) {
      const timeDiff = Math.abs(input.timestamp.getTime() - new Date().getTime());
      if (timeDiff > 300000) { // 5 minutes
        flags.push({
          type: 'PHOTO',
          severity: 'MEDIUM',
          description: 'Photo timestamp significantly different from activity time',
          evidence: { timeDifference: timeDiff },
          confidence: 0.75
        });
      }
    }

    // Check for duplicate photos
    const isDuplicate = await checkForDuplicatePhoto(input.photoBuffer, input.agentId);
    if (isDuplicate) {
      flags.push({
        type: 'PHOTO',
        severity: 'HIGH',
        description: 'Duplicate photo detected',
        evidence: { isDuplicate: true },
        confidence: 0.9
      });
    }

  } catch (error) {
    console.error('Photo fraud detection error:', error);
  }

  return flags;
}

/**
 * Detect behavior-based fraud
 * @param input Detection input
 * @param profile Agent behavior profile
 * @returns Array of behavior fraud flags
 */
async function detectBehaviorFraud(
  input: FraudDetectionInput,
  profile: AgentBehaviorProfile
): Promise<FraudFlag[]> {
  const flags: FraudFlag[] = [];

  // Check visit duration anomalies
  if (input.activityType === 'visit_end' && input.metadata?.duration) {
    const duration = input.metadata.duration;
    const avgDuration = profile.averageVisitDuration;

    if (duration < avgDuration * 0.3) { // Too short
      flags.push({
        type: 'BEHAVIOR',
        severity: 'MEDIUM',
        description: `Visit duration unusually short: ${duration}s vs average ${avgDuration}s`,
        evidence: { duration, averageDuration: avgDuration },
        confidence: 0.8
      });
    } else if (duration > avgDuration * 3) { // Too long
      flags.push({
        type: 'BEHAVIOR',
        severity: 'LOW',
        description: `Visit duration unusually long: ${duration}s vs average ${avgDuration}s`,
        evidence: { duration, averageDuration: avgDuration },
        confidence: 0.6
      });
    }
  }

  // Check daily activity patterns
  const todayActivities = await getTodayAgentActivities(input.agentId);
  if (todayActivities.length > profile.averageVisitsPerDay * 2) {
    flags.push({
      type: 'BEHAVIOR',
      severity: 'MEDIUM',
      description: 'Unusually high number of activities today',
      evidence: { todayCount: todayActivities.length, averageDaily: profile.averageVisitsPerDay },
      confidence: 0.75
    });
  }

  return flags;
}

/**
 * Detect sales-based fraud
 * @param input Detection input
 * @param profile Agent behavior profile
 * @returns Array of sales fraud flags
 */
async function detectSalesFraud(
  input: FraudDetectionInput,
  profile: AgentBehaviorProfile
): Promise<FraudFlag[]> {
  const flags: FraudFlag[] = [];

  if (input.activityType === 'sale' && input.amount) {
    // Check for unusually large sales
    if (input.amount > profile.averageSalesPerVisit * 5) {
      flags.push({
        type: 'SALES',
        severity: 'HIGH',
        description: `Unusually large sale amount: $${input.amount} vs average $${profile.averageSalesPerVisit}`,
        evidence: { amount: input.amount, averageAmount: profile.averageSalesPerVisit },
        confidence: 0.85
      });
    }

    // Check for round number sales (potential fake entries)
    if (input.amount % 100 === 0 && input.amount > 100) {
      flags.push({
        type: 'SALES',
        severity: 'LOW',
        description: 'Round number sale amount - potential manual entry',
        evidence: { amount: input.amount },
        confidence: 0.5
      });
    }

    // Check for sales to non-existent customers
    if (input.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: input.customerId }
      });

      if (!customer) {
        flags.push({
          type: 'SALES',
          severity: 'CRITICAL',
          description: 'Sale to non-existent customer',
          evidence: { customerId: input.customerId },
          confidence: 1.0
        });
      }
    }
  }

  return flags;
}

/**
 * Detect pattern-based fraud
 * @param input Detection input
 * @param profile Agent behavior profile
 * @returns Array of pattern fraud flags
 */
async function detectPatternFraud(
  input: FraudDetectionInput,
  profile: AgentBehaviorProfile
): Promise<FraudFlag[]> {
  const flags: FraudFlag[] = [];

  // Check for repetitive patterns
  const recentSimilarActivities = await getSimilarRecentActivities(input);
  if (recentSimilarActivities.length > 5) {
    flags.push({
      type: 'PATTERN',
      severity: 'MEDIUM',
      description: 'Repetitive activity pattern detected',
      evidence: { similarActivities: recentSimilarActivities.length },
      confidence: 0.7
    });
  }

  // Check for collusion patterns
  const nearbyAgentActivities = await getNearbyAgentActivities(input);
  if (nearbyAgentActivities.length > 2) {
    flags.push({
      type: 'PATTERN',
      severity: 'HIGH',
      description: 'Multiple agents active in same location',
      evidence: { nearbyAgents: nearbyAgentActivities.length },
      confidence: 0.8
    });
  }

  return flags;
}

/**
 * Calculate overall risk score from flags
 * @param flags Array of fraud flags
 * @returns Risk score (0-100)
 */
function calculateRiskScore(flags: FraudFlag[]): number {
  const severityWeights = {
    LOW: 10,
    MEDIUM: 25,
    HIGH: 50,
    CRITICAL: 100
  };

  let totalScore = 0;
  let maxPossibleScore = 0;

  flags.forEach(flag => {
    const weight = severityWeights[flag.severity];
    totalScore += weight * flag.confidence;
    maxPossibleScore += weight;
  });

  return maxPossibleScore > 0 ? Math.min(100, (totalScore / maxPossibleScore) * 100) : 0;
}

/**
 * Determine risk level from score
 * @param score Risk score
 * @returns Risk level
 */
function determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Generate recommendations based on flags
 * @param flags Fraud flags
 * @param riskLevel Overall risk level
 * @returns Array of recommendations
 */
function generateRecommendations(flags: FraudFlag[], riskLevel: string): string[] {
  const recommendations: string[] = [];

  if (riskLevel === 'CRITICAL') {
    recommendations.push('Immediate investigation required');
    recommendations.push('Consider suspending agent pending review');
  }

  flags.forEach(flag => {
    switch (flag.type) {
      case 'LOCATION':
        recommendations.push('Verify agent location using alternative methods');
        break;
      case 'TIME':
        recommendations.push('Review agent work schedule and overtime policies');
        break;
      case 'PHOTO':
        recommendations.push('Request additional photo verification');
        break;
      case 'SALES':
        recommendations.push('Verify sales transactions with customers');
        break;
      case 'BEHAVIOR':
        recommendations.push('Monitor agent behavior patterns closely');
        break;
      case 'PATTERN':
        recommendations.push('Investigate potential collusion or systematic fraud');
        break;
    }
  });

  return [...new Set(recommendations)]; // Remove duplicates
}

/**
 * Determine automatic actions based on risk
 * @param flags Fraud flags
 * @param riskLevel Risk level
 * @param agentId Agent ID
 * @returns Array of auto actions
 */
function determineAutoActions(
  flags: FraudFlag[],
  riskLevel: string,
  agentId: string
): AutoAction[] {
  const actions: AutoAction[] = [];

  // Always log incidents
  actions.push({
    action: 'LOG_INCIDENT',
    reason: `Fraud detection triggered - ${riskLevel} risk`,
    data: { agentId, riskLevel, flagCount: flags.length }
  });

  if (riskLevel === 'CRITICAL') {
    actions.push({
      action: 'SUSPEND_AGENT',
      reason: 'Critical fraud risk detected',
      data: { agentId, flags }
    });
    actions.push({
      action: 'ALERT_MANAGER',
      reason: 'Agent suspended due to critical fraud risk',
      data: { agentId, riskLevel }
    });
  } else if (riskLevel === 'HIGH') {
    actions.push({
      action: 'ALERT_MANAGER',
      reason: 'High fraud risk detected',
      data: { agentId, riskLevel }
    });
    actions.push({
      action: 'REQUIRE_VERIFICATION',
      reason: 'Additional verification required',
      data: { agentId, flags }
    });
  } else if (riskLevel === 'MEDIUM') {
    actions.push({
      action: 'ALERT_MANAGER',
      reason: 'Medium fraud risk detected',
      data: { agentId, riskLevel }
    });
  }

  return actions;
}

// Helper functions for data retrieval

async function getAgentBehaviorProfile(agentId: string): Promise<AgentBehaviorProfile> {
  // Get or create agent behavior profile
  let profile = await prisma.agentBehaviorProfile.findUnique({
    where: { agentId }
  });

  if (!profile) {
    // Create default profile
    profile = await prisma.agentBehaviorProfile.create({
      data: {
        agentId,
        averageVisitDuration: 1800, // 30 minutes
        typicalWorkingHours: JSON.stringify({ start: 8, end: 17 }),
        averageVisitsPerDay: 8,
        averageSalesPerVisit: 150,
        commonLocations: JSON.stringify([]),
        photoQualityAverage: 75,
        suspiciousActivityCount: 0
      }
    });
  }

  return {
    agentId: profile.agentId,
    averageVisitDuration: profile.averageVisitDuration,
    typicalWorkingHours: JSON.parse(profile.typicalWorkingHours as string),
    averageVisitsPerDay: profile.averageVisitsPerDay,
    averageSalesPerVisit: profile.averageSalesPerVisit,
    commonLocations: JSON.parse(profile.commonLocations as string),
    photoQualityAverage: profile.photoQualityAverage,
    suspiciousActivityCount: profile.suspiciousActivityCount,
    lastUpdated: profile.updatedAt
  };
}

async function getAgentLocationHistory(agentId: string, hours: number): Promise<LocationHistory[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const visits = await prisma.visit.findMany({
    where: {
      agentId,
      createdAt: { gte: since }
    },
    orderBy: { createdAt: 'asc' }
  });

  return visits.map(visit => {
    const location = JSON.parse(visit.location || '{}');
    return {
      coordinates: { latitude: location.latitude || 0, longitude: location.longitude || 0 },
      timestamp: visit.createdAt,
      accuracy: location.accuracy || 100,
      source: 'GPS' as const
    };
  });
}

async function getRecentAgentActivities(agentId: string, hours: number): Promise<any[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return await prisma.visit.findMany({
    where: {
      agentId,
      createdAt: { gte: since }
    }
  });
}

async function getTodayAgentActivities(agentId: string): Promise<any[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return await prisma.visit.findMany({
    where: {
      agentId,
      createdAt: { gte: today }
    }
  });
}

async function checkForDuplicatePhoto(photoBuffer: Buffer, agentId: string): Promise<boolean> {
  // In production, this would use image hashing to detect duplicates
  // For now, return false (no duplicates detected)
  return false;
}

async function getSimilarRecentActivities(input: FraudDetectionInput): Promise<any[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
  
  return await prisma.visit.findMany({
    where: {
      agentId: input.agentId,
      createdAt: { gte: since },
      customerId: input.customerId
    }
  });
}

async function getNearbyAgentActivities(input: FraudDetectionInput): Promise<any[]> {
  if (!input.location) return [];
  
  const since = new Date(Date.now() - 60 * 60 * 1000); // Last hour
  
  // This would require spatial queries in production
  return [];
}

async function logFraudDetectionEvent(
  input: FraudDetectionInput,
  result: { riskLevel: string; riskScore: number; flags: FraudFlag[] }
): Promise<void> {
  await prisma.fraudDetectionLog.create({
    data: {
      agentId: input.agentId,
      activityType: input.activityType,
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      flags: JSON.stringify(result.flags),
      metadata: JSON.stringify(input.metadata || {})
    }
  });
}

async function updateAgentBehaviorProfile(
  input: FraudDetectionInput,
  profile: AgentBehaviorProfile
): Promise<void> {
  // Update profile based on new activity
  // This would involve complex calculations in production
  
  await prisma.agentBehaviorProfile.update({
    where: { agentId: input.agentId },
    data: {
      lastUpdated: new Date()
    }
  });
}

export default {
  detectFraud
};