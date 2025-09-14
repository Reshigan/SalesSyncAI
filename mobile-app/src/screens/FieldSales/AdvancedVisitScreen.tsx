/**
 * Advanced Visit Execution Screen for SalesSync Mobile App
 * Complete field sales visit management with GPS, photos, surveys, and sales
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  TextInput,
  Switch,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import BluetoothPrinterService from '../../services/BluetoothPrinterService';
import { GPSService } from '../../services/GPSService';
import { OfflineStorageService } from '../../services/OfflineStorageService';
import { SyncService } from '../../services/SyncService';
import { FraudDetectionService } from '../../services/FraudDetectionService';
import { NotificationService } from '../../services/NotificationService';

const { width, height } = Dimensions.get('window');

interface VisitData {
  id: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  visitType: 'SCHEDULED' | 'AD_HOC' | 'FOLLOW_UP';
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startTime?: Date;
  endTime?: Date;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };
  activities: VisitActivity[];
  photos: VisitPhoto[];
  surveys: SurveyResponse[];
  sales: SaleTransaction[];
  notes: string;
  fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  syncStatus: 'LOCAL' | 'SYNCING' | 'SYNCED' | 'ERROR';
}

interface VisitActivity {
  id: string;
  type: 'ARRIVAL' | 'SURVEY' | 'SALE' | 'PHOTO' | 'AUDIT' | 'DEPARTURE';
  timestamp: Date;
  duration?: number;
  completed: boolean;
  required: boolean;
  data?: any;
}

interface VisitPhoto {
  id: string;
  type: 'EXTERIOR' | 'INTERIOR' | 'PRODUCT_DISPLAY' | 'RECEIPT' | 'ASSET';
  uri: string;
  timestamp: Date;
  location: { latitude: number; longitude: number };
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  aiAnalysis?: {
    brandVisibility: number;
    shelfShare: number;
    qualityScore: number;
    issues: string[];
  };
  uploaded: boolean;
}

interface SurveyResponse {
  id: string;
  surveyId: string;
  responses: QuestionResponse[];
  completedAt: Date;
  duration: number;
}

interface QuestionResponse {
  questionId: string;
  value: any;
  photoUri?: string;
}

interface SaleTransaction {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'CREDIT';
  cashReceived?: number;
  changeGiven?: number;
  receiptPrinted: boolean;
  timestamp: Date;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const AdvancedVisitScreen: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { customerId, visitType = 'SCHEDULED' } = route.params;

  // State management
  const [visit, setVisit] = useState<VisitData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraType, setCameraType] = useState(CameraType.back);
  const [currentPhotoType, setCurrentPhotoType] = useState<VisitPhoto['type']>('EXTERIOR');
  const [surveyModalVisible, setSurveyModalVisible] = useState(false);
  const [salesModalVisible, setSalesModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gpsTracking, setGpsTracking] = useState(false);
  const [fraudAlerts, setFraudAlerts] = useState<string[]>([]);

  // Refs
  const cameraRef = useRef<Camera>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const accelerometerRef = useRef<any>(null);
  const gyroscopeRef = useRef<any>(null);

  // Services
  const gpsService = new GPSService();
  const offlineStorage = new OfflineStorageService();
  const syncService = new SyncService();
  const fraudDetection = new FraudDetectionService();
  const notifications = new NotificationService();

  useEffect(() => {
    initializeVisit();
    setupLocationTracking();
    setupNetworkListener();
    setupSensorTracking();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeVisit = async () => {
    try {
      setLoading(true);

      // Get customer data
      const customer = await offlineStorage.getCustomer(customerId);
      if (!customer) {
        Alert.alert('Error', 'Customer not found');
        navigation.goBack();
        return;
      }

      // Create or load existing visit
      let visitData = await offlineStorage.getActiveVisit(customerId);
      if (!visitData) {
        visitData = {
          id: `visit_${Date.now()}`,
          customerId,
          customerName: customer.name,
          customerAddress: customer.address,
          visitType,
          status: 'PLANNED',
          activities: await generateRequiredActivities(customer),
          photos: [],
          surveys: [],
          sales: [],
          notes: '',
          fraudRisk: 'LOW',
          syncStatus: 'LOCAL'
        };
        await offlineStorage.saveVisit(visitData);
      }

      setVisit(visitData);
    } catch (error) {
      console.error('Initialize visit error:', error);
      Alert.alert('Error', 'Failed to initialize visit');
    } finally {
      setLoading(false);
    }
  };

  const setupLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for visit tracking');
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setCurrentLocation(location);

      // Start continuous tracking
      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000, // 30 seconds
          distanceInterval: 10 // 10 meters
        },
        (newLocation) => {
          setCurrentLocation(newLocation);
          handleLocationUpdate(newLocation);
        }
      );

      setGpsTracking(true);
    } catch (error) {
      console.error('Location setup error:', error);
      Alert.alert('Error', 'Failed to setup location tracking');
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
      if (state.isConnected && visit) {
        // Auto-sync when coming back online
        syncVisitData();
      }
    });

    return unsubscribe;
  };

  const setupSensorTracking = () => {
    // Setup accelerometer for movement detection
    accelerometerRef.current = Accelerometer.addListener(accelerometerData => {
      // Detect if device is moving (for fraud detection)
      const movement = Math.sqrt(
        accelerometerData.x ** 2 + 
        accelerometerData.y ** 2 + 
        accelerometerData.z ** 2
      );
      
      if (movement > 2.0) { // Significant movement threshold
        handleMovementDetected(movement);
      }
    });

    // Setup gyroscope for orientation detection
    gyroscopeRef.current = Gyroscope.addListener(gyroscopeData => {
      // Can be used for photo quality analysis
    });

    Accelerometer.setUpdateInterval(1000); // 1 second
    Gyroscope.setUpdateInterval(1000);
  };

  const cleanup = () => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
    }
    if (accelerometerRef.current) {
      accelerometerRef.current.remove();
    }
    if (gyroscopeRef.current) {
      gyroscopeRef.current.remove();
    }
  };

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    if (!visit) return;

    try {
      // Fraud detection check
      const fraudCheck = await fraudDetection.checkLocationFraud({
        agentId: await AsyncStorage.getItem('userId') || '',
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0
        },
        timestamp: new Date(),
        previousLocations: await offlineStorage.getLocationHistory()
      });

      if (fraudCheck.riskLevel === 'HIGH') {
        setFraudAlerts(prev => [...prev, fraudCheck.reason]);
        await notifications.showLocalNotification(
          'Fraud Alert',
          'Suspicious location activity detected'
        );
      }

      // Update visit location
      const updatedVisit = {
        ...visit,
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || 0,
          timestamp: new Date()
        },
        fraudRisk: fraudCheck.riskLevel
      };

      setVisit(updatedVisit);
      await offlineStorage.saveVisit(updatedVisit);

      // Save location history for fraud detection
      await offlineStorage.saveLocationPoint({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Location update error:', error);
    }
  };

  const handleMovementDetected = async (movement: number) => {
    // Can be used for activity detection and fraud prevention
    if (visit && visit.status === 'IN_PROGRESS') {
      // Log movement for visit analytics
      await offlineStorage.saveMovementData({
        visitId: visit.id,
        movement,
        timestamp: new Date()
      });
    }
  };

  const startVisit = async () => {
    if (!visit || !currentLocation) return;

    try {
      setLoading(true);

      // Validate location against customer address
      const customer = await offlineStorage.getCustomer(customerId);
      const distance = gpsService.calculateDistance(
        currentLocation.coords,
        { latitude: customer.latitude, longitude: customer.longitude }
      );

      if (distance > 100) { // 100 meter radius
        Alert.alert(
          'Location Warning',
          `You are ${Math.round(distance)}m away from customer location. Continue anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue', onPress: () => proceedWithVisitStart() }
          ]
        );
        return;
      }

      await proceedWithVisitStart();
    } catch (error) {
      console.error('Start visit error:', error);
      Alert.alert('Error', 'Failed to start visit');
    } finally {
      setLoading(false);
    }
  };

  const proceedWithVisitStart = async () => {
    if (!visit) return;

    const updatedVisit = {
      ...visit,
      status: 'IN_PROGRESS' as const,
      startTime: new Date(),
      location: currentLocation ? {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        accuracy: currentLocation.coords.accuracy || 0,
        timestamp: new Date()
      } : undefined
    };

    // Add arrival activity
    const arrivalActivity: VisitActivity = {
      id: `activity_${Date.now()}`,
      type: 'ARRIVAL',
      timestamp: new Date(),
      completed: true,
      required: true,
      data: { location: updatedVisit.location }
    };

    updatedVisit.activities = updatedVisit.activities.map(a => 
      a.type === 'ARRIVAL' ? arrivalActivity : a
    );

    setVisit(updatedVisit);
    await offlineStorage.saveVisit(updatedVisit);

    // Show success notification
    await notifications.showLocalNotification(
      'Visit Started',
      `Visit to ${visit.customerName} has begun`
    );
  };

  const takePhoto = async (photoType: VisitPhoto['type']) => {
    try {
      setCurrentPhotoType(photoType);
      setCameraVisible(true);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || !visit) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true
      });

      const visitPhoto: VisitPhoto = {
        id: `photo_${Date.now()}`,
        type: currentPhotoType,
        uri: photo.uri,
        timestamp: new Date(),
        location: currentLocation ? {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude
        } : { latitude: 0, longitude: 0 },
        quality: 'HIGH',
        uploaded: false
      };

      // AI analysis for product display photos
      if (currentPhotoType === 'PRODUCT_DISPLAY') {
        try {
          const analysis = await analyzePhotoWithAI(photo.uri);
          visitPhoto.aiAnalysis = analysis;
        } catch (error) {
          console.error('AI analysis error:', error);
        }
      }

      const updatedVisit = {
        ...visit,
        photos: [...visit.photos, visitPhoto]
      };

      // Update photo activity
      const photoActivity = updatedVisit.activities.find(a => a.type === 'PHOTO');
      if (photoActivity) {
        photoActivity.completed = true;
        photoActivity.timestamp = new Date();
      }

      setVisit(updatedVisit);
      await offlineStorage.saveVisit(updatedVisit);
      setCameraVisible(false);

      Alert.alert('Success', 'Photo captured successfully');
    } catch (error) {
      console.error('Capture photo error:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const analyzePhotoWithAI = async (photoUri: string): Promise<VisitPhoto['aiAnalysis']> => {
    // Mock AI analysis - in production would call actual AI service
    return {
      brandVisibility: Math.random() * 100,
      shelfShare: Math.random() * 100,
      qualityScore: 70 + Math.random() * 30,
      issues: Math.random() > 0.7 ? ['Low lighting detected'] : []
    };
  };

  const completeSurvey = async (surveyId: string, responses: QuestionResponse[]) => {
    if (!visit) return;

    try {
      const surveyResponse: SurveyResponse = {
        id: `survey_${Date.now()}`,
        surveyId,
        responses,
        completedAt: new Date(),
        duration: 300 // Mock duration
      };

      const updatedVisit = {
        ...visit,
        surveys: [...visit.surveys, surveyResponse]
      };

      // Update survey activity
      const surveyActivity = updatedVisit.activities.find(a => a.type === 'SURVEY');
      if (surveyActivity) {
        surveyActivity.completed = true;
        surveyActivity.timestamp = new Date();
      }

      setVisit(updatedVisit);
      await offlineStorage.saveVisit(updatedVisit);
      setSurveyModalVisible(false);

      Alert.alert('Success', 'Survey completed successfully');
    } catch (error) {
      console.error('Complete survey error:', error);
      Alert.alert('Error', 'Failed to complete survey');
    }
  };

  const processSale = async (saleData: Omit<SaleTransaction, 'id' | 'timestamp' | 'receiptPrinted'>) => {
    if (!visit) return;

    try {
      const sale: SaleTransaction = {
        ...saleData,
        id: `sale_${Date.now()}`,
        timestamp: new Date(),
        receiptPrinted: false
      };

      const updatedVisit = {
        ...visit,
        sales: [...visit.sales, sale]
      };

      // Update sale activity
      const saleActivity = updatedVisit.activities.find(a => a.type === 'SALE');
      if (saleActivity) {
        saleActivity.completed = true;
        saleActivity.timestamp = new Date();
      }

      setVisit(updatedVisit);
      await offlineStorage.saveVisit(updatedVisit);
      setSalesModalVisible(false);

      // Offer to print receipt
      Alert.alert(
        'Sale Completed',
        'Would you like to print a receipt?',
        [
          { text: 'Skip', style: 'cancel' },
          { text: 'Print', onPress: () => printReceipt(sale) }
        ]
      );
    } catch (error) {
      console.error('Process sale error:', error);
      Alert.alert('Error', 'Failed to process sale');
    }
  };

  const printReceipt = async (sale: SaleTransaction) => {
    try {
      const invoiceData = {
        invoiceNumber: `INV-${sale.id.substring(0, 8)}`,
        date: sale.timestamp,
        customer: {
          name: visit?.customerName || 'Customer',
          address: visit?.customerAddress
        },
        agent: {
          name: await AsyncStorage.getItem('userName') || 'Agent',
          id: await AsyncStorage.getItem('userId') || ''
        },
        items: sale.items,
        subtotal: sale.totalAmount,
        total: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        cashReceived: sale.cashReceived,
        change: sale.changeGiven
      };

      const result = await BluetoothPrinterService.printReceipt(invoiceData, {
        paperWidth: 58,
        fontSize: 'small',
        copies: 1,
        cutPaper: true
      });

      if (result.success) {
        // Update sale as printed
        if (visit) {
          const updatedVisit = {
            ...visit,
            sales: visit.sales.map(s => 
              s.id === sale.id ? { ...s, receiptPrinted: true } : s
            )
          };
          setVisit(updatedVisit);
          await offlineStorage.saveVisit(updatedVisit);
        }

        Alert.alert('Success', 'Receipt printed successfully');
      } else {
        Alert.alert('Print Error', result.error || 'Failed to print receipt');
      }
    } catch (error) {
      console.error('Print receipt error:', error);
      Alert.alert('Error', 'Failed to print receipt');
    }
  };

  const completeVisit = async () => {
    if (!visit) return;

    try {
      setLoading(true);

      // Check if all required activities are completed
      const incompleteRequired = visit.activities.filter(a => a.required && !a.completed);
      if (incompleteRequired.length > 0) {
        Alert.alert(
          'Incomplete Activities',
          `Please complete: ${incompleteRequired.map(a => a.type).join(', ')}`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Add departure activity
      const departureActivity: VisitActivity = {
        id: `activity_${Date.now()}`,
        type: 'DEPARTURE',
        timestamp: new Date(),
        completed: true,
        required: true,
        data: { location: currentLocation?.coords }
      };

      const updatedVisit = {
        ...visit,
        status: 'COMPLETED' as const,
        endTime: new Date(),
        activities: [...visit.activities, departureActivity]
      };

      setVisit(updatedVisit);
      await offlineStorage.saveVisit(updatedVisit);

      // Attempt to sync if online
      if (isOnline) {
        await syncVisitData();
      }

      Alert.alert(
        'Visit Completed',
        'Visit has been completed successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Complete visit error:', error);
      Alert.alert('Error', 'Failed to complete visit');
    } finally {
      setLoading(false);
    }
  };

  const syncVisitData = async () => {
    if (!visit || !isOnline) return;

    try {
      const updatedVisit = { ...visit, syncStatus: 'SYNCING' as const };
      setVisit(updatedVisit);

      await syncService.syncVisit(visit);

      const syncedVisit = { ...visit, syncStatus: 'SYNCED' as const };
      setVisit(syncedVisit);
      await offlineStorage.saveVisit(syncedVisit);

      await notifications.showLocalNotification(
        'Sync Complete',
        'Visit data synchronized successfully'
      );
    } catch (error) {
      console.error('Sync error:', error);
      const errorVisit = { ...visit, syncStatus: 'ERROR' as const };
      setVisit(errorVisit);
      await offlineStorage.saveVisit(errorVisit);
    }
  };

  const generateRequiredActivities = async (customer: any): Promise<VisitActivity[]> => {
    const activities: VisitActivity[] = [
      {
        id: 'arrival',
        type: 'ARRIVAL',
        timestamp: new Date(),
        completed: false,
        required: true
      },
      {
        id: 'photo',
        type: 'PHOTO',
        timestamp: new Date(),
        completed: false,
        required: true
      },
      {
        id: 'departure',
        type: 'DEPARTURE',
        timestamp: new Date(),
        completed: false,
        required: true
      }
    ];

    // Add customer-specific activities
    if (customer.type === 'KEY_ACCOUNT') {
      activities.push({
        id: 'survey',
        type: 'SURVEY',
        timestamp: new Date(),
        completed: false,
        required: true
      });
    }

    return activities;
  };

  const renderActivityStatus = () => {
    if (!visit) return null;

    return (
      <View style={styles.activitiesContainer}>
        <Text style={styles.sectionTitle}>Required Activities</Text>
        {visit.activities.map((activity) => (
          <View key={activity.id} style={styles.activityItem}>
            <View style={[
              styles.activityIndicator,
              { backgroundColor: activity.completed ? '#10B981' : '#FB923C' }
            ]} />
            <Text style={styles.activityText}>
              {activity.type.replace('_', ' ')}
            </Text>
            {activity.required && (
              <Text style={styles.requiredText}>Required</Text>
            )}
          </View>
        ))}
      </View>
    );
  };

  const renderLocationStatus = () => {
    if (!currentLocation) return null;

    return (
      <View style={styles.locationContainer}>
        <Text style={styles.sectionTitle}>Location Status</Text>
        <Text style={styles.locationText}>
          GPS: {gpsTracking ? 'Active' : 'Inactive'}
        </Text>
        <Text style={styles.locationText}>
          Accuracy: {Math.round(currentLocation.coords.accuracy || 0)}m
        </Text>
        <Text style={styles.locationText}>
          Network: {isOnline ? 'Online' : 'Offline'}
        </Text>
        {visit?.fraudRisk && visit.fraudRisk !== 'LOW' && (
          <Text style={[styles.locationText, { color: '#EF4444' }]}>
            Fraud Risk: {visit.fraudRisk}
          </Text>
        )}
      </View>
    );
  };

  const renderActionButtons = () => {
    if (!visit) return null;

    return (
      <View style={styles.actionsContainer}>
        {visit.status === 'PLANNED' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={startVisit}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Start Visit</Text>
          </TouchableOpacity>
        )}

        {visit.status === 'IN_PROGRESS' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.photoButton]}
              onPress={() => takePhoto('EXTERIOR')}
            >
              <Text style={styles.actionButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.surveyButton]}
              onPress={() => setSurveyModalVisible(true)}
            >
              <Text style={styles.actionButtonText}>Complete Survey</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.salesButton]}
              onPress={() => setSalesModalVisible(true)}
            >
              <Text style={styles.actionButtonText}>Process Sale</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={completeVisit}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>Complete Visit</Text>
            </TouchableOpacity>
          </>
        )}

        {visit.status === 'COMPLETED' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.syncButton]}
            onPress={syncVisitData}
            disabled={!isOnline || visit.syncStatus === 'SYNCING'}
          >
            <Text style={styles.actionButtonText}>
              {visit.syncStatus === 'SYNCING' ? 'Syncing...' : 'Sync Data'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text style={styles.loadingText}>Loading visit...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Visit: {visit?.customerName}</Text>
          <Text style={styles.subtitle}>
            Status: {visit?.status} | Sync: {visit?.syncStatus}
          </Text>
        </View>

        {/* Fraud Alerts */}
        {fraudAlerts.length > 0 && (
          <View style={styles.alertContainer}>
            <Text style={styles.alertTitle}>⚠️ Security Alerts</Text>
            {fraudAlerts.map((alert, index) => (
              <Text key={index} style={styles.alertText}>{alert}</Text>
            ))}
          </View>
        )}

        {/* Location Status */}
        {renderLocationStatus()}

        {/* Activity Status */}
        {renderActivityStatus()}

        {/* Photos */}
        {visit && visit.photos.length > 0 && (
          <View style={styles.photosContainer}>
            <Text style={styles.sectionTitle}>Photos ({visit.photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {visit.photos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                  <Text style={styles.photoType}>{photo.type}</Text>
                  {photo.aiAnalysis && (
                    <Text style={styles.photoAnalysis}>
                      Quality: {Math.round(photo.aiAnalysis.qualityScore)}%
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sales */}
        {visit && visit.sales.length > 0 && (
          <View style={styles.salesContainer}>
            <Text style={styles.sectionTitle}>Sales ({visit.sales.length})</Text>
            {visit.sales.map((sale) => (
              <View key={sale.id} style={styles.saleItem}>
                <Text style={styles.saleAmount}>R {sale.totalAmount.toFixed(2)}</Text>
                <Text style={styles.saleMethod}>{sale.paymentMethod}</Text>
                <Text style={styles.saleStatus}>
                  Receipt: {sale.receiptPrinted ? 'Printed' : 'Not Printed'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      {renderActionButtons()}

      {/* Camera Modal */}
      <Modal visible={cameraVisible} animationType="slide">
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            type={cameraType}
            ratio="16:9"
          >
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setCameraVisible(false)}
              >
                <Text style={styles.cameraButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.captureButton}
                onPress={capturePhoto}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraButton}
                onPress={() => setCameraType(
                  cameraType === CameraType.back ? CameraType.front : CameraType.back
                )}
              >
                <Text style={styles.cameraButtonText}>Flip</Text>
              </TouchableOpacity>
            </View>
          </Camera>
        </View>
      </Modal>

      {/* Survey Modal */}
      <Modal visible={surveyModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Complete Survey</Text>
          {/* Survey form would go here */}
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setSurveyModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Sales Modal */}
      <Modal visible={salesModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Process Sale</Text>
          {/* Sales form would go here */}
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => setSalesModalVisible(false)}
          >
            <Text style={styles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  alertContainer: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#991B1B',
  },
  locationContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  activitiesContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  activityIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  activityText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  requiredText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  photosContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  photoItem: {
    marginRight: 12,
    alignItems: 'center',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 4,
  },
  photoType: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  photoAnalysis: {
    fontSize: 10,
    color: '#10B981',
    textAlign: 'center',
  },
  salesContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  saleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  saleAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  saleMethod: {
    fontSize: 14,
    color: '#6B7280',
  },
  saleStatus: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionsContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  photoButton: {
    backgroundColor: '#3B82F6',
  },
  surveyButton: {
    backgroundColor: '#8B5CF6',
  },
  salesButton: {
    backgroundColor: '#F59E0B',
  },
  completeButton: {
    backgroundColor: '#EF4444',
  },
  syncButton: {
    backgroundColor: '#6B7280',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  cameraButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  cameraButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AdvancedVisitScreen;