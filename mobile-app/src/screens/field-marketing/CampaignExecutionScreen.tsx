import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
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
  TextInput,
  ProgressBar,
  Modal,
  Portal,
  List,
  Badge,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { theme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { apiService } from '../../services/apiService';
import { offlineService } from '../../services/offlineService';
import { RootStackParamList } from '../../../App';

type CampaignExecutionRouteProp = RouteProp<RootStackParamList, 'CampaignExecution'>;
type CampaignExecutionNavigationProp = StackNavigationProp<RootStackParamList, 'CampaignExecution'>;

interface Interaction {
  id: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  interactionType: 'SAMPLING' | 'SURVEY' | 'DEMONSTRATION' | 'INFORMATION' | 'LEAD_GENERATION';
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
  notes: string;
  photos: string[];
  surveyResponses?: { questionId: string; answer: any }[];
  samplesDistributed: number;
  materialsUsed: { materialId: string; quantity: number }[];
  followUpRequired: boolean;
  rating?: number;
}

interface Material {
  id: string;
  name: string;
  type: 'BROCHURE' | 'SAMPLE' | 'BANNER' | 'FLYER' | 'MERCHANDISE';
  quantity: number;
  distributed: number;
  remaining: number;
}

const CampaignExecutionScreen: React.FC = () => {
  const route = useRoute<CampaignExecutionRouteProp>();
  const navigation = useNavigation<CampaignExecutionNavigationProp>();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  
  const { campaignId, campaign: initialCampaign } = route.params;
  
  const [campaign, setCampaign] = useState(initialCampaign);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [newInteraction, setNewInteraction] = useState<Partial<Interaction>>({
    interactionType: 'SAMPLING',
    notes: '',
    samplesDistributed: 0,
    materialsUsed: [],
    followUpRequired: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCampaignData();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadCampaignData = async () => {
    try {
      if (isOnline) {
        const response = await apiService.get(`/field-marketing/campaigns/${campaignId}/execution`);
        if (response.data.success) {
          const data = response.data.data;
          setInteractions(data.interactions || []);
          setMaterials(data.materials || []);
        }
      } else {
        // Load demo data for offline mode
        setMaterials(getDemoMaterials());
        setInteractions([]);
      }
    } catch (error) {
      console.error('Error loading campaign data:', error);
      setMaterials(getDemoMaterials());
    }
  };

  const getDemoMaterials = (): Material[] => [
    {
      id: '1',
      name: 'Product Samples',
      type: 'SAMPLE',
      quantity: 1000,
      distributed: 320,
      remaining: 680,
    },
    {
      id: '2',
      name: 'Brand Brochures',
      type: 'BROCHURE',
      quantity: 500,
      distributed: 200,
      remaining: 300,
    },
    {
      id: '3',
      name: 'Promotional Banners',
      type: 'BANNER',
      quantity: 10,
      distributed: 6,
      remaining: 4,
    },
  ];

  const addInteraction = async () => {
    try {
      if (!currentLocation) {
        Alert.alert('Location Required', 'Please enable location services to record interactions');
        return;
      }

      const interaction: Interaction = {
        id: `interaction_${Date.now()}`,
        ...newInteraction as Interaction,
        timestamp: new Date().toISOString(),
        location: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        photos: [],
      };

      setInteractions(prev => [...prev, interaction]);

      // Update materials
      if (newInteraction.materialsUsed && newInteraction.materialsUsed.length > 0) {
        setMaterials(prev => prev.map(material => {
          const used = newInteraction.materialsUsed?.find(m => m.materialId === material.id);
          if (used) {
            return {
              ...material,
              distributed: material.distributed + used.quantity,
              remaining: material.remaining - used.quantity,
            };
          }
          return material;
        }));
      }

      // Save offline
      if (!isOnline) {
        await offlineService.addPendingSync('interaction', {
          campaignId,
          interaction,
        });
      } else {
        await apiService.post(`/field-marketing/campaigns/${campaignId}/interactions`, interaction);
      }

      setShowInteractionModal(false);
      setNewInteraction({
        interactionType: 'SAMPLING',
        notes: '',
        samplesDistributed: 0,
        materialsUsed: [],
        followUpRequired: false,
      });

      Alert.alert('Success', 'Interaction recorded successfully');
    } catch (error) {
      console.error('Error adding interaction:', error);
      Alert.alert('Error', 'Failed to record interaction. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        // Save photo offline
        await offlineService.saveOfflinePhoto({
          campaignId,
          filePath: result.assets[0].uri,
          type: 'CAMPAIGN_PHOTO',
          metadata: { timestamp: new Date().toISOString() },
        });

        Alert.alert('Success', 'Photo saved successfully');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const getInteractionTypeIcon = (type: string) => {
    switch (type) {
      case 'SAMPLING': return 'gift';
      case 'SURVEY': return 'clipboard-list';
      case 'DEMONSTRATION': return 'play-circle';
      case 'INFORMATION': return 'information';
      case 'LEAD_GENERATION': return 'account-plus';
      default: return 'account-group';
    }
  };

  const getMaterialTypeIcon = (type: string) => {
    switch (type) {
      case 'SAMPLE': return 'gift';
      case 'BROCHURE': return 'book-open';
      case 'BANNER': return 'flag';
      case 'FLYER': return 'file-document';
      case 'MERCHANDISE': return 'shopping';
      default: return 'package';
    }
  };

  const calculateTodayStats = () => {
    const today = new Date().toDateString();
    const todayInteractions = interactions.filter(i => 
      new Date(i.timestamp).toDateString() === today
    );

    return {
      interactions: todayInteractions.length,
      samples: todayInteractions.reduce((sum, i) => sum + i.samplesDistributed, 0),
      leads: todayInteractions.filter(i => i.interactionType === 'LEAD_GENERATION').length,
      surveys: todayInteractions.filter(i => i.surveyResponses && i.surveyResponses.length > 0).length,
    };
  };

  const todayStats = calculateTodayStats();

  const renderInteractionModal = () => (
    <Portal>
      <Modal
        visible={showInteractionModal}
        onDismiss={() => setShowInteractionModal(false)}
        contentContainerStyle={styles.modalContent}
      >
        <ScrollView>
          <Title style={styles.modalTitle}>Record Interaction</Title>
          
          <View style={styles.interactionTypeSection}>
            <Paragraph style={styles.sectionLabel}>Interaction Type</Paragraph>
            <View style={styles.typeButtons}>
              {[
                { type: 'SAMPLING', label: 'Sampling', icon: 'gift' },
                { type: 'SURVEY', label: 'Survey', icon: 'clipboard-list' },
                { type: 'DEMONSTRATION', label: 'Demo', icon: 'play-circle' },
                { type: 'INFORMATION', label: 'Info', icon: 'information' },
                { type: 'LEAD_GENERATION', label: 'Lead', icon: 'account-plus' },
              ].map((option) => (
                <Button
                  key={option.type}
                  mode={newInteraction.interactionType === option.type ? 'contained' : 'outlined'}
                  icon={option.icon}
                  onPress={() => setNewInteraction(prev => ({ ...prev, interactionType: option.type as any }))}
                  style={styles.typeButton}
                  compact
                >
                  {option.label}
                </Button>
              ))}
            </View>
          </View>

          <TextInput
            label="Customer Name (Optional)"
            value={newInteraction.customerName || ''}
            onChangeText={(text) => setNewInteraction(prev => ({ ...prev, customerName: text }))}
            mode="outlined"
            style={styles.input}
          />

          <TextInput
            label="Customer Phone (Optional)"
            value={newInteraction.customerPhone || ''}
            onChangeText={(text) => setNewInteraction(prev => ({ ...prev, customerPhone: text }))}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <TextInput
            label="Samples Distributed"
            value={newInteraction.samplesDistributed?.toString() || '0'}
            onChangeText={(text) => setNewInteraction(prev => ({ ...prev, samplesDistributed: parseInt(text) || 0 }))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />

          <TextInput
            label="Notes"
            value={newInteraction.notes || ''}
            onChangeText={(text) => setNewInteraction(prev => ({ ...prev, notes: text }))}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowInteractionModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={addInteraction}
              style={styles.modalButton}
            >
              Record
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );

  const renderMaterialsModal = () => (
    <Portal>
      <Modal
        visible={showMaterialsModal}
        onDismiss={() => setShowMaterialsModal(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Title style={styles.modalTitle}>Campaign Materials</Title>
        
        {materials.map((material) => (
          <Card key={material.id} style={styles.materialCard}>
            <Card.Content>
              <View style={styles.materialHeader}>
                <Avatar.Icon
                  size={40}
                  icon={getMaterialTypeIcon(material.type)}
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <View style={styles.materialInfo}>
                  <Title style={styles.materialName}>{material.name}</Title>
                  <Paragraph style={styles.materialType}>{material.type}</Paragraph>
                </View>
                <View style={styles.materialStats}>
                  <Badge style={styles.materialBadge}>{material.remaining}</Badge>
                  <Paragraph style={styles.materialLabel}>Remaining</Paragraph>
                </View>
              </View>
              
              <View style={styles.materialProgress}>
                <Paragraph style={styles.progressText}>
                  {material.distributed} / {material.quantity} distributed
                </Paragraph>
                <ProgressBar
                  progress={material.quantity > 0 ? material.distributed / material.quantity : 0}
                  color={theme.colors.success}
                  style={styles.progressBar}
                />
              </View>
            </Card.Content>
          </Card>
        ))}
        
        <Button
          mode="text"
          onPress={() => setShowMaterialsModal(false)}
          style={styles.closeButton}
        >
          Close
        </Button>
      </Modal>
    </Portal>
  );

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.campaignInfo}>
            <Title style={styles.campaignName}>{campaign?.name}</Title>
            <Paragraph style={styles.campaignType}>
              {campaign?.type?.replace('_', ' ')} Campaign
            </Paragraph>
          </View>
          <Chip
            icon="play"
            style={styles.statusChip}
          >
            Active
          </Chip>
        </View>
      </Surface>

      <ScrollView style={styles.scrollView}>
        {/* Today's Stats */}
        <Card style={styles.statsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Today's Performance</Title>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Title style={styles.statNumber}>{todayStats.interactions}</Title>
                <Paragraph style={styles.statLabel}>Interactions</Paragraph>
              </View>
              <View style={styles.statItem}>
                <Title style={styles.statNumber}>{todayStats.samples}</Title>
                <Paragraph style={styles.statLabel}>Samples</Paragraph>
              </View>
              <View style={styles.statItem}>
                <Title style={styles.statNumber}>{todayStats.leads}</Title>
                <Paragraph style={styles.statLabel}>Leads</Paragraph>
              </View>
              <View style={styles.statItem}>
                <Title style={styles.statNumber}>{todayStats.surveys}</Title>
                <Paragraph style={styles.statLabel}>Surveys</Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Quick Actions</Title>
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                icon="account-plus"
                onPress={() => setShowInteractionModal(true)}
                style={[styles.actionButton, { backgroundColor: theme.colors.success }]}
              >
                Record Interaction
              </Button>
              <Button
                mode="outlined"
                icon="camera"
                onPress={takePhoto}
                style={styles.actionButton}
              >
                Take Photo
              </Button>
              <Button
                mode="outlined"
                icon="package-variant"
                onPress={() => setShowMaterialsModal(true)}
                style={styles.actionButton}
              >
                View Materials
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Recent Interactions */}
        <Card style={styles.interactionsCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Title style={styles.sectionTitle}>Recent Interactions</Title>
              <Chip icon="history" style={styles.countChip}>
                {interactions.length}
              </Chip>
            </View>

            {interactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Avatar.Icon
                  size={48}
                  icon="account-group-outline"
                  style={styles.emptyIcon}
                />
                <Paragraph style={styles.emptyText}>
                  No interactions recorded yet. Start engaging with customers!
                </Paragraph>
              </View>
            ) : (
              interactions.slice(-5).reverse().map((interaction) => (
                <View key={interaction.id} style={styles.interactionItem}>
                  <Avatar.Icon
                    size={32}
                    icon={getInteractionTypeIcon(interaction.interactionType)}
                    style={styles.interactionIcon}
                  />
                  <View style={styles.interactionDetails}>
                    <Paragraph style={styles.interactionType}>
                      {interaction.interactionType.replace('_', ' ')}
                    </Paragraph>
                    <Paragraph style={styles.interactionTime}>
                      {new Date(interaction.timestamp).toLocaleTimeString('en-ZA')}
                    </Paragraph>
                    {interaction.customerName && (
                      <Paragraph style={styles.customerName}>
                        {interaction.customerName}
                      </Paragraph>
                    )}
                    {interaction.notes && (
                      <Paragraph style={styles.interactionNotes} numberOfLines={2}>
                        {interaction.notes}
                      </Paragraph>
                    )}
                  </View>
                  <View style={styles.interactionMeta}>
                    {interaction.samplesDistributed > 0 && (
                      <Chip icon="gift" style={styles.metaChip}>
                        {interaction.samplesDistributed}
                      </Chip>
                    )}
                    {interaction.followUpRequired && (
                      <Chip icon="flag" style={styles.followUpChip}>
                        Follow-up
                      </Chip>
                    )}
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Campaign Objectives */}
        {campaign?.objectives && (
          <Card style={styles.objectivesCard}>
            <Card.Content>
              <Title style={styles.sectionTitle}>Campaign Objectives</Title>
              {campaign.objectives.map((objective, index) => (
                <View key={index} style={styles.objectiveItem}>
                  <IconButton icon="target" size={16} style={styles.objectiveIcon} />
                  <Paragraph style={styles.objectiveText}>{objective}</Paragraph>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {renderInteractionModal()}
      {renderMaterialsModal()}
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
  },
  campaignInfo: {
    flex: 1,
  },
  campaignName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  campaignType: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
  statusChip: {
    backgroundColor: theme.colors.success,
  },
  scrollView: {
    flex: 1,
    padding: theme.spacing.md,
  },
  statsCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.placeholder,
  },
  actionsCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  actionButtons: {
    gap: theme.spacing.sm,
  },
  actionButton: {
    marginBottom: theme.spacing.sm,
  },
  interactionsCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  countChip: {
    backgroundColor: theme.colors.accent,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyIcon: {
    backgroundColor: theme.colors.placeholder,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.placeholder,
  },
  interactionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.disabled,
  },
  interactionIcon: {
    backgroundColor: theme.colors.primary,
    marginRight: theme.spacing.sm,
  },
  interactionDetails: {
    flex: 1,
  },
  interactionType: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  interactionTime: {
    fontSize: 12,
    color: theme.colors.placeholder,
  },
  customerName: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  interactionNotes: {
    fontSize: 14,
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  interactionMeta: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  metaChip: {
    backgroundColor: theme.colors.success,
  },
  followUpChip: {
    backgroundColor: theme.colors.warning,
  },
  objectivesCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  objectiveIcon: {
    margin: 0,
    marginRight: theme.spacing.xs,
  },
  objectiveText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    margin: theme.spacing.lg,
    borderRadius: theme.roundness * 2,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  interactionTypeSection: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  typeButton: {
    marginBottom: theme.spacing.xs,
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
  materialCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  materialInfo: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  materialName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  materialType: {
    fontSize: 12,
    color: theme.colors.placeholder,
  },
  materialStats: {
    alignItems: 'center',
  },
  materialBadge: {
    backgroundColor: theme.colors.success,
    color: '#FFFFFF',
  },
  materialLabel: {
    fontSize: 10,
    color: theme.colors.placeholder,
    marginTop: theme.spacing.xs,
  },
  materialProgress: {
    marginTop: theme.spacing.sm,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  closeButton: {
    marginTop: theme.spacing.md,
  },
});

export default CampaignExecutionScreen;