import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
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
  TextInput,
  ProgressBar,
  Modal,
  Portal,
  List,
  Badge,
  Checkbox,
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

type ActivationExecutionRouteProp = RouteProp<RootStackParamList, 'ActivationExecution'>;
type ActivationExecutionNavigationProp = StackNavigationProp<RootStackParamList, 'ActivationExecution'>;

interface ChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
}

interface KPIUpdate {
  footfall: number;
  engagement: number;
  conversions: number;
  sales: number;
  timestamp: string;
}

interface ActivityLog {
  id: string;
  type: 'CHECKLIST' | 'KPI_UPDATE' | 'PHOTO' | 'NOTE' | 'ISSUE';
  description: string;
  timestamp: string;
  user: string;
  data?: any;
}

const ActivationExecutionScreen: React.FC = () => {
  const route = useRoute<ActivationExecutionRouteProp>();
  const navigation = useNavigation<ActivationExecutionNavigationProp>();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  
  const { activationId, activation: initialActivation } = route.params;
  
  const [activation, setActivation] = useState(initialActivation);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialActivation?.checklist || []);
  const [currentKPIs, setCurrentKPIs] = useState(initialActivation?.kpis || {});
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [kpiUpdates, setKpiUpdates] = useState({
    footfall: 0,
    engagement: 0,
    conversions: 0,
    sales: 0,
  });
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCurrentLocation();
    loadActivityLog();
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

  const loadActivityLog = () => {
    // Demo activity log
    const demoLog: ActivityLog[] = [
      {
        id: '1',
        type: 'CHECKLIST',
        description: 'Completed: Setup booth and displays',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        user: 'Sarah Johnson',
      },
      {
        id: '2',
        type: 'KPI_UPDATE',
        description: 'Updated footfall count: +150',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        user: 'Mike Chen',
        data: { footfall: 150 },
      },
      {
        id: '3',
        type: 'PHOTO',
        description: 'Added activation setup photo',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        user: 'Lisa Williams',
      },
    ];
    setActivityLog(demoLog);
  };

  const toggleChecklistItem = async (itemId: string) => {
    try {
      const updatedChecklist = checklist.map(item => {
        if (item.id === itemId) {
          const updated = {
            ...item,
            completed: !item.completed,
            completedBy: !item.completed ? user?.name : undefined,
            completedAt: !item.completed ? new Date().toISOString() : undefined,
          };
          
          // Add to activity log
          const logEntry: ActivityLog = {
            id: `log_${Date.now()}`,
            type: 'CHECKLIST',
            description: `${updated.completed ? 'Completed' : 'Unchecked'}: ${item.task}`,
            timestamp: new Date().toISOString(),
            user: user?.name || 'Unknown',
          };
          setActivityLog(prev => [logEntry, ...prev]);
          
          return updated;
        }
        return item;
      });
      
      setChecklist(updatedChecklist);
      
      // Save offline
      if (!isOnline) {
        await offlineService.addPendingSync('checklist', {
          activationId,
          checklist: updatedChecklist,
        });
      } else {
        await apiService.patch(`/promotions/activations/${activationId}/checklist`, {
          checklist: updatedChecklist,
        });
      }
    } catch (error) {
      console.error('Error updating checklist:', error);
      Alert.alert('Error', 'Failed to update checklist item');
    }
  };

  const updateKPIs = async () => {
    try {
      const updatedKPIs = {
        ...currentKPIs,
        actualFootfall: currentKPIs.actualFootfall + kpiUpdates.footfall,
        actualEngagement: currentKPIs.actualEngagement + kpiUpdates.engagement,
        actualConversions: currentKPIs.actualConversions + kpiUpdates.conversions,
        actualSales: currentKPIs.actualSales + kpiUpdates.sales,
      };
      
      setCurrentKPIs(updatedKPIs);
      
      // Add to activity log
      const logEntry: ActivityLog = {
        id: `log_${Date.now()}`,
        type: 'KPI_UPDATE',
        description: `Updated KPIs: Footfall +${kpiUpdates.footfall}, Engagement +${kpiUpdates.engagement}, Conversions +${kpiUpdates.conversions}, Sales +R${kpiUpdates.sales}`,
        timestamp: new Date().toISOString(),
        user: user?.name || 'Unknown',
        data: kpiUpdates,
      };
      setActivityLog(prev => [logEntry, ...prev]);
      
      // Save offline
      if (!isOnline) {
        await offlineService.addPendingSync('kpi_update', {
          activationId,
          kpis: updatedKPIs,
          update: kpiUpdates,
        });
      } else {
        await apiService.patch(`/promotions/activations/${activationId}/kpis`, {
          kpis: updatedKPIs,
        });
      }
      
      setKpiUpdates({ footfall: 0, engagement: 0, conversions: 0, sales: 0 });
      setShowKPIModal(false);
      Alert.alert('Success', 'KPIs updated successfully');
    } catch (error) {
      console.error('Error updating KPIs:', error);
      Alert.alert('Error', 'Failed to update KPIs');
    }
  };

  const addNote = async () => {
    try {
      if (!newNote.trim()) return;
      
      const logEntry: ActivityLog = {
        id: `log_${Date.now()}`,
        type: 'NOTE',
        description: newNote,
        timestamp: new Date().toISOString(),
        user: user?.name || 'Unknown',
      };
      
      setActivityLog(prev => [logEntry, ...prev]);
      
      // Save offline
      if (!isOnline) {
        await offlineService.addPendingSync('activation_note', {
          activationId,
          note: logEntry,
        });
      } else {
        await apiService.post(`/promotions/activations/${activationId}/notes`, logEntry);
      }
      
      setNewNote('');
      setShowNotesModal(false);
      Alert.alert('Success', 'Note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert('Error', 'Failed to add note');
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
          activationId,
          filePath: result.assets[0].uri,
          type: 'ACTIVATION_PHOTO',
          metadata: { timestamp: new Date().toISOString() },
        });

        // Add to activity log
        const logEntry: ActivityLog = {
          id: `log_${Date.now()}`,
          type: 'PHOTO',
          description: 'Added activation photo',
          timestamp: new Date().toISOString(),
          user: user?.name || 'Unknown',
        };
        setActivityLog(prev => [logEntry, ...prev]);

        Alert.alert('Success', 'Photo saved successfully');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
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

  const calculateProgress = () => {
    if (!currentKPIs.targetFootfall) return 0;
    const totalTarget = currentKPIs.targetFootfall + currentKPIs.targetEngagement + currentKPIs.targetConversions;
    const totalActual = currentKPIs.actualFootfall + currentKPIs.actualEngagement + currentKPIs.actualConversions;
    return totalTarget > 0 ? totalActual / totalTarget : 0;
  };

  const getChecklistProgress = () => {
    const completed = checklist.filter(item => item.completed).length;
    return checklist.length > 0 ? completed / checklist.length : 0;
  };

  const renderKPIModal = () => (
    <Portal>
      <Modal
        visible={showKPIModal}
        onDismiss={() => setShowKPIModal(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Title style={styles.modalTitle}>Update KPIs</Title>
        
        <TextInput
          label="Footfall Count"
          value={kpiUpdates.footfall.toString()}
          onChangeText={(text) => setKpiUpdates(prev => ({ ...prev, footfall: parseInt(text) || 0 }))}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
        />
        
        <TextInput
          label="Engagement Count"
          value={kpiUpdates.engagement.toString()}
          onChangeText={(text) => setKpiUpdates(prev => ({ ...prev, engagement: parseInt(text) || 0 }))}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
        />
        
        <TextInput
          label="Conversions"
          value={kpiUpdates.conversions.toString()}
          onChangeText={(text) => setKpiUpdates(prev => ({ ...prev, conversions: parseInt(text) || 0 }))}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
        />
        
        <TextInput
          label="Sales Amount (R)"
          value={kpiUpdates.sales.toString()}
          onChangeText={(text) => setKpiUpdates(prev => ({ ...prev, sales: parseInt(text) || 0 }))}
          mode="outlined"
          keyboardType="numeric"
          style={styles.input}
        />
        
        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setShowKPIModal(false)}
            style={styles.modalButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={updateKPIs}
            style={styles.modalButton}
          >
            Update
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  const renderNotesModal = () => (
    <Portal>
      <Modal
        visible={showNotesModal}
        onDismiss={() => setShowNotesModal(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Title style={styles.modalTitle}>Add Note</Title>
        
        <TextInput
          label="Note"
          value={newNote}
          onChangeText={setNewNote}
          mode="outlined"
          multiline
          numberOfLines={4}
          style={styles.input}
        />
        
        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setShowNotesModal(false)}
            style={styles.modalButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={addNote}
            style={styles.modalButton}
          >
            Add Note
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  const renderTeamModal = () => (
    <Portal>
      <Modal
        visible={showTeamModal}
        onDismiss={() => setShowTeamModal(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Title style={styles.modalTitle}>Team Members</Title>
        
        {activation?.team?.map((member) => (
          <Card key={member.id} style={styles.teamCard}>
            <Card.Content>
              <View style={styles.teamMember}>
                <Avatar.Text
                  size={40}
                  label={member.name.split(' ').map(n => n[0]).join('')}
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <View style={styles.memberInfo}>
                  <Title style={styles.memberName}>{member.name}</Title>
                  <Paragraph style={styles.memberRole}>{member.role}</Paragraph>
                </View>
                <IconButton
                  icon="phone"
                  onPress={() => Alert.alert('Call', `Call ${member.name}?`)}
                />
              </View>
            </Card.Content>
          </Card>
        ))}
        
        <Button
          mode="text"
          onPress={() => setShowTeamModal(false)}
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
          <View style={styles.activationInfo}>
            <Title style={styles.activationName}>{activation?.name}</Title>
            <Paragraph style={styles.activationType}>
              {activation?.type?.replace('_', ' ')} Activation
            </Paragraph>
          </View>
          <Chip
            icon="play"
            style={[styles.statusChip, { backgroundColor: getStatusColor(activation?.status || 'ACTIVE') }]}
          >
            {activation?.status || 'ACTIVE'}
          </Chip>
        </View>
      </Surface>

      <ScrollView style={styles.scrollView}>
        {/* Progress Overview */}
        <Card style={styles.progressCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Progress Overview</Title>
            
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Paragraph style={styles.progressLabel}>Overall Progress</Paragraph>
                <Paragraph style={styles.progressPercentage}>
                  {Math.round(calculateProgress() * 100)}%
                </Paragraph>
              </View>
              <ProgressBar
                progress={calculateProgress()}
                color={theme.colors.success}
                style={styles.progressBar}
              />
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Paragraph style={styles.progressLabel}>Checklist Progress</Paragraph>
                <Paragraph style={styles.progressPercentage}>
                  {Math.round(getChecklistProgress() * 100)}%
                </Paragraph>
              </View>
              <ProgressBar
                progress={getChecklistProgress()}
                color={theme.colors.primary}
                style={styles.progressBar}
              />
            </View>
          </Card.Content>
        </Card>

        {/* KPI Dashboard */}
        <Card style={styles.kpiCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Title style={styles.sectionTitle}>Live KPIs</Title>
              <Button
                mode="contained"
                icon="plus"
                onPress={() => setShowKPIModal(true)}
                compact
              >
                Update
              </Button>
            </View>
            
            <View style={styles.kpiGrid}>
              <View style={styles.kpiItem}>
                <Title style={styles.kpiNumber}>{currentKPIs.actualFootfall || 0}</Title>
                <Paragraph style={styles.kpiLabel}>Footfall</Paragraph>
                <Paragraph style={styles.kpiTarget}>/{currentKPIs.targetFootfall || 0}</Paragraph>
              </View>
              <View style={styles.kpiItem}>
                <Title style={styles.kpiNumber}>{currentKPIs.actualEngagement || 0}</Title>
                <Paragraph style={styles.kpiLabel}>Engagement</Paragraph>
                <Paragraph style={styles.kpiTarget}>/{currentKPIs.targetEngagement || 0}</Paragraph>
              </View>
              <View style={styles.kpiItem}>
                <Title style={styles.kpiNumber}>{currentKPIs.actualConversions || 0}</Title>
                <Paragraph style={styles.kpiLabel}>Conversions</Paragraph>
                <Paragraph style={styles.kpiTarget}>/{currentKPIs.targetConversions || 0}</Paragraph>
              </View>
              <View style={styles.kpiItem}>
                <Title style={styles.kpiNumber}>R{(currentKPIs.actualSales || 0).toLocaleString()}</Title>
                <Paragraph style={styles.kpiLabel}>Sales</Paragraph>
                <Paragraph style={styles.kpiTarget}>/R{(currentKPIs.targetSales || 0).toLocaleString()}</Paragraph>
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
                mode="outlined"
                icon="camera"
                onPress={takePhoto}
                style={styles.actionButton}
              >
                Take Photo
              </Button>
              <Button
                mode="outlined"
                icon="note-plus"
                onPress={() => setShowNotesModal(true)}
                style={styles.actionButton}
              >
                Add Note
              </Button>
              <Button
                mode="outlined"
                icon="account-group"
                onPress={() => setShowTeamModal(true)}
                style={styles.actionButton}
              >
                Team
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Checklist */}
        <Card style={styles.checklistCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Activation Checklist</Title>
            
            {checklist.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => toggleChecklistItem(item.id)}
                style={styles.checklistItem}
              >
                <Checkbox
                  status={item.completed ? 'checked' : 'unchecked'}
                  onPress={() => toggleChecklistItem(item.id)}
                />
                <View style={styles.checklistContent}>
                  <Paragraph style={[
                    styles.checklistTask,
                    item.completed && styles.completedTask
                  ]}>
                    {item.task}
                  </Paragraph>
                  {item.completed && item.completedBy && (
                    <Paragraph style={styles.completedBy}>
                      Completed by {item.completedBy} at {new Date(item.completedAt!).toLocaleTimeString('en-ZA')}
                    </Paragraph>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Card.Content>
        </Card>

        {/* Activity Log */}
        <Card style={styles.activityCard}>
          <Card.Content>
            <Title style={styles.sectionTitle}>Activity Log</Title>
            
            {activityLog.length === 0 ? (
              <View style={styles.emptyState}>
                <Avatar.Icon
                  size={48}
                  icon="history"
                  style={styles.emptyIcon}
                />
                <Paragraph style={styles.emptyText}>
                  No activities recorded yet
                </Paragraph>
              </View>
            ) : (
              activityLog.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <Avatar.Icon
                    size={32}
                    icon={
                      activity.type === 'CHECKLIST' ? 'check-circle' :
                      activity.type === 'KPI_UPDATE' ? 'chart-line' :
                      activity.type === 'PHOTO' ? 'camera' :
                      activity.type === 'NOTE' ? 'note' : 'alert'
                    }
                    style={[styles.activityIcon, {
                      backgroundColor: 
                        activity.type === 'CHECKLIST' ? theme.colors.success :
                        activity.type === 'KPI_UPDATE' ? theme.colors.primary :
                        activity.type === 'PHOTO' ? theme.colors.accent :
                        theme.colors.info
                    }]}
                  />
                  <View style={styles.activityDetails}>
                    <Paragraph style={styles.activityDescription}>
                      {activity.description}
                    </Paragraph>
                    <Paragraph style={styles.activityMeta}>
                      {activity.user} • {new Date(activity.timestamp).toLocaleTimeString('en-ZA')}
                    </Paragraph>
                  </View>
                </View>
              ))
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {renderKPIModal()}
      {renderNotesModal()}
      {renderTeamModal()}
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
  activationInfo: {
    flex: 1,
  },
  activationName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  activationType: {
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
  progressCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
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
  kpiCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiItem: {
    alignItems: 'center',
    width: '48%',
    marginBottom: theme.spacing.md,
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
  actionsCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
  },
  checklistCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.disabled,
  },
  checklistContent: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  checklistTask: {
    fontSize: 16,
    color: theme.colors.text,
  },
  completedTask: {
    textDecorationLine: 'line-through',
    color: theme.colors.placeholder,
  },
  completedBy: {
    fontSize: 12,
    color: theme.colors.placeholder,
    marginTop: theme.spacing.xs,
  },
  activityCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
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
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.disabled,
  },
  activityIcon: {
    marginRight: theme.spacing.sm,
  },
  activityDetails: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: theme.colors.text,
  },
  activityMeta: {
    fontSize: 12,
    color: theme.colors.placeholder,
    marginTop: theme.spacing.xs,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    margin: theme.spacing.lg,
    borderRadius: theme.roundness * 2,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
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
  teamCard: {
    marginBottom: theme.spacing.sm,
    elevation: theme.elevation.small,
  },
  teamMember: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  memberRole: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
  closeButton: {
    marginTop: theme.spacing.md,
  },
});

export default ActivationExecutionScreen;