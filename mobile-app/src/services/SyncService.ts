/**
 * Advanced Synchronization Service for SalesSync Mobile App
 * Handles bidirectional sync with conflict resolution and retry logic
 */

import NetInfo from '@react-native-netinfo/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineStorageService } from './OfflineStorageService';
import { NotificationService } from './NotificationService';
import { Alert } from 'react-native';

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsFailed: number;
  conflicts: number;
  errors: string[];
  duration: number; // milliseconds
}

export interface SyncOptions {
  forceSync?: boolean;
  syncTypes?: string[];
  batchSize?: number;
  maxRetries?: number;
  conflictResolution?: 'CLIENT_WINS' | 'SERVER_WINS' | 'MANUAL';
}

export interface SyncProgress {
  phase: 'PREPARING' | 'UPLOADING' | 'DOWNLOADING' | 'RESOLVING_CONFLICTS' | 'COMPLETING';
  progress: number; // 0-100
  currentItem?: string;
  totalItems: number;
  processedItems: number;
}

export interface ConflictResolution {
  itemId: string;
  resolution: 'USE_LOCAL' | 'USE_SERVER' | 'MERGE' | 'SKIP';
  mergedData?: any;
}

export class SyncService {
  private static instance: SyncService;
  private offlineStorage: OfflineStorageService;
  private notifications: NotificationService;
  private isSyncing = false;
  private syncProgress: SyncProgress | null = null;
  private progressCallbacks: ((progress: SyncProgress) => void)[] = [];
  private baseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.offlineStorage = OfflineStorageService.getInstance();
    this.notifications = NotificationService.getInstance();
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://ssai.gonxt.tech';
    this.loadAuthToken();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  /**
   * Load authentication token
   */
  private async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Load auth token error:', error);
    }
  }

  /**
   * Check if device is online
   */
  private async isOnline(): Promise<boolean> {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected && netInfo.isInternetReachable;
  }

  /**
   * Perform full synchronization
   */
  async performFullSync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    if (!await this.isOnline()) {
      throw new Error('No internet connection available');
    }

    if (!this.authToken) {
      throw new Error('Authentication token not available');
    }

    const startTime = Date.now();
    this.isSyncing = true;

    try {
      const {
        forceSync = false,
        syncTypes = ['visit', 'customer', 'sale', 'survey'],
        batchSize = 50,
        maxRetries = 3,
        conflictResolution = 'MANUAL'
      } = options;

      let totalItemsSynced = 0;
      let totalItemsFailed = 0;
      let totalConflicts = 0;
      const allErrors: string[] = [];

      // Phase 1: Prepare sync
      this.updateProgress({
        phase: 'PREPARING',
        progress: 0,
        totalItems: 0,
        processedItems: 0
      });

      // Get items to sync
      const itemsToSync = await this.getItemsToSync(syncTypes, forceSync);
      const totalItems = itemsToSync.length;

      this.updateProgress({
        phase: 'UPLOADING',
        progress: 0,
        totalItems,
        processedItems: 0
      });

      // Phase 2: Upload local changes
      for (let i = 0; i < itemsToSync.length; i += batchSize) {
        const batch = itemsToSync.slice(i, i + batchSize);
        
        try {
          const batchResult = await this.syncBatch(batch, maxRetries);
          totalItemsSynced += batchResult.itemsSynced;
          totalItemsFailed += batchResult.itemsFailed;
          totalConflicts += batchResult.conflicts;
          allErrors.push(...batchResult.errors);

          this.updateProgress({
            phase: 'UPLOADING',
            progress: Math.round(((i + batch.length) / totalItems) * 50),
            totalItems,
            processedItems: i + batch.length
          });
        } catch (error) {
          console.error('Batch sync error:', error);
          allErrors.push(`Batch sync error: ${error.message}`);
          totalItemsFailed += batch.length;
        }
      }

      // Phase 3: Download server changes
      this.updateProgress({
        phase: 'DOWNLOADING',
        progress: 50,
        totalItems,
        processedItems: totalItemsSynced
      });

      try {
        const downloadResult = await this.downloadServerChanges(syncTypes);
        totalItemsSynced += downloadResult.itemsSynced;
        totalItemsFailed += downloadResult.itemsFailed;
        allErrors.push(...downloadResult.errors);

        this.updateProgress({
          phase: 'DOWNLOADING',
          progress: 75,
          totalItems,
          processedItems: totalItemsSynced
        });
      } catch (error) {
        console.error('Download server changes error:', error);
        allErrors.push(`Download error: ${error.message}`);
      }

      // Phase 4: Resolve conflicts
      if (totalConflicts > 0) {
        this.updateProgress({
          phase: 'RESOLVING_CONFLICTS',
          progress: 75,
          totalItems,
          processedItems: totalItemsSynced
        });

        try {
          const conflictResult = await this.resolveConflicts(conflictResolution);
          totalConflicts = conflictResult.remainingConflicts;
        } catch (error) {
          console.error('Conflict resolution error:', error);
          allErrors.push(`Conflict resolution error: ${error.message}`);
        }
      }

      // Phase 5: Complete sync
      this.updateProgress({
        phase: 'COMPLETING',
        progress: 90,
        totalItems,
        processedItems: totalItemsSynced
      });

      // Update last sync timestamp
      await this.offlineStorage.setMetadata('last_sync', Date.now().toString());

      const duration = Date.now() - startTime;
      const result: SyncResult = {
        success: totalItemsFailed === 0 && allErrors.length === 0,
        itemsSynced: totalItemsSynced,
        itemsFailed: totalItemsFailed,
        conflicts: totalConflicts,
        errors: allErrors,
        duration
      };

      this.updateProgress({
        phase: 'COMPLETING',
        progress: 100,
        totalItems,
        processedItems: totalItemsSynced
      });

      // Show completion notification
      await this.notifications.showLocalNotification(
        'Sync Complete',
        `Synced ${totalItemsSynced} items${totalItemsFailed > 0 ? `, ${totalItemsFailed} failed` : ''}`
      );

      return result;

    } catch (error) {
      console.error('Full sync error:', error);
      
      await this.notifications.showLocalNotification(
        'Sync Failed',
        error.message
      );

      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: 0,
        conflicts: 0,
        errors: [error.message],
        duration: Date.now() - startTime
      };
    } finally {
      this.isSyncing = false;
      this.syncProgress = null;
    }
  }

  /**
   * Sync specific visit
   */
  async syncVisit(visit: any): Promise<boolean> {
    try {
      if (!await this.isOnline()) {
        console.log('Offline - visit will be synced later');
        return false;
      }

      const response = await this.makeApiRequest('POST', '/api/v1/field-sales/visits', visit);
      
      if (response.success) {
        await this.offlineStorage.updateSyncStatus(visit.id, 'SYNCED');
        return true;
      } else {
        await this.offlineStorage.updateSyncStatus(visit.id, 'ERROR');
        return false;
      }
    } catch (error) {
      console.error('Sync visit error:', error);
      await this.offlineStorage.updateSyncStatus(visit.id, 'ERROR');
      return false;
    }
  }

  /**
   * Get items that need to be synced
   */
  private async getItemsToSync(syncTypes: string[], forceSync: boolean): Promise<any[]> {
    const itemsToSync: any[] = [];

    for (const type of syncTypes) {
      const items = await this.offlineStorage.getItemsByType(type, {
        syncStatus: forceSync ? undefined : 'LOCAL'
      });
      itemsToSync.push(...items);
    }

    return itemsToSync;
  }

  /**
   * Sync a batch of items
   */
  private async syncBatch(items: any[], maxRetries: number): Promise<SyncResult> {
    let itemsSynced = 0;
    let itemsFailed = 0;
    let conflicts = 0;
    const errors: string[] = [];

    for (const item of items) {
      let retryCount = 0;
      let synced = false;

      while (retryCount < maxRetries && !synced) {
        try {
          const result = await this.syncSingleItem(item);
          
          if (result.success) {
            itemsSynced++;
            synced = true;
          } else if (result.conflict) {
            conflicts++;
            synced = true; // Don't retry conflicts
          } else {
            retryCount++;
            if (retryCount >= maxRetries) {
              itemsFailed++;
              errors.push(`Failed to sync ${item.type} ${item.id}: ${result.error}`);
            } else {
              // Exponential backoff
              await this.delay(Math.pow(2, retryCount) * 1000);
            }
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            itemsFailed++;
            errors.push(`Exception syncing ${item.type} ${item.id}: ${error.message}`);
          } else {
            await this.delay(Math.pow(2, retryCount) * 1000);
          }
        }
      }
    }

    return {
      success: itemsFailed === 0,
      itemsSynced,
      itemsFailed,
      conflicts,
      errors,
      duration: 0
    };
  }

  /**
   * Sync a single item
   */
  private async syncSingleItem(item: any): Promise<{ success: boolean; conflict?: boolean; error?: string }> {
    try {
      const endpoint = this.getEndpointForType(item.type);
      const method = item.syncStatus === 'LOCAL' ? 'POST' : 'PUT';
      
      const response = await this.makeApiRequest(method, endpoint, item.data);

      if (response.success) {
        await this.offlineStorage.updateSyncStatus(item.id, 'SYNCED');
        return { success: true };
      } else if (response.conflict) {
        // Handle conflict
        await this.offlineStorage.handleSyncConflict(
          item.id,
          item.data,
          response.serverData,
          'UPDATE'
        );
        return { success: false, conflict: true };
      } else {
        await this.offlineStorage.updateSyncStatus(item.id, 'ERROR');
        return { success: false, error: response.error };
      }
    } catch (error) {
      await this.offlineStorage.updateSyncStatus(item.id, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  /**
   * Download changes from server
   */
  private async downloadServerChanges(syncTypes: string[]): Promise<SyncResult> {
    let itemsSynced = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    try {
      const lastSync = await this.offlineStorage.getMetadata('last_sync');
      const since = lastSync ? new Date(parseInt(lastSync)) : new Date(0);

      for (const type of syncTypes) {
        try {
          const endpoint = `${this.getEndpointForType(type)}/changes`;
          const response = await this.makeApiRequest('GET', `${endpoint}?since=${since.toISOString()}`);

          if (response.success && response.data) {
            for (const serverItem of response.data) {
              try {
                // Check if we have a local version
                const localItem = await this.offlineStorage.getItem(serverItem.id);

                if (localItem) {
                  // Check for conflicts
                  if (localItem.version !== serverItem.version) {
                    await this.offlineStorage.handleSyncConflict(
                      serverItem.id,
                      localItem.data,
                      serverItem,
                      'UPDATE'
                    );
                  } else {
                    // Update local item
                    await this.offlineStorage.storeItem(type, serverItem, serverItem.id);
                    await this.offlineStorage.updateSyncStatus(serverItem.id, 'SYNCED');
                    itemsSynced++;
                  }
                } else {
                  // New item from server
                  await this.offlineStorage.storeItem(type, serverItem, serverItem.id);
                  await this.offlineStorage.updateSyncStatus(serverItem.id, 'SYNCED');
                  itemsSynced++;
                }
              } catch (error) {
                console.error(`Error processing server item ${serverItem.id}:`, error);
                itemsFailed++;
                errors.push(`Failed to process ${type} ${serverItem.id}: ${error.message}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error downloading ${type} changes:`, error);
          errors.push(`Failed to download ${type} changes: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Download server changes error:', error);
      errors.push(`Download error: ${error.message}`);
    }

    return {
      success: itemsFailed === 0,
      itemsSynced,
      itemsFailed,
      conflicts: 0,
      errors,
      duration: 0
    };
  }

  /**
   * Resolve sync conflicts
   */
  private async resolveConflicts(strategy: 'CLIENT_WINS' | 'SERVER_WINS' | 'MANUAL'): Promise<{ remainingConflicts: number }> {
    // Get all conflicts
    const conflicts = await this.getConflicts();
    let remainingConflicts = conflicts.length;

    if (strategy === 'MANUAL') {
      // Show conflict resolution UI
      await this.showConflictResolutionDialog(conflicts);
      // Count remaining unresolved conflicts
      const unresolvedConflicts = await this.getConflicts();
      remainingConflicts = unresolvedConflicts.length;
    } else {
      // Automatic resolution
      for (const conflict of conflicts) {
        try {
          if (strategy === 'CLIENT_WINS') {
            await this.resolveConflictWithLocalData(conflict);
          } else if (strategy === 'SERVER_WINS') {
            await this.resolveConflictWithServerData(conflict);
          }
          remainingConflicts--;
        } catch (error) {
          console.error('Conflict resolution error:', error);
        }
      }
    }

    return { remainingConflicts };
  }

  /**
   * Get all unresolved conflicts
   */
  private async getConflicts(): Promise<any[]> {
    // Implementation would query the conflicts table
    return [];
  }

  /**
   * Show conflict resolution dialog
   */
  private async showConflictResolutionDialog(conflicts: any[]): Promise<void> {
    if (conflicts.length === 0) return;

    Alert.alert(
      'Sync Conflicts',
      `${conflicts.length} conflicts need resolution. Please resolve them manually.`,
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Resolve Now', onPress: () => this.openConflictResolutionScreen(conflicts) }
      ]
    );
  }

  /**
   * Open conflict resolution screen
   */
  private openConflictResolutionScreen(conflicts: any[]): void {
    // Implementation would navigate to conflict resolution screen
    console.log('Opening conflict resolution screen for', conflicts.length, 'conflicts');
  }

  /**
   * Resolve conflict with local data
   */
  private async resolveConflictWithLocalData(conflict: any): Promise<void> {
    // Keep local version, sync to server
    const endpoint = this.getEndpointForType(conflict.type);
    await this.makeApiRequest('PUT', `${endpoint}/${conflict.itemId}`, conflict.localData);
    await this.offlineStorage.updateSyncStatus(conflict.itemId, 'SYNCED');
  }

  /**
   * Resolve conflict with server data
   */
  private async resolveConflictWithServerData(conflict: any): Promise<void> {
    // Use server version, update local
    await this.offlineStorage.storeItem(conflict.type, conflict.serverData, conflict.itemId);
    await this.offlineStorage.updateSyncStatus(conflict.itemId, 'SYNCED');
  }

  /**
   * Make API request with authentication
   */
  private async makeApiRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: any = {
      'Content-Type': 'application/json'
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const config: any = {
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      if (response.status === 409) {
        // Conflict
        const conflictData = await response.json();
        return {
          success: false,
          conflict: true,
          serverData: conflictData.serverData
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    return await response.json();
  }

  /**
   * Get API endpoint for data type
   */
  private getEndpointForType(type: string): string {
    const endpoints: { [key: string]: string } = {
      visit: '/api/v1/field-sales/visits',
      customer: '/api/v1/customers',
      sale: '/api/v1/field-sales/sales',
      survey: '/api/v1/surveys',
      product: '/api/v1/products'
    };

    return endpoints[type] || `/api/v1/${type}s`;
  }

  /**
   * Update sync progress
   */
  private updateProgress(progress: SyncProgress): void {
    this.syncProgress = progress;
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  /**
   * Subscribe to sync progress updates
   */
  onSyncProgress(callback: (progress: SyncProgress) => void): () => void {
    this.progressCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current sync progress
   */
  getCurrentProgress(): SyncProgress | null {
    return this.syncProgress;
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Cancel ongoing sync
   */
  async cancelSync(): Promise<void> {
    if (this.isSyncing) {
      this.isSyncing = false;
      await this.notifications.showLocalNotification(
        'Sync Cancelled',
        'Synchronization was cancelled by user'
      );
    }
  }

  /**
   * Schedule automatic sync
   */
  async scheduleAutoSync(intervalMinutes: number = 30): Promise<void> {
    // Implementation would use background tasks
    console.log(`Auto sync scheduled every ${intervalMinutes} minutes`);
  }

  /**
   * Perform quick sync for critical data
   */
  async performQuickSync(itemIds: string[]): Promise<SyncResult> {
    const startTime = Date.now();
    let itemsSynced = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    if (!await this.isOnline()) {
      return {
        success: false,
        itemsSynced: 0,
        itemsFailed: itemIds.length,
        conflicts: 0,
        errors: ['No internet connection'],
        duration: Date.now() - startTime
      };
    }

    for (const itemId of itemIds) {
      try {
        const item = await this.offlineStorage.getItem(itemId);
        if (item) {
          const result = await this.syncSingleItem(item);
          if (result.success) {
            itemsSynced++;
          } else {
            itemsFailed++;
            errors.push(result.error || 'Unknown error');
          }
        } else {
          itemsFailed++;
          errors.push(`Item ${itemId} not found`);
        }
      } catch (error) {
        itemsFailed++;
        errors.push(`Error syncing ${itemId}: ${error.message}`);
      }
    }

    return {
      success: itemsFailed === 0,
      itemsSynced,
      itemsFailed,
      conflicts: 0,
      errors,
      duration: Date.now() - startTime
    };
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get sync statistics
   */
  async getSyncStatistics(): Promise<any> {
    const stats = await this.offlineStorage.getStorageStats();
    const lastSync = await this.offlineStorage.getMetadata('last_sync');
    
    return {
      ...stats,
      lastSync: lastSync ? new Date(parseInt(lastSync)) : null,
      isSyncing: this.isSyncing,
      currentProgress: this.syncProgress
    };
  }
}

export default SyncService;