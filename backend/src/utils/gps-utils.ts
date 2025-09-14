/**
 * GPS and Location Utilities for SalesSync
 * Handles GPS validation, distance calculations, and location fraud detection
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GPSValidationResult {
  valid: boolean;
  accuracy: number;
  distance?: number;
  fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
}

export interface LocationHistory {
  coordinates: Coordinates;
  timestamp: Date;
  accuracy: number;
  source: 'GPS' | 'NETWORK' | 'PASSIVE';
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
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
 * Validate GPS accuracy and detect potential spoofing
 * @param location Current location data
 * @param previousLocations Historical location data
 * @returns Validation result with fraud risk assessment
 */
export function validateGPSAccuracy(
  location: Coordinates & { accuracy: number; timestamp: Date },
  previousLocations: LocationHistory[] = []
): GPSValidationResult {
  const reasons: string[] = [];
  let fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

  // Check GPS accuracy
  if (location.accuracy > 100) {
    reasons.push('GPS accuracy too low (>100m)');
    fraudRisk = 'MEDIUM';
  }

  // Check for impossible travel speeds
  if (previousLocations.length > 0) {
    const lastLocation = previousLocations[previousLocations.length - 1];
    const distance = calculateDistance(location, lastLocation.coordinates);
    const timeDiff = (location.timestamp.getTime() - lastLocation.timestamp.getTime()) / 1000; // seconds
    const speed = distance / timeDiff; // m/s

    // Maximum human travel speed: 50 m/s (180 km/h)
    if (speed > 50) {
      reasons.push(`Impossible travel speed detected: ${(speed * 3.6).toFixed(1)} km/h`);
      fraudRisk = 'HIGH';
    }
  }

  // Check for coordinate precision anomalies (potential spoofing)
  const latPrecision = countDecimalPlaces(location.latitude);
  const lonPrecision = countDecimalPlaces(location.longitude);

  if (latPrecision > 8 || lonPrecision > 8) {
    reasons.push('Suspicious coordinate precision detected');
    fraudRisk = fraudRisk === 'HIGH' ? 'HIGH' : 'MEDIUM';
  }

  // Check for repeated exact coordinates (potential spoofing)
  const exactMatches = previousLocations.filter(prev =>
    prev.coordinates.latitude === location.latitude &&
    prev.coordinates.longitude === location.longitude
  ).length;

  if (exactMatches > 3) {
    reasons.push('Multiple exact coordinate matches detected');
    fraudRisk = 'HIGH';
  }

  return {
    valid: fraudRisk !== 'HIGH',
    accuracy: location.accuracy,
    fraudRisk,
    reasons
  };
}

/**
 * Validate if location is within acceptable radius of target
 * @param currentLocation Current GPS location
 * @param targetLocation Target location
 * @param radiusMeters Acceptable radius in meters
 * @returns Validation result
 */
export function validateLocationRadius(
  currentLocation: Coordinates,
  targetLocation: Coordinates,
  radiusMeters: number = 100
): { valid: boolean; distance: number; radius: number } {
  const distance = calculateDistance(currentLocation, targetLocation);
  
  return {
    valid: distance <= radiusMeters,
    distance,
    radius: radiusMeters
  };
}

/**
 * Generate geofence for a location
 * @param center Center coordinates
 * @param radiusMeters Radius in meters
 * @returns Geofence boundary coordinates
 */
export function generateGeofence(
  center: Coordinates,
  radiusMeters: number
): Coordinates[] {
  const points: Coordinates[] = [];
  const earthRadius = 6371000; // Earth radius in meters
  
  // Generate 16 points around the circle
  for (let i = 0; i < 16; i++) {
    const angle = (i * 360 / 16) * Math.PI / 180;
    
    const lat = center.latitude + (radiusMeters / earthRadius) * (180 / Math.PI) * Math.cos(angle);
    const lon = center.longitude + (radiusMeters / earthRadius) * (180 / Math.PI) * Math.sin(angle) / Math.cos(center.latitude * Math.PI / 180);
    
    points.push({ latitude: lat, longitude: lon });
  }
  
  return points;
}

/**
 * Check if point is inside geofence
 * @param point Point to check
 * @param geofence Geofence boundary points
 * @returns True if point is inside geofence
 */
export function isInsideGeofence(point: Coordinates, geofence: Coordinates[]): boolean {
  let inside = false;
  
  for (let i = 0, j = geofence.length - 1; i < geofence.length; j = i++) {
    if (((geofence[i].latitude > point.latitude) !== (geofence[j].latitude > point.latitude)) &&
        (point.longitude < (geofence[j].longitude - geofence[i].longitude) * 
         (point.latitude - geofence[i].latitude) / (geofence[j].latitude - geofence[i].latitude) + geofence[i].longitude)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Calculate travel time between locations
 * @param from Starting location
 * @param to Destination location
 * @param mode Travel mode ('walking', 'driving', 'transit')
 * @returns Estimated travel time in seconds
 */
export function estimateTravelTime(
  from: Coordinates,
  to: Coordinates,
  mode: 'walking' | 'driving' | 'transit' = 'driving'
): number {
  const distance = calculateDistance(from, to);
  
  // Average speeds in m/s
  const speeds = {
    walking: 1.4,    // 5 km/h
    driving: 13.9,   // 50 km/h
    transit: 8.3     // 30 km/h
  };
  
  return Math.round(distance / speeds[mode]);
}

/**
 * Optimize route for multiple locations
 * @param start Starting location
 * @param destinations Array of destinations
 * @returns Optimized route order
 */
export function optimizeRoute(
  start: Coordinates,
  destinations: (Coordinates & { id: string })[]
): (Coordinates & { id: string })[] {
  if (destinations.length <= 1) return destinations;
  
  // Simple nearest neighbor algorithm
  const optimized: (Coordinates & { id: string })[] = [];
  const remaining = [...destinations];
  let current = start;
  
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = calculateDistance(current, remaining[0]);
    
    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(current, remaining[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }
    
    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    current = nearest;
  }
  
  return optimized;
}

/**
 * Detect location anomalies in movement pattern
 * @param locations Array of location history
 * @returns Anomaly detection result
 */
export function detectLocationAnomalies(locations: LocationHistory[]): {
  anomalies: LocationHistory[];
  patterns: string[];
  riskScore: number;
} {
  const anomalies: LocationHistory[] = [];
  const patterns: string[] = [];
  let riskScore = 0;
  
  if (locations.length < 2) {
    return { anomalies, patterns, riskScore };
  }
  
  for (let i = 1; i < locations.length; i++) {
    const current = locations[i];
    const previous = locations[i - 1];
    
    const distance = calculateDistance(current.coordinates, previous.coordinates);
    const timeDiff = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
    const speed = distance / timeDiff;
    
    // Check for teleportation (impossible speed)
    if (speed > 100) { // 360 km/h
      anomalies.push(current);
      patterns.push('Teleportation detected');
      riskScore += 50;
    }
    
    // Check for stationary periods with exact coordinates
    if (distance === 0 && timeDiff > 3600) { // 1 hour
      patterns.push('Extended stationary period with exact coordinates');
      riskScore += 20;
    }
    
    // Check for low accuracy readings
    if (current.accuracy > 200) {
      patterns.push('Low accuracy GPS reading');
      riskScore += 10;
    }
  }
  
  return {
    anomalies,
    patterns,
    riskScore: Math.min(riskScore, 100)
  };
}

/**
 * Generate location-based insights
 * @param locations Array of location history
 * @returns Location insights
 */
export function generateLocationInsights(locations: LocationHistory[]): {
  totalDistance: number;
  averageSpeed: number;
  timeSpent: number;
  mostVisitedArea: Coordinates | null;
  travelPattern: 'NORMAL' | 'SUSPICIOUS' | 'FRAUDULENT';
} {
  if (locations.length < 2) {
    return {
      totalDistance: 0,
      averageSpeed: 0,
      timeSpent: 0,
      mostVisitedArea: null,
      travelPattern: 'NORMAL'
    };
  }
  
  let totalDistance = 0;
  let totalTime = 0;
  
  for (let i = 1; i < locations.length; i++) {
    const distance = calculateDistance(locations[i - 1].coordinates, locations[i].coordinates);
    const time = (locations[i].timestamp.getTime() - locations[i - 1].timestamp.getTime()) / 1000;
    
    totalDistance += distance;
    totalTime += time;
  }
  
  const averageSpeed = totalTime > 0 ? totalDistance / totalTime : 0;
  
  // Detect travel pattern
  const anomalyResult = detectLocationAnomalies(locations);
  let travelPattern: 'NORMAL' | 'SUSPICIOUS' | 'FRAUDULENT' = 'NORMAL';
  
  if (anomalyResult.riskScore > 70) {
    travelPattern = 'FRAUDULENT';
  } else if (anomalyResult.riskScore > 30) {
    travelPattern = 'SUSPICIOUS';
  }
  
  return {
    totalDistance,
    averageSpeed,
    timeSpent: totalTime,
    mostVisitedArea: locations.length > 0 ? locations[0].coordinates : null,
    travelPattern
  };
}

/**
 * Helper function to count decimal places
 */
function countDecimalPlaces(value: number): number {
  if (Math.floor(value) === value) return 0;
  const str = value.toString();
  if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
    return str.split('.')[1].length;
  } else if (str.indexOf('e-') !== -1) {
    const parts = str.split('e-');
    return parseInt(parts[1], 10);
  }
  return 0;
}

/**
 * Convert coordinates to human-readable address (mock implementation)
 * In production, this would integrate with Google Maps Geocoding API
 */
export async function reverseGeocode(coordinates: Coordinates): Promise<string> {
  // Mock implementation - in production, integrate with geocoding service
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

/**
 * Get coordinates from address (mock implementation)
 * In production, this would integrate with Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  // Mock implementation - in production, integrate with geocoding service
  return null;
}

export default {
  calculateDistance,
  validateGPSAccuracy,
  validateLocationRadius,
  generateGeofence,
  isInsideGeofence,
  estimateTravelTime,
  optimizeRoute,
  detectLocationAnomalies,
  generateLocationInsights,
  reverseGeocode,
  geocodeAddress
};