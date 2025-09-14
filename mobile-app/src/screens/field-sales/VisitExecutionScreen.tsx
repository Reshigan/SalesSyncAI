import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Dimensions,
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

type VisitExecutionRouteProp = RouteProp<RootStackParamList, 'VisitExecution'>;
type VisitExecutionNavigationProp = StackNavigationProp<RootStackParamList, 'VisitExecution'>;

interface VisitPhoto {
  id: string;
  uri: string;
  type: 'STORE_FRONT' | 'PRODUCT_DISPLAY' | 'STOCK_LEVEL' | 'PROMOTIONAL' | 'OTHER';
  caption?: string;
  timestamp: string;
}

interface SurveyQuestion {
  id: string;
  question: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'MULTIPLE_CHOICE' | 'RATING';
  options?: string[];
  required: boolean;
}

interface SurveyResponse {
  questionId: string;
  answer: string | number | boolean;
}

interface VisitData {
  id: string;
  customerId: string;
  customerName: string;
  startTime: string;
  endTime?: string;
  status: string;
  location: {
    latitude: number;
    longitude: number;
  };
  photos: VisitPhoto[];
  surveyResponses: SurveyResponse[];
  notes: string;
  checkinLocation?: {
    latitude: number;
    longitude: number;
  };
  checkoutLocation?: {
    latitude: number;
    longitude: number;
  };
}

const VisitExecutionScreen: React.FC = () => {
  const route = useRoute<VisitExecutionRouteProp>();
  const navigation = useNavigation<VisitExecutionNavigationProp>();
  const { user } = useAuth();
  const { isOnline } = useOffline();
  
  const { visitId, visit: initialVisit } = route.params;
  
  const [visitData, setVisitData] = useState<VisitData>({
    id: visitId,
    customerId: initialVisit?.customerId || '',
    customerName: initialVisit?.customerName || '',
    startTime: initialVisit?.actualStartTime || new Date().toISOString(),
    status: 'IN_PROGRESS',
    location: initialVisit?.location || { latitude: 0, longitude: 0 },
    photos: [],
    surveyResponses: [],
    notes: '',
  });

  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoType, setSelectedPhotoType] = useState<VisitPhoto['type']>('STORE_FRONT');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSurveyQuestions();
    getCurrentLocation();
    checkInVisit();
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

  const checkInVisit = async () => {
    if (currentLocation) {
      setVisitData(prev => ({
        ...prev,
        checkinLocation: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
      }));
    }
  };

  const loadSurveyQuestions = () => {
    // Demo survey questions - in production, these would be loaded from API
    const questions: SurveyQuestion[] = [
      {
        id: '1',
        question: 'How would you rate the store\'s product display?',
        type: 'RATING',
        required: true,
      },
      {
        id: '2',
        question: 'What is the current stock level of our main product?',
        type: 'MULTIPLE_CHOICE',
        options: ['High (>50 units)', 'Medium (20-50 units)', 'Low (5-20 units)', 'Out of Stock'],
        required: true,
      },
      {
        id: '3',
        question: 'Is the promotional material properly displayed?',
        type: 'BOOLEAN',
        required: true,
      },
      {
        id: '4',
        question: 'Additional observations or feedback',
        type: 'TEXT',
        required: false,
      },
    ];
    setSurveyQuestions(questions);
  };

  const takePhoto = async (type: VisitPhoto['type']) => {
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
        const photo: VisitPhoto = {
          id: `photo_${Date.now()}`,
          uri: result.assets[0].uri,
          type,
          timestamp: new Date().toISOString(),
        };

        setVisitData(prev => ({
          ...prev,
          photos: [...prev.photos, photo],
        }));

        // Save photo offline
        await offlineService.saveOfflinePhoto({
          visitId: visitData.id,
          filePath: photo.uri,
          type: photo.type,
          metadata: { timestamp: photo.timestamp },
        });

        setShowPhotoModal(false);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const answerSurveyQuestion = (questionId: string, answer: string | number | boolean) => {
    setVisitData(prev => ({
      ...prev,
      surveyResponses: [
        ...prev.surveyResponses.filter(r => r.questionId !== questionId),
        { questionId, answer },
      ],
    }));
  };

  const completeVisit = async () => {
    try {
      setLoading(true);

      // Get checkout location
      const checkoutLocation = currentLocation ? {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      } : undefined;

      const completedVisit = {
        ...visitData,
        status: 'COMPLETED',
        endTime: new Date().toISOString(),
        checkoutLocation,
      };

      if (isOnline) {
        await apiService.patch(`/field-sales/visits/${visitId}`, completedVisit);
      } else {
        await offlineService.saveOfflineVisit(completedVisit);
        await offlineService.addPendingSync('visit', completedVisit);
      }

      Alert.alert(
        'Visit Completed',
        'Your visit has been successfully completed and will be synced when online.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error completing visit:', error);
      Alert.alert('Error', 'Failed to complete visit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderSurveyQuestion = (question: SurveyQuestion, index: number) => {
    const currentResponse = visitData.surveyResponses.find(r => r.questionId === question.id);

    return (
      <Card key={question.id} style={styles.questionCard}>
        <Card.Content>
          <View style={styles.questionHeader}>
            <Title style={styles.questionTitle}>
              Question {index + 1} of {surveyQuestions.length}
            </Title>
            {question.required && (
              <Chip icon="asterisk" style={styles.requiredChip}>
                Required
              </Chip>
            )}
          </View>
          
          <Paragraph style={styles.questionText}>{question.question}</Paragraph>

          {question.type === 'TEXT' && (
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={3}
              value={currentResponse?.answer as string || ''}
              onChangeText={(text) => answerSurveyQuestion(question.id, text)}
              style={styles.textInput}
            />
          )}

          {question.type === 'NUMBER' && (
            <TextInput
              mode="outlined"
              keyboardType="numeric"
              value={currentResponse?.answer?.toString() || ''}
              onChangeText={(text) => answerSurveyQuestion(question.id, parseInt(text) || 0)}
              style={styles.textInput}
            />
          )}

          {question.type === 'BOOLEAN' && (
            <View style={styles.booleanOptions}>
              <Button
                mode={currentResponse?.answer === true ? 'contained' : 'outlined'}
                onPress={() => answerSurveyQuestion(question.id, true)}
                style={styles.booleanButton}
              >
                Yes
              </Button>
              <Button
                mode={currentResponse?.answer === false ? 'contained' : 'outlined'}
                onPress={() => answerSurveyQuestion(question.id, false)}
                style={styles.booleanButton}
              >
                No
              </Button>
            </View>
          )}

          {question.type === 'MULTIPLE_CHOICE' && question.options && (
            <View style={styles.multipleChoiceOptions}>
              {question.options.map((option, optionIndex) => (
                <Button
                  key={optionIndex}
                  mode={currentResponse?.answer === option ? 'contained' : 'outlined'}
                  onPress={() => answerSurveyQuestion(question.id, option)}
                  style={styles.optionButton}
                >
                  {option}
                </Button>
              ))}
            </View>
          )}

          {question.type === 'RATING' && (
            <View style={styles.ratingOptions}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <IconButton
                  key={rating}
                  icon="star"
                  size={32}
                  iconColor={
                    (currentResponse?.answer as number) >= rating
                      ? theme.colors.warning
                      : theme.colors.placeholder
                  }
                  onPress={() => answerSurveyQuestion(question.id, rating)}
                />
              ))}
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  const renderPhotoSection = () => (
    <Card style={styles.photoCard}>
      <Card.Content>
        <View style={styles.sectionHeader}>
          <Title style={styles.sectionTitle}>Visit Photos</Title>
          <Button
            mode="contained"
            icon="camera"
            onPress={() => setShowPhotoModal(true)}
            compact
          >
            Add Photo
          </Button>
        </View>

        {visitData.photos.length === 0 ? (
          <View style={styles.emptyPhotos}>
            <Avatar.Icon
              size={48}
              icon="camera-outline"
              style={styles.emptyIcon}
            />
            <Paragraph style={styles.emptyText}>
              No photos taken yet. Add photos to document your visit.
            </Paragraph>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoGrid}>
              {visitData.photos.map((photo) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <Chip
                    style={styles.photoTypeChip}
                    textStyle={{ fontSize: 10 }}
                  >
                    {photo.type.replace('_', ' ')}
                  </Chip>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Card.Content>
    </Card>
  );

  const renderNotesSection = () => (
    <Card style={styles.notesCard}>
      <Card.Content>
        <Title style={styles.sectionTitle}>Visit Notes</Title>
        <TextInput
          mode="outlined"
          multiline
          numberOfLines={4}
          placeholder="Add any additional notes about this visit..."
          value={visitData.notes}
          onChangeText={(text) => setVisitData(prev => ({ ...prev, notes: text }))}
          style={styles.notesInput}
        />
      </Card.Content>
    </Card>
  );

  const getCompletionProgress = () => {
    const requiredQuestions = surveyQuestions.filter(q => q.required);
    const answeredRequired = requiredQuestions.filter(q =>
      visitData.surveyResponses.some(r => r.questionId === q.id)
    );
    return requiredQuestions.length > 0 ? answeredRequired.length / requiredQuestions.length : 1;
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.visitInfo}>
            <Title style={styles.customerName}>{visitData.customerName}</Title>
            <Paragraph style={styles.visitTime}>
              Started: {new Date(visitData.startTime).toLocaleTimeString('en-ZA')}
            </Paragraph>
          </View>
          <Chip
            icon="clock-outline"
            style={styles.statusChip}
          >
            In Progress
          </Chip>
        </View>
        
        <View style={styles.progressSection}>
          <Paragraph style={styles.progressLabel}>
            Completion Progress: {Math.round(getCompletionProgress() * 100)}%
          </Paragraph>
          <ProgressBar
            progress={getCompletionProgress()}
            color={theme.colors.success}
            style={styles.progressBar}
          />
        </View>
      </Surface>

      <ScrollView style={styles.scrollView}>
        {/* Survey Questions */}
        <View style={styles.surveySection}>
          <Title style={styles.sectionTitle}>Survey Questions</Title>
          {surveyQuestions.map((question, index) => renderSurveyQuestion(question, index))}
        </View>

        {/* Photos Section */}
        {renderPhotoSection()}

        {/* Notes Section */}
        {renderNotesSection()}

        {/* Complete Visit Button */}
        <Button
          mode="contained"
          onPress={completeVisit}
          loading={loading}
          disabled={loading || getCompletionProgress() < 1}
          style={styles.completeButton}
          icon="check-circle"
        >
          Complete Visit
        </Button>
      </ScrollView>

      {/* Photo Type Selection Modal */}
      <Portal>
        <Modal
          visible={showPhotoModal}
          onDismiss={() => setShowPhotoModal(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Title style={styles.modalTitle}>Select Photo Type</Title>
          
          {[
            { type: 'STORE_FRONT', label: 'Store Front', icon: 'storefront' },
            { type: 'PRODUCT_DISPLAY', label: 'Product Display', icon: 'package-variant' },
            { type: 'STOCK_LEVEL', label: 'Stock Level', icon: 'archive' },
            { type: 'PROMOTIONAL', label: 'Promotional Material', icon: 'bullhorn' },
            { type: 'OTHER', label: 'Other', icon: 'camera' },
          ].map((option) => (
            <Button
              key={option.type}
              mode="outlined"
              icon={option.icon}
              onPress={() => {
                setSelectedPhotoType(option.type as VisitPhoto['type']);
                takePhoto(option.type as VisitPhoto['type']);
              }}
              style={styles.photoTypeButton}
            >
              {option.label}
            </Button>
          ))}
          
          <Button
            mode="text"
            onPress={() => setShowPhotoModal(false)}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </Modal>
      </Portal>
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
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  visitInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  visitTime: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
  statusChip: {
    backgroundColor: theme.colors.warning,
  },
  progressSection: {
    marginTop: theme.spacing.sm,
  },
  progressLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  scrollView: {
    flex: 1,
    padding: theme.spacing.md,
  },
  surveySection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  questionCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  requiredChip: {
    backgroundColor: theme.colors.error,
  },
  questionText: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  textInput: {
    marginBottom: theme.spacing.sm,
  },
  booleanOptions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  booleanButton: {
    flex: 1,
  },
  multipleChoiceOptions: {
    gap: theme.spacing.sm,
  },
  optionButton: {
    marginBottom: theme.spacing.xs,
  },
  ratingOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCard: {
    marginBottom: theme.spacing.lg,
    elevation: theme.elevation.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyPhotos: {
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
  photoGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  photoItem: {
    alignItems: 'center',
  },
  photoImage: {
    width: 120,
    height: 90,
    borderRadius: theme.roundness,
    marginBottom: theme.spacing.xs,
  },
  photoTypeChip: {
    backgroundColor: theme.colors.surface,
  },
  notesCard: {
    marginBottom: theme.spacing.lg,
    elevation: theme.elevation.small,
  },
  notesInput: {
    marginTop: theme.spacing.sm,
  },
  completeButton: {
    marginVertical: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.success,
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
  photoTypeButton: {
    marginBottom: theme.spacing.md,
  },
  cancelButton: {
    marginTop: theme.spacing.md,
  },
});

export default VisitExecutionScreen;