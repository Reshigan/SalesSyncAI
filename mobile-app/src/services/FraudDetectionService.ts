/**
 * Mobile Fraud Detection Service for SalesSync
 * Client-side fraud detection and prevention
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

export interface FraudCheckInput {
  agentId: string;
  activityType: 'visit_start' | 'visit_end' | 'photo_capture' | 'sale' | 'survey';
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: Date;
  previousLocations?: LocationHistory[];
  metadata?: any;
}

export interface FraudCheckResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100
  flags: FraudFlag[];
  reason: string;
  recommendations: string[];
  autoActions: string[];
}

export interface FraudFlag {
  type: 'LOCATION' | 'TIME' | 'DEVICE' | 'BEHAVIOR' | 'PATTERN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence: any;
  confidence: number; // 0-1
}

export interface LocationHistory {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  speed?: number;
}

export interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  osName: string;
  osVersion: string;
  brand: string;
  modelName: string;
  totalMemory?: number;
  isDevice: boolean;
  isRooted?: boolean;
  hasGooglePlayServices?: boolean;
  sensors: string[];
  screenDimensions: { width: number; height: number };
  timezone: string;
  locale: string;
}

export interface BehaviorPattern {
  agentId: string;
  averageVisitDuration: number;
  typicalWorkingHours: { start: number; end: number };
  commonLocations: { latitude: number; longitude: number; frequency: number }[];
  averageMovementSpeed: number;
  photoTakingPatterns: any;
  salesPatterns: any;
  lastUpdated: Date;
}

export class FraudDetectionService {
  private static instance: FraudDetectionService;
  private deviceFingerprint: DeviceFingerprint | null = null;
  private behaviorPattern: BehaviorPattern | null = null;
  private sensorData: {
    accelerometer: any[];
    gyroscope: any[];
    magnetometer: any[];
  } = {
    accelerometer: [],
    gyroscope: [],
    magnetometer: []
  };

  constructor() {
    this.initializeDeviceFingerprint();
    this.startSensorMonitoring();
  }

  static getInstance(): FraudDetectionService {
    if (!FraudDetectionService.instance) {
      FraudDetectionService.instance = new FraudDetectionService();
    }
    return FraudDetectionService.instance;
  }

  /**
   * Initialize device fingerprinting
   */
  private async initializeDeviceFingerprint(): Promise<void> {
    try {
      const deviceInfo = await this.collectDeviceInfo();
      this.deviceFingerprint = deviceInfo;
      
      // Store device fingerprint
      await AsyncStorage.setItem('deviceFingerprint', JSON.stringify(deviceInfo));
      
      // Check for device tampering
      await this.checkDeviceTampering();
    } catch (error) {
      console.error('Device fingerprinting error:', error);
    }
  }

  /**
   * Collect comprehensive device information
   */
  private async collectDeviceInfo(): Promise<DeviceFingerprint> {
    const screenDimensions = {
      width: 0,
      height: 0
    };

    // Get screen dimensions (would need react-native-device-info in production)
    try {
      const { Dimensions } = require('react-native');
      const { width, height } = Dimensions.get('window');
      screenDimensions.width = width;
      screenDimensions.height = height;
    } catch (error) {
      console.error('Screen dimensions error:', error);
    }

    // Check available sensors
    const sensors: string[] = [];
    try {
      const accelerometerAvailable = await Accelerometer.isAvailableAsync();
      if (accelerometerAvailable) sensors.push('accelerometer');
      
      const gyroscopeAvailable = await Gyroscope.isAvailableAsync();
      if (gyroscopeAvailable) sensors.push('gyroscope');
      
      const magnetometerAvailable = await Magnetometer.isAvailableAsync();
      if (magnetometerAvailable) sensors.push('magnetometer');
    } catch (error) {
      console.error('Sensor check error:', error);
    }

    return {
      deviceId: Device.osInternalBuildId || 'unknown',
      deviceName: Device.deviceName || 'unknown',
      osName: Device.osName || 'unknown',
      osVersion: Device.osVersion || 'unknown',
      brand: Device.brand || 'unknown',
      modelName: Device.modelName || 'unknown',
      totalMemory: Device.totalMemory,
      isDevice: Device.isDevice,
      sensors,
      screenDimensions,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale
    };
  }

  /**
   * Check for device tampering (rooting, jailbreaking)
   */
  private async checkDeviceTampering(): Promise<void> {
    try {
      // Check for common rooting/jailbreaking indicators
      const suspiciousApps = [
        'com.noshufou.android.su',
        'com.thirdparty.superuser',
        'eu.chainfire.supersu',
        'com.koushikdutta.superuser'
      ];

      // In production, would use react-native-device-info or similar
      // to check for these indicators
      
      const isRooted = false; // Placeholder
      
      if (isRooted) {
        await this.reportSecurityIssue('DEVICE_TAMPERING', 'Rooted/jailbroken device detected');
      }
    } catch (error) {
      console.error('Device tampering check error:', error);
    }
  }

  /**
   * Start monitoring device sensors for fraud detection
   */
  private startSensorMonitoring(): void {
    try {
      // Monitor accelerometer for movement patterns
      Accelerometer.addListener(accelerometerData => {
        this.sensorData.accelerometer.push({
          ...accelerometerData,
          timestamp: new Date()
        });
        
        // Keep only last 100 readings
        if (this.sensorData.accelerometer.length > 100) {
          this.sensorData.accelerometer = this.sensorData.accelerometer.slice(-100);
        }
      });

      // Monitor gyroscope for device orientation
      Gyroscope.addListener(gyroscopeData => {
        this.sensorData.gyroscope.push({
          ...gyroscopeData,
          timestamp: new Date()
        });
        
        if (this.sensorData.gyroscope.length > 100) {
          this.sensorData.gyroscope = this.sensorData.gyroscope.slice(-100);
        }
      });

      // Monitor magnetometer for environmental factors
      Magnetometer.addListener(magnetometerData => {
        this.sensorData.magnetometer.push({
          ...magnetometerData,
          timestamp: new Date()
        });
        
        if (this.sensorData.magnetometer.length > 100) {
          this.sensorData.magnetometer = this.sensorData.magnetometer.slice(-100);
        }
      });

      // Set update intervals
      Accelerometer.setUpdateInterval(1000); // 1 second
      Gyroscope.setUpdateInterval(1000);
      Magnetometer.setUpdateInterval(5000); // 5 seconds
    } catch (error) {
      console.error('Sensor monitoring error:', error);
    }
  }

  /**
   * Main fraud detection check
   */
  async checkLocationFraud(input: FraudCheckInput): Promise<FraudCheckResult> {
    const flags: FraudFlag[] = [];
    let riskScore = 0;

    try {
      // Load behavior pattern
      await this.loadBehaviorPattern(input.agentId);

      // Location-based checks
      if (input.location) {
        const locationFlags = await this.checkLocationAnomalies(input);
        flags.push(...locationFlags);
      }

      // Time-based checks
      const timeFlags = this.checkTimeAnomalies(input);
      flags.push(...timeFlags);

      // Device-based checks
      const deviceFlags = await this.checkDeviceAnomalies(input);
      flags.push(...deviceFlags);

      // Behavior-based checks
      const behaviorFlags = this.checkBehaviorAnomalies(input);
      flags.push(...behaviorFlags);

      // Pattern-based checks
      const patternFlags = await this.checkPatternAnomalies(input);
      flags.push(...patternFlags);

      // Calculate overall risk score
      riskScore = this.calculateRiskScore(flags);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(riskScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(flags, riskLevel);

      // Determine auto actions
      const autoActions = this.determineAutoActions(flags, riskLevel);

      // Log fraud check
      await this.logFraudCheck(input, { riskLevel, riskScore, flags });

      return {
        riskLevel,
        riskScore,
        flags,
        reason: this.generateReason(flags, riskLevel),
        recommendations,
        autoActions
      };

    } catch (error) {
      console.error('Fraud detection error:', error);
      return {
        riskLevel: 'LOW',
        riskScore: 0,
        flags: [],
        reason: 'Fraud detection system error',
        recommendations: ['Manual review recommended'],
        autoActions: []
      };
    }
  }

  /**
   * Check for location-based anomalies
   */
  private async checkLocationAnomalies(input: FraudCheckInput): Promise<FraudFlag[]> {
    const flags: FraudFlag[] = [];

    if (!input.location || !input.previousLocations) return flags;

    const { location, previousLocations } = input;

    // Check for impossible travel speeds
    if (previousLocations.length > 0) {
      const lastLocation = previousLocations[previousLocations.length - 1];
      const distance = this.calculateDistance(location, lastLocation);
      const timeDiff = (input.timestamp.getTime() - lastLocation.timestamp.getTime()) / 1000; // seconds
      const speed = distance / timeDiff; // m/s

      if (speed > 55.56) { // 200 km/h
        flags.push({
          type: 'LOCATION',
          severity: 'CRITICAL',
          description: `Impossible travel speed: ${(speed * 3.6).toFixed(1)} km/h`,
          evidence: { speed: speed * 3.6, distance, timeDiff },
          confidence: 0.95
        });
      } else if (speed > 33.33) { // 120 km/h
        flags.push({
          type: 'LOCATION',
          severity: 'HIGH',
          description: `High travel speed: ${(speed * 3.6).toFixed(1)} km/h`,
          evidence: { speed: speed * 3.6, distance, timeDiff },
          confidence: 0.8
        });
      }
    }

    // Check GPS accuracy
    if (location.accuracy > 100) {
      flags.push({
        type: 'LOCATION',
        severity: 'MEDIUM',
        description: `Poor GPS accuracy: ${location.accuracy}m`,
        evidence: { accuracy: location.accuracy },
        confidence: 0.7
      });
    } else if (location.accuracy < 1) {
      flags.push({
        type: 'LOCATION',
        severity: 'HIGH',
        description: 'Suspiciously high GPS accuracy - possible spoofing',
        evidence: { accuracy: location.accuracy },
        confidence: 0.85
      });
    }

    // Check for location clustering (staying in exact same spot)
    const exactMatches = previousLocations.filter(loc =>
      loc.latitude === location.latitude && loc.longitude === location.longitude
    ).length;

    if (exactMatches > 5) {
      flags.push({
        type: 'LOCATION',
        severity: 'MEDIUM',
        description: 'Suspicious location clustering detected',
        evidence: { exactMatches },
        confidence: 0.7
      });
    }

    return flags;
  }

  /**
   * Check for time-based anomalies
   */
  private checkTimeAnomalies(input: FraudCheckInput): FraudFlag[] {
    const flags: FraudFlag[] = [];

    const hour = input.timestamp.getHours();
    const dayOfWeek = input.timestamp.getDay();

    // Check for activity outside normal working hours
    if (this.behaviorPattern) {
      const { start, end } = this.behaviorPattern.typicalWorkingHours;
      if (hour < start || hour > end) {
        const severity = (hour < 6 || hour > 22) ? 'HIGH' : 'MEDIUM';
        flags.push({
          type: 'TIME',
          severity,
          description: `Activity outside normal working hours: ${hour}:00`,
          evidence: { hour, workingHours: { start, end } },
          confidence: 0.8
        });
      }
    }

    // Check for weekend activity
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      flags.push({
        type: 'TIME',
        severity: 'MEDIUM',
        description: 'Weekend activity detected',
        evidence: { dayOfWeek },
        confidence: 0.6
      });
    }

    return flags;
  }

  /**
   * Check for device-based anomalies
   */
  private async checkDeviceAnomalies(input: FraudCheckInput): Promise<FraudFlag[]> {
    const flags: FraudFlag[] = [];

    if (!this.deviceFingerprint) return flags;

    // Check for device changes
    const storedFingerprint = await AsyncStorage.getItem('lastDeviceFingerprint');
    if (storedFingerprint) {
      const lastFingerprint = JSON.parse(storedFingerprint);
      
      if (lastFingerprint.deviceId !== this.deviceFingerprint.deviceId) {
        flags.push({
          type: 'DEVICE',
          severity: 'CRITICAL',
          description: 'Device ID changed - possible device swap',
          evidence: { 
            oldDeviceId: lastFingerprint.deviceId,
            newDeviceId: this.deviceFingerprint.deviceId
          },
          confidence: 0.9
        });
      }
    }

    // Check for emulator/simulator
    if (!this.deviceFingerprint.isDevice) {
      flags.push({
        type: 'DEVICE',
        severity: 'HIGH',
        description: 'Running on emulator/simulator',
        evidence: { isDevice: this.deviceFingerprint.isDevice },
        confidence: 0.95
      });
    }

    // Check sensor availability (spoofing apps often disable sensors)
    if (this.deviceFingerprint.sensors.length < 2) {
      flags.push({
        type: 'DEVICE',
        severity: 'MEDIUM',
        description: 'Limited sensor availability - possible tampering',
        evidence: { availableSensors: this.deviceFingerprint.sensors },
        confidence: 0.6
      });
    }

    return flags;
  }

  /**
   * Check for behavior-based anomalies
   */
  private checkBehaviorAnomalies(input: FraudCheckInput): FraudFlag[] {
    const flags: FraudFlag[] = [];

    if (!this.behaviorPattern) return flags;

    // Check movement patterns using sensor data
    const recentMovement = this.analyzeRecentMovement();
    
    if (recentMovement.isStationary && input.activityType === 'visit_start') {
      flags.push({
        type: 'BEHAVIOR',
        severity: 'MEDIUM',
        description: 'No movement detected before visit start',
        evidence: { movementData: recentMovement },
        confidence: 0.7
      });
    }

    // Check for rapid consecutive activities
    const recentActivities = this.getRecentActivities(input.agentId);
    if (recentActivities.length > 10) { // More than 10 activities in last hour
      flags.push({
        type: 'BEHAVIOR',
        severity: 'HIGH',
        description: 'Unusually high activity frequency',
        evidence: { recentActivities: recentActivities.length },
        confidence: 0.8
      });
    }

    return flags;
  }

  /**
   * Check for pattern-based anomalies
   */
  private async checkPatternAnomalies(input: FraudCheckInput): Promise<FraudFlag[]> {
    const flags: FraudFlag[] = [];

    // Check for repetitive patterns
    const similarActivities = await this.getSimilarRecentActivities(input);
    if (similarActivities.length > 5) {
      flags.push({
        type: 'PATTERN',
        severity: 'MEDIUM',
        description: 'Repetitive activity pattern detected',
        evidence: { similarActivities: similarActivities.length },
        confidence: 0.7
      });
    }

    return flags;
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(coord1: { latitude: number; longitude: number }, coord2: { latitude: number; longitude: number }): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coord1.latitude * Math.PI / 180;
    const φ2 = coord2.latitude * Math.PI / 180;
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Analyze recent movement using sensor data
   */
  private analyzeRecentMovement(): { isStationary: boolean; averageMovement: number } {
    const recentAccelerometer = this.sensorData.accelerometer.slice(-10); // Last 10 readings
    
    if (recentAccelerometer.length === 0) {
      return { isStationary: true, averageMovement: 0 };
    }

    const movements = recentAccelerometer.map(data => 
      Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z)
    );

    const averageMovement = movements.reduce((sum, movement) => sum + movement, 0) / movements.length;
    const isStationary = averageMovement < 1.2; // Threshold for stationary detection

    return { isStationary, averageMovement };
  }

  /**
   * Get recent activities for pattern analysis
   */
  private getRecentActivities(agentId: string): any[] {
    // In production, would query local storage for recent activities
    return [];
  }

  /**
   * Get similar recent activities
   */
  private async getSimilarRecentActivities(input: FraudCheckInput): Promise<any[]> {
    // In production, would query for similar activities
    return [];
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(flags: FraudFlag[]): number {
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
   */
  private determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Generate reason for risk assessment
   */
  private generateReason(flags: FraudFlag[], riskLevel: string): string {
    if (flags.length === 0) {
      return 'No fraud indicators detected';
    }

    const criticalFlags = flags.filter(f => f.severity === 'CRITICAL');
    const highFlags = flags.filter(f => f.severity === 'HIGH');

    if (criticalFlags.length > 0) {
      return `Critical fraud indicators: ${criticalFlags.map(f => f.description).join(', ')}`;
    } else if (highFlags.length > 0) {
      return `High-risk indicators: ${highFlags.map(f => f.description).join(', ')}`;
    } else {
      return `${flags.length} fraud indicators detected`;
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(flags: FraudFlag[], riskLevel: string): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'CRITICAL') {
      recommendations.push('Immediate supervisor notification required');
      recommendations.push('Consider suspending agent access');
    }

    flags.forEach(flag => {
      switch (flag.type) {
        case 'LOCATION':
          recommendations.push('Verify agent location using alternative methods');
          break;
        case 'TIME':
          recommendations.push('Review agent work schedule and overtime policies');
          break;
        case 'DEVICE':
          recommendations.push('Verify agent device and check for tampering');
          break;
        case 'BEHAVIOR':
          recommendations.push('Monitor agent behavior patterns closely');
          break;
        case 'PATTERN':
          recommendations.push('Investigate potential systematic fraud');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Determine automatic actions
   */
  private determineAutoActions(flags: FraudFlag[], riskLevel: string): string[] {
    const actions: string[] = [];

    actions.push('LOG_INCIDENT');

    if (riskLevel === 'CRITICAL') {
      actions.push('ALERT_SUPERVISOR');
      actions.push('REQUIRE_ADDITIONAL_VERIFICATION');
    } else if (riskLevel === 'HIGH') {
      actions.push('ALERT_SUPERVISOR');
      actions.push('INCREASE_MONITORING');
    } else if (riskLevel === 'MEDIUM') {
      actions.push('INCREASE_MONITORING');
    }

    return actions;
  }

  /**
   * Load behavior pattern for agent
   */
  private async loadBehaviorPattern(agentId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`behaviorPattern_${agentId}`);
      if (stored) {
        this.behaviorPattern = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Load behavior pattern error:', error);
    }
  }

  /**
   * Update behavior pattern
   */
  async updateBehaviorPattern(agentId: string, activity: any): Promise<void> {
    try {
      if (!this.behaviorPattern) {
        this.behaviorPattern = {
          agentId,
          averageVisitDuration: 1800, // 30 minutes
          typicalWorkingHours: { start: 8, end: 17 },
          commonLocations: [],
          averageMovementSpeed: 5, // m/s
          photoTakingPatterns: {},
          salesPatterns: {},
          lastUpdated: new Date()
        };
      }

      // Update pattern based on activity
      // Implementation would analyze activity and update patterns

      await AsyncStorage.setItem(`behaviorPattern_${agentId}`, JSON.stringify(this.behaviorPattern));
    } catch (error) {
      console.error('Update behavior pattern error:', error);
    }
  }

  /**
   * Log fraud check event
   */
  private async logFraudCheck(input: FraudCheckInput, result: any): Promise<void> {
    try {
      const logEntry = {
        agentId: input.agentId,
        activityType: input.activityType,
        timestamp: input.timestamp,
        riskLevel: result.riskLevel,
        riskScore: result.riskScore,
        flagCount: result.flags.length,
        deviceFingerprint: this.deviceFingerprint?.deviceId
      };

      const logs = await AsyncStorage.getItem('fraudLogs') || '[]';
      const fraudLogs = JSON.parse(logs);
      fraudLogs.push(logEntry);

      // Keep only last 1000 logs
      if (fraudLogs.length > 1000) {
        fraudLogs.splice(0, fraudLogs.length - 1000);
      }

      await AsyncStorage.setItem('fraudLogs', JSON.stringify(fraudLogs));
    } catch (error) {
      console.error('Log fraud check error:', error);
    }
  }

  /**
   * Report security issue
   */
  private async reportSecurityIssue(type: string, description: string): Promise<void> {
    try {
      const securityIssue = {
        type,
        description,
        timestamp: new Date(),
        deviceFingerprint: this.deviceFingerprint,
        severity: 'HIGH'
      };

      const issues = await AsyncStorage.getItem('securityIssues') || '[]';
      const securityIssues = JSON.parse(issues);
      securityIssues.push(securityIssue);

      await AsyncStorage.setItem('securityIssues', JSON.stringify(securityIssues));

      // Show alert to user
      Alert.alert(
        'Security Alert',
        description,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Report security issue error:', error);
    }
  }

  /**
   * Get fraud statistics
   */
  async getFraudStatistics(): Promise<any> {
    try {
      const logs = await AsyncStorage.getItem('fraudLogs') || '[]';
      const fraudLogs = JSON.parse(logs);

      const stats = {
        totalChecks: fraudLogs.length,
        riskLevelBreakdown: {
          LOW: fraudLogs.filter((log: any) => log.riskLevel === 'LOW').length,
          MEDIUM: fraudLogs.filter((log: any) => log.riskLevel === 'MEDIUM').length,
          HIGH: fraudLogs.filter((log: any) => log.riskLevel === 'HIGH').length,
          CRITICAL: fraudLogs.filter((log: any) => log.riskLevel === 'CRITICAL').length
        },
        averageRiskScore: fraudLogs.reduce((sum: number, log: any) => sum + log.riskScore, 0) / fraudLogs.length || 0,
        lastCheck: fraudLogs.length > 0 ? new Date(fraudLogs[fraudLogs.length - 1].timestamp) : null
      };

      return stats;
    } catch (error) {
      console.error('Get fraud statistics error:', error);
      return null;
    }
  }

  /**
   * Clear fraud logs
   */
  async clearFraudLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem('fraudLogs');
      await AsyncStorage.removeItem('securityIssues');
    } catch (error) {
      console.error('Clear fraud logs error:', error);
    }
  }
}

export default FraudDetectionService;