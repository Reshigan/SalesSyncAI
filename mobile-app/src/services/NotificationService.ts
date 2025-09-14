/**
 * Advanced Notification Service for SalesSync Mobile App
 * Handles local notifications, push notifications, and real-time alerts
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NotificationData {
  type: 'campaign' | 'visit' | 'sync' | 'fraud_alert' | 'system' | 'success' | 'error';
  recipientId: string;
  title: string;
  message: string;
  data?: any;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  scheduledFor?: Date;
  expiresAt?: Date;
}

export interface NotificationSettings {
  enabled: boolean;
  types: {
    campaigns: boolean;
    visits: boolean;
    sync: boolean;
    fraudAlerts: boolean;
    system: boolean;
  };
  sound: boolean;
  vibration: boolean;
  badge: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

export interface NotificationHistory {
  id: string;
  notification: NotificationData;
  sentAt: Date;
  readAt?: Date;
  actionTaken?: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'DISMISSED' | 'EXPIRED';
}

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private settings: NotificationSettings;
  private notificationHistory: NotificationHistory[] = [];

  constructor() {
    this.settings = {
      enabled: true,
      types: {
        campaigns: true,
        visits: true,
        sync: true,
        fraudAlerts: true,
        system: true
      },
      sound: true,
      vibration: true,
      badge: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00'
      }
    };

    this.initialize();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize notification service
   */
  private async initialize(): Promise<void> {
    try {
      // Configure notification behavior
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const shouldShow = await this.shouldShowNotification(notification);
          
          return {
            shouldShowAlert: shouldShow,
            shouldPlaySound: this.settings.sound && shouldShow,
            shouldSetBadge: this.settings.badge && shouldShow,
          };
        },
      });

      // Load settings
      await this.loadSettings();

      // Load notification history
      await this.loadNotificationHistory();

      // Register for push notifications
      await this.registerForPushNotifications();

      // Set up notification listeners
      this.setupNotificationListeners();

      console.log('Notification service initialized');
    } catch (error) {
      console.error('Notification service initialization error:', error);
    }
  }

  /**
   * Register for push notifications
   */
  private async registerForPushNotifications(): Promise<void> {
    try {
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions not granted');
        return;
      }

      // Get push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.expoPushToken = token;

      // Store token for server registration
      await AsyncStorage.setItem('expoPushToken', token);

      console.log('Push notification token:', token);

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'SalesSync Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#1E3A8A',
          sound: 'default',
        });

        // Create specific channels for different notification types
        await this.createNotificationChannels();
      }
    } catch (error) {
      console.error('Push notification registration error:', error);
    }
  }

  /**
   * Create Android notification channels
   */
  private async createNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;

    const channels = [
      {
        id: 'campaigns',
        name: 'Campaign Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'Notifications about new campaigns and assignments'
      },
      {
        id: 'visits',
        name: 'Visit Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Notifications about visit schedules and reminders'
      },
      {
        id: 'sync',
        name: 'Sync Notifications',
        importance: Notifications.AndroidImportance.LOW,
        description: 'Data synchronization status updates'
      },
      {
        id: 'fraud_alerts',
        name: 'Security Alerts',
        importance: Notifications.AndroidImportance.MAX,
        description: 'Security and fraud detection alerts'
      },
      {
        id: 'system',
        name: 'System Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'System updates and maintenance notifications'
      }
    ];

    for (const channel of channels) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        importance: channel.importance,
        description: channel.description,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E3A8A',
        sound: 'default',
      });
    }
  }

  /**
   * Set up notification event listeners
   */
  private setupNotificationListeners(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Handle notification response (user tapped notification)
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  /**
   * Handle notification received
   */
  private async handleNotificationReceived(notification: Notifications.Notification): Promise<void> {
    try {
      const notificationData = notification.request.content.data as NotificationData;
      
      // Add to history
      const historyItem: NotificationHistory = {
        id: notification.request.identifier,
        notification: {
          type: notificationData?.type || 'system',
          recipientId: notificationData?.recipientId || 'unknown',
          title: notification.request.content.title || '',
          message: notification.request.content.body || '',
          data: notificationData?.data,
          priority: notificationData?.priority || 'MEDIUM'
        },
        sentAt: new Date(),
        status: 'DELIVERED'
      };

      this.notificationHistory.push(historyItem);
      await this.saveNotificationHistory();

      // Update badge count
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Handle notification received error:', error);
    }
  }

  /**
   * Handle notification response (user interaction)
   */
  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    try {
      const notificationId = response.notification.request.identifier;
      const notificationData = response.notification.request.content.data as NotificationData;

      // Mark as read
      await this.markNotificationAsRead(notificationId);

      // Handle different notification types
      switch (notificationData?.type) {
        case 'campaign':
          // Navigate to campaigns screen
          console.log('Navigate to campaigns');
          break;
        case 'visit':
          // Navigate to visit details
          console.log('Navigate to visit:', notificationData.data?.visitId);
          break;
        case 'fraud_alert':
          // Show fraud alert details
          console.log('Show fraud alert:', notificationData.data);
          break;
        case 'sync':
          // Navigate to sync status
          console.log('Navigate to sync status');
          break;
        default:
          console.log('Handle generic notification');
      }
    } catch (error) {
      console.error('Handle notification response error:', error);
    }
  }

  /**
   * Show local notification
   */
  async showLocalNotification(
    title: string,
    message: string,
    data?: any,
    options?: {
      type?: NotificationData['type'];
      priority?: NotificationData['priority'];
      scheduledFor?: Date;
      sound?: boolean;
      vibration?: boolean;
    }
  ): Promise<string> {
    try {
      if (!this.settings.enabled) {
        console.log('Notifications disabled');
        return '';
      }

      const notificationType = options?.type || 'system';
      
      // Check if this type is enabled
      if (!this.isNotificationTypeEnabled(notificationType)) {
        console.log(`Notification type ${notificationType} disabled`);
        return '';
      }

      // Check quiet hours
      if (this.isInQuietHours() && options?.priority !== 'URGENT') {
        console.log('In quiet hours, skipping notification');
        return '';
      }

      const notificationContent: Notifications.NotificationContentInput = {
        title,
        body: message,
        data: {
          type: notificationType,
          priority: options?.priority || 'MEDIUM',
          ...data
        },
        sound: (options?.sound !== false && this.settings.sound) ? 'default' : undefined,
        vibrate: (options?.vibration !== false && this.settings.vibration) ? [0, 250, 250, 250] : undefined,
      };

      // Set notification channel for Android
      if (Platform.OS === 'android') {
        notificationContent.categoryIdentifier = notificationType;
      }

      let notificationId: string;

      if (options?.scheduledFor) {
        // Schedule notification
        notificationId = await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            date: options.scheduledFor,
          },
        });
      } else {
        // Show immediate notification
        notificationId = await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: null, // Show immediately
        });
      }

      // Add to history
      const historyItem: NotificationHistory = {
        id: notificationId,
        notification: {
          type: notificationType,
          recipientId: await AsyncStorage.getItem('userId') || 'unknown',
          title,
          message,
          data,
          priority: options?.priority || 'MEDIUM',
          scheduledFor: options?.scheduledFor
        },
        sentAt: new Date(),
        status: 'SENT'
      };

      this.notificationHistory.push(historyItem);
      await this.saveNotificationHistory();

      return notificationId;
    } catch (error) {
      console.error('Show local notification error:', error);
      return '';
    }
  }

  /**
   * Cancel notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      
      // Update history
      const historyItem = this.notificationHistory.find(item => item.id === notificationId);
      if (historyItem) {
        historyItem.status = 'DISMISSED';
        await this.saveNotificationHistory();
      }
    } catch (error) {
      console.error('Cancel notification error:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      
      // Update history
      this.notificationHistory.forEach(item => {
        if (item.status === 'SENT') {
          item.status = 'DISMISSED';
        }
      });
      await this.saveNotificationHistory();
    } catch (error) {
      console.error('Cancel all notifications error:', error);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const historyItem = this.notificationHistory.find(item => item.id === notificationId);
      if (historyItem && !historyItem.readAt) {
        historyItem.readAt = new Date();
        historyItem.status = 'READ';
        await this.saveNotificationHistory();
        await this.updateBadgeCount();
      }
    } catch (error) {
      console.error('Mark notification as read error:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      let hasChanges = false;
      
      this.notificationHistory.forEach(item => {
        if (!item.readAt) {
          item.readAt = new Date();
          item.status = 'READ';
          hasChanges = true;
        }
      });

      if (hasChanges) {
        await this.saveNotificationHistory();
        await this.updateBadgeCount();
      }
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
    }
  }

  /**
   * Update badge count
   */
  private async updateBadgeCount(): Promise<void> {
    try {
      if (!this.settings.badge) return;

      const unreadCount = this.notificationHistory.filter(item => !item.readAt).length;
      await Notifications.setBadgeCountAsync(unreadCount);
    } catch (error) {
      console.error('Update badge count error:', error);
    }
  }

  /**
   * Get notification history
   */
  getNotificationHistory(limit?: number): NotificationHistory[] {
    const history = [...this.notificationHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get unread notifications
   */
  getUnreadNotifications(): NotificationHistory[] {
    return this.notificationHistory.filter(item => !item.readAt);
  }

  /**
   * Clear notification history
   */
  async clearNotificationHistory(): Promise<void> {
    try {
      this.notificationHistory = [];
      await AsyncStorage.removeItem('notificationHistory');
      await this.updateBadgeCount();
    } catch (error) {
      console.error('Clear notification history error:', error);
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(newSettings: Partial<NotificationSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Update notification settings error:', error);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Check if notification should be shown
   */
  private async shouldShowNotification(notification: Notifications.Notification): Promise<boolean> {
    if (!this.settings.enabled) return false;

    const notificationData = notification.request.content.data as NotificationData;
    const notificationType = notificationData?.type || 'system';

    // Check if type is enabled
    if (!this.isNotificationTypeEnabled(notificationType)) return false;

    // Check quiet hours (except for urgent notifications)
    if (this.isInQuietHours() && notificationData?.priority !== 'URGENT') return false;

    return true;
  }

  /**
   * Check if notification type is enabled
   */
  private isNotificationTypeEnabled(type: NotificationData['type']): boolean {
    switch (type) {
      case 'campaign':
        return this.settings.types.campaigns;
      case 'visit':
        return this.settings.types.visits;
      case 'sync':
        return this.settings.types.sync;
      case 'fraud_alert':
        return this.settings.types.fraudAlerts;
      case 'system':
      case 'success':
      case 'error':
        return this.settings.types.system;
      default:
        return true;
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  private isInQuietHours(): boolean {
    if (!this.settings.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

    const [startHour, startMinute] = this.settings.quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = this.settings.quietHours.end.split(':').map(Number);

    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      // Same day range (e.g., 22:00 to 23:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight range (e.g., 22:00 to 07:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notificationSettings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Load notification settings error:', error);
    }
  }

  /**
   * Load notification history from storage
   */
  private async loadNotificationHistory(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notificationHistory');
      if (stored) {
        this.notificationHistory = JSON.parse(stored).map((item: any) => ({
          ...item,
          sentAt: new Date(item.sentAt),
          readAt: item.readAt ? new Date(item.readAt) : undefined
        }));
      }
    } catch (error) {
      console.error('Load notification history error:', error);
    }
  }

  /**
   * Save notification history to storage
   */
  private async saveNotificationHistory(): Promise<void> {
    try {
      // Keep only last 500 notifications
      if (this.notificationHistory.length > 500) {
        this.notificationHistory = this.notificationHistory.slice(-500);
      }

      await AsyncStorage.setItem('notificationHistory', JSON.stringify(this.notificationHistory));
    } catch (error) {
      console.error('Save notification history error:', error);
    }
  }

  /**
   * Get push token for server registration
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Test notification (for debugging)
   */
  async testNotification(): Promise<void> {
    await this.showLocalNotification(
      'Test Notification',
      'This is a test notification from SalesSync',
      { test: true },
      { type: 'system', priority: 'MEDIUM' }
    );
  }

  /**
   * Get notification statistics
   */
  getNotificationStatistics(): any {
    const total = this.notificationHistory.length;
    const unread = this.notificationHistory.filter(item => !item.readAt).length;
    const byType = this.notificationHistory.reduce((acc, item) => {
      acc[item.notification.type] = (acc[item.notification.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return {
      total,
      unread,
      read: total - unread,
      byType,
      settings: this.settings
    };
  }
}

export default NotificationService;