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
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { apiService } from '../../services/apiService';
import { RootStackParamList } from '../../../App';

type CampaignListNavigationProp = StackNavigationProp<RootStackParamList, 'CampaignList'>;

interface Campaign {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  type: 'BRAND_AWARENESS' | 'PRODUCT_LAUNCH' | 'SEASONAL' | 'PROMOTIONAL' | 'SAMPLING';
  targetAudience: string;
  budget: number;
  locations: string[];
  objectives: string[];
  kpis: {
    targetInteractions: number;
    actualInteractions: number;
    targetSamples: number;
    actualSamples: number;
    targetSurveys: number;
    actualSurveys: number;
  };
  materials: {
    id: string;
    name: string;
    type: 'BROCHURE' | 'SAMPLE' | 'BANNER' | 'FLYER' | 'MERCHANDISE';
    quantity: number;
    distributed: number;
  }[];
  assignedAgents: string[];
  createdBy: string;
  createdAt: string;
}

const CampaignListScreen: React.FC = () => {
  const navigation = useNavigation<CampaignListNavigationProp>();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      
      if (isOnline) {
        const response = await apiService.get(`/field-marketing/campaigns?agentId=${user?.id}`);
        if (response.data.success) {
          setCampaigns(response.data.data);
        }
      } else {
        // Load demo data for offline mode
        setCampaigns(getDemoCampaigns());
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns(getDemoCampaigns());
    } finally {
      setLoading(false);
    }
  };

  const getDemoCampaigns = (): Campaign[] => [
    {
      id: '1',
      name: 'Summer Product Launch',
      description: 'Launch campaign for new summer beverage line with sampling and brand awareness activities',
      startDate: '2024-12-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z',
      status: 'ACTIVE',
      type: 'PRODUCT_LAUNCH',
      targetAudience: 'Young adults 18-35, health-conscious consumers',
      budget: 50000,
      locations: ['Sandton City', 'Menlyn Park', 'Gateway Theatre'],
      objectives: [
        'Increase brand awareness by 25%',
        'Generate 1000 product samples',
        'Collect 500 consumer surveys',
        'Drive 200 social media engagements'
      ],
      kpis: {
        targetInteractions: 1000,
        actualInteractions: 650,
        targetSamples: 500,
        actualSamples: 320,
        targetSurveys: 300,
        actualSurveys: 180,
      },
      materials: [
        { id: '1', name: 'Product Samples', type: 'SAMPLE', quantity: 1000, distributed: 320 },
        { id: '2', name: 'Brand Brochures', type: 'BROCHURE', quantity: 500, distributed: 200 },
        { id: '3', name: 'Promotional Banners', type: 'BANNER', quantity: 10, distributed: 6 },
      ],
      assignedAgents: [user?.id || ''],
      createdBy: 'marketing_manager',
      createdAt: '2024-11-15T10:00:00Z',
    },
    {
      id: '2',
      name: 'Holiday Season Promotion',
      description: 'Seasonal promotional campaign with special offers and gift sampling',
      startDate: '2024-12-15T00:00:00Z',
      endDate: '2025-01-15T23:59:59Z',
      status: 'ACTIVE',
      type: 'SEASONAL',
      targetAudience: 'Families, gift shoppers, holiday celebrants',
      budget: 75000,
      locations: ['Mall of Africa', 'Eastgate Shopping Centre', 'Cresta Shopping Centre'],
      objectives: [
        'Boost holiday sales by 30%',
        'Distribute 2000 promotional items',
        'Engage 1500 potential customers',
        'Generate 100 leads'
      ],
      kpis: {
        targetInteractions: 1500,
        actualInteractions: 890,
        targetSamples: 2000,
        actualSamples: 1200,
        targetSurveys: 500,
        actualSurveys: 280,
      },
      materials: [
        { id: '4', name: 'Holiday Gift Samples', type: 'SAMPLE', quantity: 2000, distributed: 1200 },
        { id: '5', name: 'Promotional Flyers', type: 'FLYER', quantity: 1000, distributed: 600 },
        { id: '6', name: 'Branded Merchandise', type: 'MERCHANDISE', quantity: 500, distributed: 300 },
      ],
      assignedAgents: [user?.id || ''],
      createdBy: 'marketing_manager',
      createdAt: '2024-11-20T14:30:00Z',
    },
    {
      id: '3',
      name: 'Brand Awareness Drive',
      description: 'General brand awareness campaign focusing on street marketing and consumer education',
      startDate: '2024-11-01T00:00:00Z',
      endDate: '2024-11-30T23:59:59Z',
      status: 'COMPLETED',
      type: 'BRAND_AWARENESS',
      targetAudience: 'General public, all demographics',
      budget: 30000,
      locations: ['Johannesburg CBD', 'Pretoria CBD', 'Durban Beachfront'],
      objectives: [
        'Increase brand recognition',
        'Educate consumers about products',
        'Build brand loyalty',
        'Collect market feedback'
      ],
      kpis: {
        targetInteractions: 800,
        actualInteractions: 950,
        targetSamples: 400,
        actualSamples: 480,
        targetSurveys: 200,
        actualSurveys: 220,
      },
      materials: [
        { id: '7', name: 'Educational Brochures', type: 'BROCHURE', quantity: 800, distributed: 800 },
        { id: '8', name: 'Product Samples', type: 'SAMPLE', quantity: 400, distributed: 480 },
      ],
      assignedAgents: [user?.id || ''],
      createdBy: 'marketing_manager',
      createdAt: '2024-10-15T09:00:00Z',
    },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCampaigns();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return theme.colors.placeholder;
      case 'ACTIVE': return theme.colors.success;
      case 'PAUSED': return theme.colors.warning;
      case 'COMPLETED': return theme.colors.info;
      case 'CANCELLED': return theme.colors.error;
      default: return theme.colors.placeholder;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'BRAND_AWARENESS': return 'bullhorn';
      case 'PRODUCT_LAUNCH': return 'rocket-launch';
      case 'SEASONAL': return 'calendar-star';
      case 'PROMOTIONAL': return 'tag-multiple';
      case 'SAMPLING': return 'gift';
      default: return 'briefcase-outline';
    }
  };

  const calculateProgress = (kpis: Campaign['kpis']) => {
    const totalTarget = kpis.targetInteractions + kpis.targetSamples + kpis.targetSurveys;
    const totalActual = kpis.actualInteractions + kpis.actualSamples + kpis.actualSurveys;
    return totalTarget > 0 ? totalActual / totalTarget : 0;
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'ALL' || campaign.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const renderCampaignCard = (campaign: Campaign) => {
    const progress = calculateProgress(campaign.kpis);
    const isActive = campaign.status === 'ACTIVE';
    const daysRemaining = isActive ? Math.ceil(
      (new Date(campaign.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    ) : 0;

    return (
      <TouchableOpacity
        key={campaign.id}
        onPress={() => navigation.navigate('CampaignExecution', { campaignId: campaign.id, campaign })}
      >
        <Card style={styles.campaignCard}>
          <Card.Content>
            <View style={styles.campaignHeader}>
              <View style={styles.campaignInfo}>
                <Title style={styles.campaignName}>{campaign.name}</Title>
                <View style={styles.campaignMeta}>
                  <Chip
                    icon={getTypeIcon(campaign.type)}
                    style={[styles.typeChip, { backgroundColor: theme.colors.surface }]}
                    textStyle={{ fontSize: 12 }}
                  >
                    {campaign.type.replace('_', ' ')}
                  </Chip>
                  <Chip
                    style={[styles.statusChip, { backgroundColor: getStatusColor(campaign.status) }]}
                    textStyle={{ color: '#FFFFFF', fontSize: 12 }}
                  >
                    {campaign.status}
                  </Chip>
                </View>
              </View>
              <Avatar.Icon
                size={40}
                icon={getTypeIcon(campaign.type)}
                style={{ backgroundColor: getStatusColor(campaign.status) }}
              />
            </View>

            <Paragraph style={styles.campaignDescription} numberOfLines={2}>
              {campaign.description}
            </Paragraph>

            <View style={styles.campaignDetails}>
              <View style={styles.detailRow}>
                <IconButton icon="calendar-range" size={16} style={styles.detailIcon} />
                <Paragraph style={styles.detailText}>
                  {new Date(campaign.startDate).toLocaleDateString('en-ZA')} - {new Date(campaign.endDate).toLocaleDateString('en-ZA')}
                </Paragraph>
              </View>

              <View style={styles.detailRow}>
                <IconButton icon="map-marker-multiple" size={16} style={styles.detailIcon} />
                <Paragraph style={styles.detailText}>
                  {campaign.locations.length} location{campaign.locations.length !== 1 ? 's' : ''}
                </Paragraph>
              </View>

              <View style={styles.detailRow}>
                <IconButton icon="currency-usd" size={16} style={styles.detailIcon} />
                <Paragraph style={styles.detailText}>
                  Budget: R{campaign.budget.toLocaleString()}
                </Paragraph>
              </View>

              {isActive && daysRemaining > 0 && (
                <View style={styles.detailRow}>
                  <IconButton icon="clock-outline" size={16} style={styles.detailIcon} />
                  <Paragraph style={styles.detailText}>
                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                  </Paragraph>
                </View>
              )}
            </View>

            <Divider style={styles.divider} />

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Paragraph style={styles.progressLabel}>Campaign Progress</Paragraph>
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

            <View style={styles.kpiRow}>
              <View style={styles.kpiItem}>
                <Title style={styles.kpiNumber}>{campaign.kpis.actualInteractions}</Title>
                <Paragraph style={styles.kpiLabel}>Interactions</Paragraph>
                <Paragraph style={styles.kpiTarget}>/{campaign.kpis.targetInteractions}</Paragraph>
              </View>
              <View style={styles.kpiItem}>
                <Title style={styles.kpiNumber}>{campaign.kpis.actualSamples}</Title>
                <Paragraph style={styles.kpiLabel}>Samples</Paragraph>
                <Paragraph style={styles.kpiTarget}>/{campaign.kpis.targetSamples}</Paragraph>
              </View>
              <View style={styles.kpiItem}>
                <Title style={styles.kpiNumber}>{campaign.kpis.actualSurveys}</Title>
                <Paragraph style={styles.kpiLabel}>Surveys</Paragraph>
                <Paragraph style={styles.kpiTarget}>/{campaign.kpis.targetSurveys}</Paragraph>
              </View>
            </View>

            {isActive && (
              <Button
                mode="contained"
                onPress={() => navigation.navigate('CampaignExecution', { campaignId: campaign.id, campaign })}
                style={styles.executeButton}
                icon="play"
              >
                Execute Campaign
              </Button>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <Title style={styles.headerTitle}>Marketing Campaigns</Title>
        
        <SearchBar
          placeholder="Search campaigns..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {['ALL', 'ACTIVE', 'DRAFT', 'COMPLETED', 'PAUSED'].map((status) => (
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
        {filteredCampaigns.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content style={styles.emptyContent}>
              <Avatar.Icon
                size={64}
                icon="bullhorn-outline"
                style={styles.emptyIcon}
              />
              <Title style={styles.emptyTitle}>No campaigns found</Title>
              <Paragraph style={styles.emptyText}>
                {searchQuery || filterStatus !== 'ALL'
                  ? 'No campaigns match your search criteria'
                  : 'You have no marketing campaigns assigned'}
              </Paragraph>
            </Card.Content>
          </Card>
        ) : (
          filteredCampaigns.map(renderCampaignCard)
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          Alert.alert('Create Campaign', 'Campaign creation coming soon');
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
  campaignCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  campaignInfo: {
    flex: 1,
  },
  campaignName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  campaignMeta: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  typeChip: {
    marginRight: theme.spacing.xs,
  },
  statusChip: {
    marginRight: theme.spacing.xs,
  },
  campaignDescription: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  campaignDetails: {
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
    fontSize: 20,
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
  executeButton: {
    backgroundColor: theme.colors.success,
    marginTop: theme.spacing.sm,
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

export default CampaignListScreen;