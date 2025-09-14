import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Title,
  Paragraph,
  Card,
  Button,
  Chip,
  Avatar,
  IconButton,
  FAB,
  Surface,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { theme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { apiService } from '../../services/apiService';
import { offlineService } from '../../services/offlineService';
import { RootStackParamList } from '../../../App';

type VisitPlanNavigationProp = StackNavigationProp<RootStackParamList, 'VisitPlan'>;

interface Visit {
  id: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  scheduledTime: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  visitType: 'SALES_CALL' | 'FOLLOW_UP' | 'DELIVERY' | 'COLLECTION';
  location: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
  estimatedDuration: number;
}

const VisitPlanScreen: React.FC = () => {
  const navigation = useNavigation<VisitPlanNavigationProp>();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadVisits();
    getCurrentLocation();
  }, [selectedDate]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for visit planning');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadVisits = async () => {
    try {
      setLoading(true);
      
      if (isOnline) {
        const response = await apiService.get(`/field-sales/visits/plan?date=${selectedDate}&agentId=${user?.id}`);
        if (response.data.success) {
          setVisits(response.data.data);
        }
      } else {
        // Load from offline storage
        const offlineVisits = await offlineService.getOfflineVisits();
        const todayVisits = offlineVisits.filter(visit => 
          visit.scheduledTime.startsWith(selectedDate)
        );
        setVisits(todayVisits);
      }
    } catch (error) {
      console.error('Error loading visits:', error);
      // Load demo data for development
      setVisits(getDemoVisits());
    } finally {
      setLoading(false);
    }
  };

  const getDemoVisits = (): Visit[] => [
    {
      id: '1',
      customerId: 'cust_001',
      customerName: 'Shoprite Centurion',
      customerAddress: '123 Main Street, Centurion, Gauteng',
      customerPhone: '+27 12 345 6789',
      scheduledTime: `${selectedDate}T09:00:00Z`,
      status: 'SCHEDULED',
      priority: 'HIGH',
      visitType: 'SALES_CALL',
      location: { latitude: -25.8627, longitude: 28.1871 },
      notes: 'New product presentation and stock check',
      estimatedDuration: 60,
    },
    {
      id: '2',
      customerId: 'cust_002',
      customerName: 'Pick n Pay Midrand',
      customerAddress: '456 Oak Avenue, Midrand, Gauteng',
      customerPhone: '+27 11 987 6543',
      scheduledTime: `${selectedDate}T11:30:00Z`,
      status: 'SCHEDULED',
      priority: 'MEDIUM',
      visitType: 'FOLLOW_UP',
      location: { latitude: -25.9892, longitude: 28.1279 },
      notes: 'Follow up on last month\'s order',
      estimatedDuration: 45,
    },
    {
      id: '3',
      customerId: 'cust_003',
      customerName: 'Checkers Sandton',
      customerAddress: '789 Pine Road, Sandton, Gauteng',
      customerPhone: '+27 11 234 5678',
      scheduledTime: `${selectedDate}T14:00:00Z`,
      status: 'SCHEDULED',
      priority: 'HIGH',
      visitType: 'DELIVERY',
      location: { latitude: -26.1076, longitude: 28.0567 },
      notes: 'Deliver promotional materials',
      estimatedDuration: 30,
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVisits();
    setRefreshing(false);
  };

  const startVisit = async (visit: Visit) => {
    try {
      const updatedVisit = {
        ...visit,
        status: 'IN_PROGRESS' as const,
        actualStartTime: new Date().toISOString(),
      };

      if (isOnline) {
        await apiService.patch(`/field-sales/visits/${visit.id}`, {
          status: 'IN_PROGRESS',
          actualStartTime: updatedVisit.actualStartTime,
        });
      } else {
        await offlineService.saveOfflineVisit(updatedVisit);
        await offlineService.addPendingSync('visit', updatedVisit);
      }

      // Navigate to visit execution
      navigation.navigate('VisitExecution', { visitId: visit.id, visit: updatedVisit });
    } catch (error) {
      console.error('Error starting visit:', error);
      Alert.alert('Error', 'Failed to start visit. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return theme.colors.info;
      case 'IN_PROGRESS': return theme.colors.warning;
      case 'COMPLETED': return theme.colors.success;
      case 'CANCELLED': return theme.colors.error;
      default: return theme.colors.placeholder;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return theme.colors.error;
      case 'MEDIUM': return theme.colors.warning;
      case 'LOW': return theme.colors.success;
      default: return theme.colors.placeholder;
    }
  };

  const getVisitTypeIcon = (type: string) => {
    switch (type) {
      case 'SALES_CALL': return 'account-tie';
      case 'FOLLOW_UP': return 'phone-return';
      case 'DELIVERY': return 'truck-delivery';
      case 'COLLECTION': return 'cash-multiple';
      default: return 'briefcase';
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-ZA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateRoute = () => {
    if (!currentLocation || visits.length === 0) return [];
    
    const points = [
      {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      },
      ...visits.map(visit => visit.location),
    ];
    
    return points;
  };

  const renderVisitCard = (visit: Visit) => (
    <Card key={visit.id} style={styles.visitCard}>
      <Card.Content>
        <View style={styles.visitHeader}>
          <View style={styles.visitInfo}>
            <Title style={styles.customerName}>{visit.customerName}</Title>
            <View style={styles.visitMeta}>
              <Chip
                icon={getVisitTypeIcon(visit.visitType)}
                style={[styles.chip, { backgroundColor: theme.colors.surface }]}
                textStyle={{ fontSize: 12 }}
              >
                {visit.visitType.replace('_', ' ')}
              </Chip>
              <Chip
                style={[styles.chip, { backgroundColor: getPriorityColor(visit.priority) }]}
                textStyle={{ color: '#FFFFFF', fontSize: 12 }}
              >
                {visit.priority}
              </Chip>
            </View>
          </View>
          <Avatar.Icon
            size={40}
            icon={getVisitTypeIcon(visit.visitType)}
            style={{ backgroundColor: getStatusColor(visit.status) }}
          />
        </View>

        <View style={styles.visitDetails}>
          <View style={styles.detailRow}>
            <IconButton icon="clock-outline" size={16} style={styles.detailIcon} />
            <Paragraph style={styles.detailText}>
              {formatTime(visit.scheduledTime)} ({visit.estimatedDuration} min)
            </Paragraph>
          </View>
          
          <View style={styles.detailRow}>
            <IconButton icon="map-marker" size={16} style={styles.detailIcon} />
            <Paragraph style={styles.detailText} numberOfLines={2}>
              {visit.customerAddress}
            </Paragraph>
          </View>

          <View style={styles.detailRow}>
            <IconButton icon="phone" size={16} style={styles.detailIcon} />
            <Paragraph style={styles.detailText}>{visit.customerPhone}</Paragraph>
          </View>

          {visit.notes && (
            <View style={styles.detailRow}>
              <IconButton icon="note-text" size={16} style={styles.detailIcon} />
              <Paragraph style={styles.detailText} numberOfLines={2}>
                {visit.notes}
              </Paragraph>
            </View>
          )}
        </View>

        <Divider style={styles.divider} />

        <View style={styles.visitActions}>
          <Chip
            icon="flag"
            style={[styles.statusChip, { backgroundColor: getStatusColor(visit.status) }]}
            textStyle={{ color: '#FFFFFF' }}
          >
            {visit.status.replace('_', ' ')}
          </Chip>
          
          {visit.status === 'SCHEDULED' && (
            <Button
              mode="contained"
              onPress={() => startVisit(visit)}
              style={styles.startButton}
              compact
            >
              Start Visit
            </Button>
          )}
          
          {visit.status === 'IN_PROGRESS' && (
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('VisitExecution', { visitId: visit.id, visit })}
              style={styles.continueButton}
              compact
            >
              Continue
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const renderMapView = () => (
    <View style={styles.mapContainer}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.coords.latitude || -25.8627,
          longitude: currentLocation?.coords.longitude || 28.1871,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {visits.map((visit) => (
          <Marker
            key={visit.id}
            coordinate={visit.location}
            title={visit.customerName}
            description={`${formatTime(visit.scheduledTime)} - ${visit.visitType}`}
            pinColor={getStatusColor(visit.status)}
          />
        ))}
        
        {calculateRoute().length > 1 && (
          <Polyline
            coordinates={calculateRoute()}
            strokeColor={theme.colors.primary}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>
    </View>
  );

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <Title style={styles.headerTitle}>Visit Plan</Title>
          <View style={styles.headerActions}>
            <IconButton
              icon={showMap ? 'format-list-bulleted' : 'map'}
              onPress={() => setShowMap(!showMap)}
              iconColor={theme.colors.primary}
            />
            <IconButton
              icon="calendar"
              onPress={() => {
                // Date picker would be implemented here
                Alert.alert('Date Selection', 'Date picker coming soon');
              }}
              iconColor={theme.colors.primary}
            />
          </View>
        </View>
        
        <View style={styles.summaryRow}>
          <Chip icon="calendar-today" style={styles.dateChip}>
            {new Date(selectedDate).toLocaleDateString('en-ZA')}
          </Chip>
          <Chip icon="map-marker-multiple" style={styles.countChip}>
            {visits.length} visits
          </Chip>
        </View>
      </Surface>

      {showMap ? (
        renderMapView()
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {visits.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Avatar.Icon
                  size={64}
                  icon="calendar-blank"
                  style={styles.emptyIcon}
                />
                <Title style={styles.emptyTitle}>No visits scheduled</Title>
                <Paragraph style={styles.emptyText}>
                  You have no visits planned for {new Date(selectedDate).toLocaleDateString('en-ZA')}
                </Paragraph>
              </Card.Content>
            </Card>
          ) : (
            visits.map(renderVisitCard)
          )}
        </ScrollView>
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          Alert.alert('Add Visit', 'Visit scheduling coming soon');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    elevation: theme.elevation.small,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  headerActions: {
    flexDirection: 'row',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateChip: {
    backgroundColor: theme.colors.primary,
  },
  countChip: {
    backgroundColor: theme.colors.accent,
  },
  scrollView: {
    flex: 1,
    padding: theme.spacing.md,
  },
  visitCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  visitInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  visitMeta: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  chip: {
    marginRight: theme.spacing.xs,
  },
  visitDetails: {
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  detailIcon: {
    margin: 0,
    marginRight: theme.spacing.xs,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  divider: {
    marginVertical: theme.spacing.sm,
  },
  visitActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  startButton: {
    backgroundColor: theme.colors.success,
  },
  continueButton: {
    borderColor: theme.colors.warning,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  emptyCard: {
    marginTop: theme.spacing.xl,
    elevation: theme.elevation.small,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyIcon: {
    backgroundColor: theme.colors.placeholder,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.placeholder,
  },
  fab: {
    position: 'absolute',
    margin: theme.spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
});

export default VisitPlanScreen;