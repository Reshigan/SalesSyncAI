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
  Surface,
  Divider,
  SearchBar,
  FAB,
  ProgressBar,
  Badge,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { apiService } from '../../services/apiService';
import { RootStackParamList } from '../../../App';

type ActivationListNavigationProp = StackNavigationProp<RootStackParamList, 'ActivationList'>;

interface Activation {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  type: 'IN_STORE' | 'OUTDOOR' | 'EVENT' | 'DIGITAL' | 'SAMPLING';
  location: {
    name: string;
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  budget: number;
  targetAudience: string;
  objectives: string[];
  kpis: {
    targetFootfall: number;
    actualFootfall: number;
    targetEngagement: number;
    actualEngagement: number;
    targetConversions: number;
    actualConversions: number;
    targetSales: number;
    actualSales: number;
  };
  materials: {
    id: string;
    name: string;
    type: string;
    quantity: number;
    used: number;
  }[];
  team: {
    id: string;
    name: string;
    role: string;
  }[];
  checklist: {
    id: string;
    task: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: string;
  }[];
  createdBy: string;
  createdAt: string;
}

const ActivationListScreen: React.FC = () => {
  const navigation = useNavigation<ActivationListNavigationProp>();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    loadActivations();
  }, []);

  const loadActivations = async () => {
    try {
      setLoading(true);
      
      if (isOnline) {
        const response = await apiService.get(`/promotions/activations?agentId=${user?.id}`);
        if (response.data.success) {
          setActivations(response.data.data);
        }
      } else {
        // Load demo data for offline mode
        setActivations(getDemoActivations());
      }
    } catch (error) {
      console.error('Error loading activations:', error);
      setActivations(getDemoActivations());
    } finally {
      setLoading(false);
    }
  };

  const getDemoActivations = (): Activation[] => [
    {
      id: '1',
      name: 'Summer Festival Activation',
      description: 'Brand activation at summer music festival with product sampling and interactive experiences',
      startDate: '2024-12-20T08:00:00Z',
      endDate: '2024-12-22T20:00:00Z',
      status: 'SCHEDULED',
      type: 'EVENT',
      location: {
        name: 'Johannesburg Summer Festival',
        address: 'Mary Fitzgerald Square, Newtown, Johannesburg',
        coordinates: { latitude: -26.2041, longitude: 28.0473 },
      },
      budget: 150000,
      targetAudience: 'Young adults 18-35, music lovers, festival goers',
      objectives: [
        'Increase brand awareness among target demographic',
        'Generate 2000 product samples',
        'Collect 500 email leads',
        'Drive social media engagement',
        'Create memorable brand experience'
      ],
      kpis: {
        targetFootfall: 5000,
        actualFootfall: 0,
        targetEngagement: 2000,
        actualEngagement: 0,
        targetConversions: 500,
        actualConversions: 0,
        targetSales: 100000,
        actualSales: 0,
      },
      materials: [
        { id: '1', name: 'Product Samples', type: 'SAMPLE', quantity: 2000, used: 0 },
        { id: '2', name: 'Branded T-Shirts', type: 'MERCHANDISE', quantity: 500, used: 0 },
        { id: '3', name: 'Banner Displays', type: 'DISPLAY', quantity: 10, used: 0 },
        { id: '4', name: 'Promotional Flyers', type: 'COLLATERAL', quantity: 1000, used: 0 },
      ],
      team: [
        { id: '1', name: 'Sarah Johnson', role: 'Activation Manager' },
        { id: '2', name: 'Mike Chen', role: 'Brand Ambassador' },
        { id: '3', name: 'Lisa Williams', role: 'Brand Ambassador' },
      ],
      checklist: [
        { id: '1', task: 'Setup booth and displays', completed: false },
        { id: '2', task: 'Inventory materials', completed: false },
        { id: '3', task: 'Brief team on objectives', completed: false },
        { id: '4', task: 'Test equipment and technology', completed: false },
        { id: '5', task: 'Coordinate with event organizers', completed: false },
      ],
      createdBy: 'marketing_manager',
      createdAt: '2024-12-01T10:00:00Z',
    },
    {
      id: '2',
      name: 'Mall Sampling Campaign',
      description: 'In-store product sampling and demonstration at major shopping centers',
      startDate: '2024-12-15T09:00:00Z',
      endDate: '2024-12-17T18:00:00Z',
      status: 'ACTIVE',
      type: 'IN_STORE',
      location: {
        name: 'Sandton City Shopping Centre',
        address: '83 Rivonia Rd, Sandhurst, Sandton',
        coordinates: { latitude: -26.1076, longitude: 28.0567 },
      },
      budget: 75000,
      targetAudience: 'Shoppers, families, working professionals',
      objectives: [
        'Drive product trial and awareness',
        'Generate immediate sales',
        'Collect customer feedback',
        'Build brand loyalty'
      ],
      kpis: {
        targetFootfall: 3000,
        actualFootfall: 1800,
        targetEngagement: 1500,
        actualEngagement: 950,
        targetConversions: 300,
        actualConversions: 180,
        targetSales: 50000,
        actualSales: 32000,
      },
      materials: [
        { id: '5', name: 'Product Samples', type: 'SAMPLE', quantity: 1500, used: 950 },
        { id: '6', name: 'Sampling Cups', type: 'SUPPLIES', quantity: 2000, used: 1200 },
        { id: '7', name: 'Promotional Banners', type: 'DISPLAY', quantity: 5, used: 5 },
        { id: '8', name: 'Discount Vouchers', type: 'COLLATERAL', quantity: 500, used: 300 },
      ],
      team: [
        { id: '4', name: 'John Smith', role: 'Sampling Coordinator' },
        { id: '5', name: 'Emma Davis', role: 'Brand Ambassador' },
      ],
      checklist: [
        { id: '6', task: 'Setup sampling station', completed: true, completedBy: 'John Smith', completedAt: '2024-12-15T08:30:00Z' },
        { id: '7', task: 'Prepare product samples', completed: true, completedBy: 'Emma Davis', completedAt: '2024-12-15T08:45:00Z' },
        { id: '8', task: 'Display promotional materials', completed: true, completedBy: 'John Smith', completedAt: '2024-12-15T09:00:00Z' },
        { id: '9', task: 'Engage with customers', completed: false },
        { id: '10', task: 'Collect feedback forms', completed: false },
      ],
      createdBy: 'marketing_manager',
      createdAt: '2024-12-10T14:00:00Z',
    },
    {
      id: '3',
      name: 'Corporate Event Activation',
      description: 'Brand presence at corporate wellness event with health-focused product demonstrations',
      startDate: '2024-11-25T07:00:00Z',
      endDate: '2024-11-25T17:00:00Z',
      status: 'COMPLETED',
      type: 'EVENT',
      location: {
        name: 'Sandton Convention Centre',
        address: '161 Maude St, Sandhurst, Sandton',
        coordinates: { latitude: -26.1065, longitude: 28.0532 },
      },
      budget: 100000,
      targetAudience: 'Corporate professionals, health-conscious individuals',
      objectives: [
        'Position brand as health-focused',
        'Generate B2B leads',
        'Demonstrate product benefits',
        'Network with corporate decision makers'
      ],
      kpis: {
        targetFootfall: 2000,
        actualFootfall: 2200,
        targetEngagement: 800,
        actualEngagement: 920,
        targetConversions: 200,
        actualConversions: 240,
        targetSales: 75000,
        actualSales: 85000,
      },
      materials: [
        { id: '9', name: 'Product Samples', type: 'SAMPLE', quantity: 1000, used: 920 },
        { id: '10', name: 'Information Brochures', type: 'COLLATERAL', quantity: 800, used: 750 },
        { id: '11', name: 'Demo Equipment', type: 'EQUIPMENT', quantity: 3, used: 3 },
        { id: '12', name: 'Business Cards', type: 'COLLATERAL', quantity: 500, used: 320 },
      ],
      team: [
        { id: '6', name: 'David Wilson', role: 'Event Coordinator' },
        { id: '7', name: 'Rachel Green', role: 'Product Specialist' },
        { id: '8', name: 'Tom Brown', role: 'Brand Ambassador' },
      ],
      checklist: [
        { id: '11', task: 'Setup exhibition booth', completed: true, completedBy: 'David Wilson', completedAt: '2024-11-25T06:30:00Z' },
        { id: '12', task: 'Prepare demonstration area', completed: true, completedBy: 'Rachel Green', completedAt: '2024-11-25T07:00:00Z' },
        { id: '13', task: 'Conduct product demos', completed: true, completedBy: 'Rachel Green', completedAt: '2024-11-25T17:00:00Z' },
        { id: '14', task: 'Collect lead information', completed: true, completedBy: 'Tom Brown', completedAt: '2024-11-25T17:00:00Z' },
        { id: '15', task: 'Pack up materials', completed: true, completedBy: 'David Wilson', completedAt: '2024-11-25T18:00:00Z' },
      ],
      createdBy: 'marketing_manager',
      createdAt: '2024-11-15T11:00:00Z',
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivations();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return theme.colors.info;
      case 'ACTIVE': return theme.colors.success;
      case 'PAUSED': return theme.colors.warning;
      case 'COMPLETED': return theme.colors.primary;
      case 'CANCELLED': return theme.colors.error;
      default: return theme.colors.placeholder;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'IN_STORE': return 'store';
      case 'OUTDOOR': return 'nature';
      case 'EVENT': return 'calendar-star';
      case 'DIGITAL': return 'monitor';
      case 'SAMPLING': return 'gift';
      default: return 'briefcase-outline';
    }
  };

  const calculateProgress = (kpis: Activation['kpis']) => {
    const totalTarget = kpis.targetFootfall + kpis.targetEngagement + kpis.targetConversions;
    const totalActual = kpis.actualFootfall + kpis.actualEngagement + kpis.actualConversions;
    return totalTarget > 0 ? totalActual / totalTarget : 0;
  };

  const getChecklistProgress = (checklist: Activation['checklist']) => {
    const completed = checklist.filter(item => item.completed).length;
    return checklist.length > 0 ? completed / checklist.length : 0;
  };

  const filteredActivations = activations.filter(activation => {
    const matchesSearch = activation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         activation.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || activation.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderActivationCard = (activation: Activation) => {
    const progress = calculateProgress(activation.kpis);
    const checklistProgress = getChecklistProgress(activation.checklist);
    const isActive = activation.status === 'ACTIVE';
    const daysUntilStart = Math.ceil(
      (new Date(activation.startDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    return (
      <TouchableOpacity
        key={activation.id}
        onPress={() => navigation.navigate('ActivationExecution', { activationId: activation.id, activation })}
      >
        <Card style={styles.activationCard}>
          <Card.Content>
            <View style={styles.activationHeader}>
              <View style={styles.activationInfo}>
                <Title style={styles.activationName}>{activation.name}</Title>
                <View style={styles.activationMeta}>
                  <Chip
                    icon={getTypeIcon(activation.type)}
                    style={[styles.typeChip, { backgroundColor: theme.colors.surface }]}
                    textStyle={{ fontSize: 12 }}
                  >
                    {activation.type.replace('_', ' ')}
                  </Chip>
                  <Chip
                    style={[styles.statusChip, { backgroundColor: getStatusColor(activation.status) }]}
                    textStyle={{ color: '#FFFFFF', fontSize: 12 }}
                  >
                    {activation.status}
                  </Chip>
                </View>
              </View>
              <Avatar.Icon
                size={40}
                icon={getTypeIcon(activation.type)}
                style={{ backgroundColor: getStatusColor(activation.status) }}
              />
            </View>

            <Paragraph style={styles.activationDescription} numberOfLines={2}>
              {activation.description}
            </Paragraph>

            <View style={styles.activationDetails}>
              <View style={styles.detailRow}>
                <IconButton icon="calendar-range" size={16} style={styles.detailIcon} />
                <Paragraph style={styles.detailText}>
                  {new Date(activation.startDate).toLocaleDateString('en-ZA')} - {new Date(activation.endDate).toLocaleDateString('en-ZA')}
                </Paragraph>
              </View>

              <View style={styles.detailRow}>
                <IconButton icon="map-marker" size={16} style={styles.detailIcon} />
                <Paragraph style={styles.detailText} numberOfLines={1}>
                  {activation.location.name}
                </Paragraph>
              </View>

              <View style={styles.detailRow}>
                <IconButton icon="currency-usd" size={16} style={styles.detailIcon} />
                <Paragraph style={styles.detailText}>
                  Budget: R{activation.budget.toLocaleString()}
                </Paragraph>
              </View>

              <View style={styles.detailRow}>
                <IconButton icon="account-group" size={16} style={styles.detailIcon} />
                <Paragraph style={styles.detailText}>
                  Team: {activation.team.length} member{activation.team.length !== 1 ? 's' : ''}
                </Paragraph>
              </View>

              {activation.status === 'SCHEDULED' && daysUntilStart > 0 && (
                <View style={styles.detailRow}>
                  <IconButton icon="clock-outline" size={16} style={styles.detailIcon} />
                  <Paragraph style={styles.detailText}>
                    Starts in {daysUntilStart} day{daysUntilStart !== 1 ? 's' : ''}
                  </Paragraph>
                </View>
              )}
            </View>

            <Divider style={styles.divider} />

            {/* KPI Progress */}
            {(isActive || activation.status === 'COMPLETED') && (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Paragraph style={styles.progressLabel}>Performance Progress</Paragraph>
                  <Paragraph style={styles.progressPercentage}>
                    {Math.round(progress * 100)}%
                  </Paragraph>
                </View>
                <ProgressBar
                  progress={progress}
                  color={progress >= 0.8 ? theme.colors.success : progress >= 0.5 ? theme.colors.warning : theme.colors.error}
                  style={styles.progressBar}
                />
              </View>
            )}

            {/* Checklist Progress */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Paragraph style={styles.progressLabel}>Checklist Progress</Paragraph>
                <Paragraph style={styles.progressPercentage}>
                  {Math.round(checklistProgress * 100)}%
                </Paragraph>
              </View>
              <ProgressBar
                progress={checklistProgress}
                color={checklistProgress === 1 ? theme.colors.success : theme.colors.primary}
                style={styles.progressBar}
              />
            </View>

            {/* KPI Stats */}
            {(isActive || activation.status === 'COMPLETED') && (
              <View style={styles.kpiRow}>
                <View style={styles.kpiItem}>
                  <Title style={styles.kpiNumber}>{activation.kpis.actualFootfall}</Title>
                  <Paragraph style={styles.kpiLabel}>Footfall</Paragraph>
                  <Paragraph style={styles.kpiTarget}>/{activation.kpis.targetFootfall}</Paragraph>
                </View>
                <View style={styles.kpiItem}>
                  <Title style={styles.kpiNumber}>{activation.kpis.actualEngagement}</Title>
                  <Paragraph style={styles.kpiLabel}>Engagement</Paragraph>
                  <Paragraph style={styles.kpiTarget}>/{activation.kpis.targetEngagement}</Paragraph>
                </View>
                <View style={styles.kpiItem}>
                  <Title style={styles.kpiNumber}>{activation.kpis.actualConversions}</Title>
                  <Paragraph style={styles.kpiLabel}>Conversions</Paragraph>
                  <Paragraph style={styles.kpiTarget}>/{activation.kpis.targetConversions}</Paragraph>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {activation.status === 'SCHEDULED' && (
                <Button
                  mode="outlined"
                  onPress={() => navigation.navigate('ActivationExecution', { activationId: activation.id, activation })}
                  style={styles.actionButton}
                  icon="eye"
                  compact
                >
                  View Details
                </Button>
              )}
              
              {activation.status === 'ACTIVE' && (
                <Button
                  mode="contained"
                  onPress={() => navigation.navigate('ActivationExecution', { activationId: activation.id, activation })}
                  style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
                  icon="play"
                  compact
                >
                  Execute
                </Button>
              )}

              {activation.status === 'COMPLETED' && (
                <Button
                  mode="outlined"
                  onPress={() => navigation.navigate('ActivationExecution', { activationId: activation.id, activation })}
                  style={styles.actionButton}
                  icon="chart-line"
                  compact
                >
                  View Results
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <Title style={styles.headerTitle}>Activations</Title>
        
        <SearchBar
          placeholder="Search activations..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['ALL', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'PAUSED'].map((status) => (
            <Chip
              key={status}
              selected={filterStatus === status}
              onPress={() => setFilterStatus(status)}
              style={[
                styles.filterChip,
                filterStatus === status && { backgroundColor: theme.colors.primary }
              ]}
              textStyle={filterStatus === status ? { color: '#FFFFFF' } : {}}
            >
              {status}
            </Chip>
          ))}
        </ScrollView>
      </Surface>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredActivations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Avatar.Icon
                size={64}
                icon="calendar-star-outline"
                style={styles.emptyIcon}
              />
              <Title style={styles.emptyTitle}>No activations found</Title>
              <Paragraph style={styles.emptyText}>
                {searchQuery || filterStatus !== 'ALL'
                  ? 'No activations match your search criteria'
                  : 'You have no activations assigned'}
              </Paragraph>
            </Card.Content>
          </Card>
        ) : (
          filteredActivations.map(renderActivationCard)
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          Alert.alert('Create Activation', 'Activation creation coming soon');
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  searchBar: {
    marginBottom: theme.spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  filterChip: {
    marginRight: theme.spacing.sm,
  },
  scrollView: {
    flex: 1,
    padding: theme.spacing.md,
  },
  activationCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  activationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  activationInfo: {
    flex: 1,
  },
  activationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  activationMeta: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  typeChip: {
    marginRight: theme.spacing.xs,
  },
  statusChip: {
    marginRight: theme.spacing.xs,
  },
  activationDescription: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  activationDetails: {
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
  progressSection: {
    marginBottom: theme.spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  progressLabel: {
    fontSize: 14,
    color: theme.colors.text,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  kpiItem: {
    alignItems: 'center',
  },
  kpiNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  kpiLabel: {
    fontSize: 12,
    color: theme.colors.text,
  },
  kpiTarget: {
    fontSize: 10,
    color: theme.colors.placeholder,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
  },
  actionButton: {
    marginLeft: theme.spacing.sm,
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

export default ActivationListScreen;