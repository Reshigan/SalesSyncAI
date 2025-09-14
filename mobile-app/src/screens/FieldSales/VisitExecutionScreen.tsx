import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Camera, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/AuthContext';
import { visitService } from '../../services/visitService';
import { photoService } from '../../services/photoService';
import { offlineService } from '../../services/offlineService';

interface Visit {
  id: string;
  customerId: string;
  customer: {
    name: string;
    address: string;
    phone: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  status: string;
  scheduledTime: string;
  surveys: any[];
  activities: any[];
}

const VisitExecutionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { visitId } = route.params as { visitId: string };

  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [visitStarted, setVisitStarted] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraRef, setCameraRef] = useState<any>(null);

  useEffect(() => {
    loadVisit();
    getCurrentLocation();
  }, []);

  const loadVisit = async () => {
    try {
      const visitData = await visitService.getVisit(visitId);
      setVisit(visitData);
      setVisitStarted(visitData.status === 'IN_PROGRESS');
    } catch (error) {
      console.error('Error loading visit:', error);
      Alert.alert('Error', 'Failed to load visit details');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for visit verification');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const validateLocation = (visitLocation: any, currentLoc: any): boolean => {
    if (!visitLocation || !currentLoc) return false;
    
    const distance = calculateDistance(
      visitLocation.latitude,
      visitLocation.longitude,
      currentLoc.coords.latitude,
      currentLoc.coords.longitude
    );
    
    return distance <= 100; // 100 meters tolerance
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const startVisit = async () => {
    if (!currentLocation || !visit) {
      Alert.alert('Error', 'Location or visit data not available');
      return;
    }

    const locationValid = validateLocation(visit.customer.coordinates, currentLocation);
    
    if (!locationValid) {
      Alert.alert(
        'Location Verification Failed',
        'You appear to be too far from the customer location. Are you sure you want to continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue Anyway', onPress: proceedWithStart }
        ]
      );
      return;
    }

    proceedWithStart();
  };

  const proceedWithStart = async () => {
    try {
      setLoading(true);
      
      // Take arrival photo
      const arrivalPhoto = await takePhoto('arrival');
      
      const startData = {
        location: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          accuracy: currentLocation.coords.accuracy
        },
        arrivalPhoto
      };

      await visitService.startVisit(visitId, startData);
      setVisitStarted(true);
      Alert.alert('Success', 'Visit started successfully');
    } catch (error) {
      console.error('Error starting visit:', error);
      Alert.alert('Error', 'Failed to start visit');
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async (type: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      setShowCamera(true);
      // In a real implementation, this would handle camera capture
      // For now, return a placeholder
      setTimeout(() => {
        setShowCamera(false);
        const photoUri = `photo_${type}_${Date.now()}.jpg`;
        setPhotos(prev => [...prev, photoUri]);
        resolve(photoUri);
      }, 2000);
    });
  };

  const completeActivity = async (activityType: string, data: any) => {
    try {
      await visitService.recordActivity(visitId, {
        activityType,
        data,
        photos: photos.filter(p => p.includes(activityType)),
        notes
      });
      
      Alert.alert('Success', `${activityType} completed successfully`);
    } catch (error) {
      console.error('Error completing activity:', error);
      Alert.alert('Error', `Failed to complete ${activityType}`);
    }
  };

  const completeSurvey = (surveyId: string) => {
    navigation.navigate('SurveyExecution', { 
      visitId, 
      surveyId,
      onComplete: () => loadVisit()
    });
  };

  const completeVisit = async () => {
    try {
      setLoading(true);
      
      // Take departure photo
      const departurePhoto = await takePhoto('departure');
      
      const completeData = {
        departureLocation: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude
        },
        departurePhoto,
        visitSummary: notes,
        customerFeedback: '', // Would be collected from form
        nextVisitRequired: false
      };

      await visitService.completeVisit(visitId, completeData);
      Alert.alert('Success', 'Visit completed successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error completing visit:', error);
      Alert.alert('Error', 'Failed to complete visit');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading visit details...</Text>
      </View>
    );
  }

  if (!visit) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Visit not found</Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Customer Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Information</Text>
        <Text style={styles.customerName}>{visit.customer.name}</Text>
        <Text style={styles.customerDetails}>{visit.customer.address}</Text>
        <Text style={styles.customerDetails}>{visit.customer.phone}</Text>
      </View>

      {/* Visit Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visit Status</Text>
        <View style={[styles.statusBadge, 
          visit.status === 'COMPLETED' ? styles.statusCompleted :
          visit.status === 'IN_PROGRESS' ? styles.statusInProgress :
          styles.statusPlanned
        ]}>
          <Text style={styles.statusText}>{visit.status}</Text>
        </View>
      </View>

      {/* Visit Actions */}
      {!visitStarted && (
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]}
          onPress={startVisit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Start Visit</Text>
        </TouchableOpacity>
      )}

      {visitStarted && (
        <>
          {/* Surveys Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Surveys</Text>
            {visit.surveys.map((survey, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.activityItem, 
                  survey.status === 'COMPLETED' ? styles.activityCompleted : styles.activityPending
                ]}
                onPress={() => completeSurvey(survey.id)}
                disabled={survey.status === 'COMPLETED'}
              >
                <Text style={styles.activityText}>
                  {survey.title || `Survey ${index + 1}`}
                </Text>
                <Text style={styles.activityStatus}>{survey.status}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Photo Documentation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photo Documentation</Text>
            <TouchableOpacity 
              style={styles.photoButton}
              onPress={() => takePhoto('store_exterior')}
            >
              <Text style={styles.photoButtonText}>Take Store Exterior Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.photoButton}
              onPress={() => takePhoto('store_interior')}
            >
              <Text style={styles.photoButtonText}>Take Store Interior Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.photoButton}
              onPress={() => takePhoto('product_display')}
            >
              <Text style={styles.photoButtonText}>Take Product Display Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Photos Taken */}
          {photos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photos Taken ({photos.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoThumbnail}>
                    <Text style={styles.photoName}>{photo}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visit Notes</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Enter visit notes..."
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Activity Buttons */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.activityButton}
              onPress={() => completeActivity('ASSET_AUDIT', {})}
            >
              <Text style={styles.activityButtonText}>Asset Audit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.activityButton}
              onPress={() => navigation.navigate('SalesEntry', { visitId })}
            >
              <Text style={styles.activityButtonText}>Record Sale</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.activityButton}
              onPress={() => navigation.navigate('PaymentCollection', { visitId })}
            >
              <Text style={styles.activityButtonText}>Collect Payment</Text>
            </TouchableOpacity>
          </View>

          {/* Complete Visit */}
          <TouchableOpacity 
            style={[styles.button, styles.successButton]}
            onPress={completeVisit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Complete Visit</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Camera Modal */}
      {showCamera && (
        <View style={styles.cameraContainer}>
          <Text style={styles.cameraText}>Taking photo...</Text>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 16
  },
  errorText: {
    fontSize: 18,
    color: '#E53E3E',
    marginBottom: 16
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 12
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8
  },
  customerDetails: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start'
  },
  statusPlanned: {
    backgroundColor: '#FED7D7'
  },
  statusInProgress: {
    backgroundColor: '#FEEBC8'
  },
  statusCompleted: {
    backgroundColor: '#C6F6D5'
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  button: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8
  },
  primaryButton: {
    backgroundColor: '#1E3A8A'
  },
  successButton: {
    backgroundColor: '#10B981'
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold'
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8
  },
  activityPending: {
    backgroundColor: '#FED7D7'
  },
  activityCompleted: {
    backgroundColor: '#C6F6D5'
  },
  activityText: {
    fontSize: 16,
    color: '#333'
  },
  activityStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666'
  },
  photoButton: {
    backgroundColor: '#FB923C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 8
  },
  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  photoName: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center'
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top'
  },
  activityButton: {
    backgroundColor: '#374151',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 8
  },
  activityButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cameraText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginBottom: 16
  }
});

export default VisitExecutionScreen;