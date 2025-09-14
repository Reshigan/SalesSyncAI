/**
 * Advanced GPS Service for SalesSync Mobile App
 * Handles location tracking, validation, and fraud detection
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationPoint extends Coordinates {
  accuracy: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

export interface LocationHistory {
  points: LocationPoint[];
  totalDistance: number;
  averageSpeed: number;
  suspiciousMovements: SuspiciousMovement[];
}

export interface SuspiciousMovement {
  type: 'IMPOSSIBLE_SPEED' | 'TELEPORTATION' | 'GPS_SPOOFING' | 'LOCATION_JUMPING';
  timestamp: Date;
  description: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: any;
}

export interface GeofenceArea {
  id: string;
  name: string;
  center: Coordinates;
  radius: number; // meters
  type: 'CUSTOMER' | 'WAREHOUSE' | 'OFFICE' | 'RESTRICTED';
}

export interface RouteOptimization {
  waypoints: Coordinates[];
  optimizedOrder: number[];
  totalDistance: number;
  estimatedTime: number; // minutes
  fuelCost: number;
}

export class GPSService {
  private static instance: GPSService;
  private locationSubscription: Location.LocationSubscription | null = null;
  private locationHistory: LocationPoint[] = [];
  private geofences: GeofenceArea[] = [];
  private isTracking = false;

  constructor() {
    this.loadLocationHistory();
    this.loadGeofences();
  }

  static getInstance(): GPSService {
    if (!GPSService.instance) {
      GPSService.instance = new GPSService();
    }
    return GPSService.instance;
  }

  /**
   * Initialize GPS service and request permissions
   */
  async initialize(): Promise<boolean> {
    try {
      // Request foreground permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for field operations');
        return false;
      }

      // Request background permissions for continuous tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted');
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert('Location Services', 'Please enable location services to continue');
        return false;
      }

      return true;
    } catch (error) {
      console.error('GPS initialization error:', error);
      return false;
    }
  }

  /**
   * Get current high-accuracy location
   */
  async getCurrentLocation(): Promise<LocationPoint | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        maximumAge: 10000, // 10 seconds
        timeout: 30000 // 30 seconds
      });

      const locationPoint: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: new Date(location.timestamp),
        speed: location.coords.speed || undefined,
        heading: location.coords.heading || undefined
      };

      // Add to history
      this.addLocationToHistory(locationPoint);

      return locationPoint;
    } catch (error) {
      console.error('Get current location error:', error);
      return null;
    }
  }

  /**
   * Start continuous location tracking
   */
  async startTracking(options?: {
    accuracy?: Location.Accuracy;
    timeInterval?: number;
    distanceInterval?: number;
  }): Promise<boolean> {
    try {
      if (this.isTracking) {
        console.warn('Location tracking already active');
        return true;
      }

      const trackingOptions = {
        accuracy: options?.accuracy || Location.Accuracy.High,
        timeInterval: options?.timeInterval || 30000, // 30 seconds
        distanceInterval: options?.distanceInterval || 10, // 10 meters
        mayShowUserSettingsDialog: true,
        foregroundService: {
          notificationTitle: 'SalesSync Location Tracking',
          notificationBody: 'Tracking your location for field operations',
          notificationColor: '#1E3A8A'
        }
      };

      this.locationSubscription = await Location.watchPositionAsync(
        trackingOptions,
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      this.isTracking = true;
      console.log('Location tracking started');
      return true;
    } catch (error) {
      console.error('Start tracking error:', error);
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  async stopTracking(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }
      this.isTracking = false;
      console.log('Location tracking stopped');
    } catch (error) {
      console.error('Stop tracking error:', error);
    }
  }

  /**
   * Handle location updates
   */
  private handleLocationUpdate(location: Location.LocationObject): void {
    const locationPoint: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || 0,
      timestamp: new Date(location.timestamp),
      speed: location.coords.speed || undefined,
      heading: location.coords.heading || undefined
    };

    // Add to history
    this.addLocationToHistory(locationPoint);

    // Check for suspicious movements
    this.detectSuspiciousMovement(locationPoint);

    // Check geofences
    this.checkGeofences(locationPoint);

    // Save to storage
    this.saveLocationHistory();
  }

  /**
   * Add location point to history
   */
  private addLocationToHistory(location: LocationPoint): void {
    this.locationHistory.push(location);

    // Keep only last 1000 points to manage memory
    if (this.locationHistory.length > 1000) {
      this.locationHistory = this.locationHistory.slice(-1000);
    }
  }

  /**
   * Detect suspicious movement patterns
   */
  private detectSuspiciousMovement(currentLocation: LocationPoint): void {
    if (this.locationHistory.length < 2) return;

    const previousLocation = this.locationHistory[this.locationHistory.length - 2];
    const distance = this.calculateDistance(previousLocation, currentLocation);
    const timeDiff = (currentLocation.timestamp.getTime() - previousLocation.timestamp.getTime()) / 1000; // seconds
    const speed = distance / timeDiff; // m/s

    // Check for impossible speeds (over 200 km/h)
    if (speed > 55.56) { // 200 km/h in m/s
      const suspiciousMovement: SuspiciousMovement = {
        type: 'IMPOSSIBLE_SPEED',
        timestamp: currentLocation.timestamp,
        description: `Impossible speed detected: ${(speed * 3.6).toFixed(1)} km/h`,
        riskLevel: 'HIGH',
        evidence: {
          speed: speed * 3.6, // km/h
          distance,
          timeDiff,
          previousLocation,
          currentLocation
        }
      };
      this.reportSuspiciousMovement(suspiciousMovement);
    }

    // Check for teleportation (large distance, short time, low accuracy)
    if (distance > 1000 && timeDiff < 60 && currentLocation.accuracy > 100) {
      const suspiciousMovement: SuspiciousMovement = {
        type: 'TELEPORTATION',
        timestamp: currentLocation.timestamp,
        description: `Possible teleportation: ${distance.toFixed(0)}m in ${timeDiff}s`,
        riskLevel: 'HIGH',
        evidence: {
          distance,
          timeDiff,
          accuracy: currentLocation.accuracy,
          previousLocation,
          currentLocation
        }
      };
      this.reportSuspiciousMovement(suspiciousMovement);
    }

    // Check for GPS spoofing indicators
    if (this.detectGPSSpoofing(currentLocation)) {
      const suspiciousMovement: SuspiciousMovement = {
        type: 'GPS_SPOOFING',
        timestamp: currentLocation.timestamp,
        description: 'Potential GPS spoofing detected',
        riskLevel: 'HIGH',
        evidence: {
          accuracy: currentLocation.accuracy,
          speed: currentLocation.speed,
          heading: currentLocation.heading
        }
      };
      this.reportSuspiciousMovement(suspiciousMovement);
    }
  }

  /**
   * Detect GPS spoofing indicators
   */
  private detectGPSSpoofing(location: LocationPoint): boolean {
    // Check for unrealistic accuracy
    if (location.accuracy && location.accuracy < 1) {
      return true; // Too accurate to be real
    }

    // Check for missing speed/heading data when moving
    if (this.locationHistory.length > 1) {
      const previousLocation = this.locationHistory[this.locationHistory.length - 2];
      const distance = this.calculateDistance(previousLocation, location);
      const timeDiff = (location.timestamp.getTime() - previousLocation.timestamp.getTime()) / 1000;
      const calculatedSpeed = distance / timeDiff;

      if (calculatedSpeed > 1 && !location.speed) {
        return true; // Moving but no speed data
      }
    }

    // Check for exact coordinates (spoofed locations often have exact values)
    const latStr = location.latitude.toString();
    const lngStr = location.longitude.toString();
    if (latStr.split('.')[1]?.length < 4 || lngStr.split('.')[1]?.length < 4) {
      return true; // Too few decimal places
    }

    return false;
  }

  /**
   * Report suspicious movement
   */
  private reportSuspiciousMovement(movement: SuspiciousMovement): void {
    console.warn('Suspicious movement detected:', movement);
    
    // Store for later reporting
    AsyncStorage.getItem('suspiciousMovements').then(stored => {
      const movements = stored ? JSON.parse(stored) : [];
      movements.push(movement);
      AsyncStorage.setItem('suspiciousMovements', JSON.stringify(movements));
    });

    // Show alert for high-risk movements
    if (movement.riskLevel === 'HIGH') {
      Alert.alert(
        'Location Security Alert',
        movement.description,
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
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
   * Calculate bearing between two coordinates
   */
  calculateBearing(coord1: Coordinates, coord2: Coordinates): number {
    const φ1 = coord1.latitude * Math.PI / 180;
    const φ2 = coord2.latitude * Math.PI / 180;
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360; // Convert to degrees and normalize
  }

  /**
   * Check if location is within geofence
   */
  isWithinGeofence(location: Coordinates, geofence: GeofenceArea): boolean {
    const distance = this.calculateDistance(location, geofence.center);
    return distance <= geofence.radius;
  }

  /**
   * Check all geofences for current location
   */
  private checkGeofences(location: LocationPoint): void {
    for (const geofence of this.geofences) {
      const isInside = this.isWithinGeofence(location, geofence);
      
      // Store geofence events
      AsyncStorage.getItem(`geofence_${geofence.id}_status`).then(lastStatus => {
        const wasInside = lastStatus === 'inside';
        
        if (isInside && !wasInside) {
          // Entered geofence
          this.handleGeofenceEvent('ENTER', geofence, location);
        } else if (!isInside && wasInside) {
          // Exited geofence
          this.handleGeofenceEvent('EXIT', geofence, location);
        }
        
        AsyncStorage.setItem(`geofence_${geofence.id}_status`, isInside ? 'inside' : 'outside');
      });
    }
  }

  /**
   * Handle geofence events
   */
  private handleGeofenceEvent(event: 'ENTER' | 'EXIT', geofence: GeofenceArea, location: LocationPoint): void {
    console.log(`Geofence ${event}: ${geofence.name}`);
    
    // Store event
    const geofenceEvent = {
      event,
      geofence,
      location,
      timestamp: new Date()
    };
    
    AsyncStorage.getItem('geofenceEvents').then(stored => {
      const events = stored ? JSON.parse(stored) : [];
      events.push(geofenceEvent);
      AsyncStorage.setItem('geofenceEvents', JSON.stringify(events));
    });
  }

  /**
   * Add geofence area
   */
  addGeofence(geofence: GeofenceArea): void {
    this.geofences.push(geofence);
    this.saveGeofences();
  }

  /**
   * Remove geofence area
   */
  removeGeofence(geofenceId: string): void {
    this.geofences = this.geofences.filter(g => g.id !== geofenceId);
    this.saveGeofences();
  }

  /**
   * Optimize route for multiple waypoints
   */
  async optimizeRoute(waypoints: Coordinates[], startLocation?: Coordinates): Promise<RouteOptimization> {
    try {
      const start = startLocation || await this.getCurrentLocation();
      if (!start) {
        throw new Error('Unable to get current location');
      }

      // Simple nearest neighbor algorithm (in production, use Google Directions API)
      const unvisited = [...waypoints];
      const optimizedOrder: number[] = [];
      let currentLocation = start;
      let totalDistance = 0;

      while (unvisited.length > 0) {
        let nearestIndex = 0;
        let nearestDistance = this.calculateDistance(currentLocation, unvisited[0]);

        for (let i = 1; i < unvisited.length; i++) {
          const distance = this.calculateDistance(currentLocation, unvisited[i]);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }

        const originalIndex = waypoints.indexOf(unvisited[nearestIndex]);
        optimizedOrder.push(originalIndex);
        currentLocation = unvisited[nearestIndex];
        totalDistance += nearestDistance;
        unvisited.splice(nearestIndex, 1);
      }

      // Estimate time (assuming average speed of 30 km/h in urban areas)
      const estimatedTime = (totalDistance / 1000) * 2; // minutes

      // Estimate fuel cost (assuming 10L/100km and R20/L)
      const fuelCost = (totalDistance / 1000) * 0.1 * 20;

      return {
        waypoints,
        optimizedOrder,
        totalDistance,
        estimatedTime,
        fuelCost
      };
    } catch (error) {
      console.error('Route optimization error:', error);
      throw error;
    }
  }

  /**
   * Get location history
   */
  getLocationHistory(): LocationPoint[] {
    return [...this.locationHistory];
  }

  /**
   * Get location statistics
   */
  getLocationStatistics(): LocationHistory {
    if (this.locationHistory.length < 2) {
      return {
        points: this.locationHistory,
        totalDistance: 0,
        averageSpeed: 0,
        suspiciousMovements: []
      };
    }

    let totalDistance = 0;
    let totalTime = 0;
    const suspiciousMovements: SuspiciousMovement[] = [];

    for (let i = 1; i < this.locationHistory.length; i++) {
      const prev = this.locationHistory[i - 1];
      const curr = this.locationHistory[i];
      
      const distance = this.calculateDistance(prev, curr);
      const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
      
      totalDistance += distance;
      totalTime += timeDiff;
    }

    const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 3.6 : 0; // km/h

    return {
      points: this.locationHistory,
      totalDistance,
      averageSpeed,
      suspiciousMovements
    };
  }

  /**
   * Validate location accuracy
   */
  validateLocationAccuracy(location: LocationPoint, requiredAccuracy: number = 50): boolean {
    return location.accuracy <= requiredAccuracy;
  }

  /**
   * Get address from coordinates (reverse geocoding)
   */
  async getAddressFromCoordinates(coordinates: Coordinates): Promise<string | null> {
    try {
      const addresses = await Location.reverseGeocodeAsync(coordinates);
      if (addresses.length > 0) {
        const address = addresses[0];
        return `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim();
      }
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Save location history to storage
   */
  private async saveLocationHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('locationHistory', JSON.stringify(this.locationHistory));
    } catch (error) {
      console.error('Save location history error:', error);
    }
  }

  /**
   * Load location history from storage
   */
  private async loadLocationHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('locationHistory');
      if (stored) {
        this.locationHistory = JSON.parse(stored).map((point: any) => ({
          ...point,
          timestamp: new Date(point.timestamp)
        }));
      }
    } catch (error) {
      console.error('Load location history error:', error);
    }
  }

  /**
   * Save geofences to storage
   */
  private async saveGeofences(): Promise<void> {
    try {
      await AsyncStorage.setItem('geofences', JSON.stringify(this.geofences));
    } catch (error) {
      console.error('Save geofences error:', error);
    }
  }

  /**
   * Load geofences from storage
   */
  private async loadGeofences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('geofences');
      if (stored) {
        this.geofences = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Load geofences error:', error);
    }
  }

  /**
   * Clear location history
   */
  async clearLocationHistory(): Promise<void> {
    this.locationHistory = [];
    await AsyncStorage.removeItem('locationHistory');
  }

  /**
   * Export location data for analysis
   */
  async exportLocationData(): Promise<string> {
    const data = {
      locationHistory: this.locationHistory,
      geofences: this.geofences,
      statistics: this.getLocationStatistics(),
      exportDate: new Date()
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Check if tracking is active
   */
  isTrackingActive(): boolean {
    return this.isTracking;
  }
}

export default GPSService;