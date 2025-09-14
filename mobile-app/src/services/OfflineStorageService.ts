/**
 * Advanced Offline Storage Service for SalesSync Mobile App
 * Handles local data storage, synchronization, and conflict resolution
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';

export interface StorageItem {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  syncStatus: 'LOCAL' | 'SYNCING' | 'SYNCED' | 'ERROR' | 'CONFLICT';
  version: number;
  checksum?: string;
}

export interface SyncConflict {
  id: string;
  localData: any;
  serverData: any;
  conflictType: 'UPDATE' | 'DELETE' | 'CREATE';
  timestamp: Date;
  resolved: boolean;
}

export interface StorageStats {
  totalItems: number;
  localItems: number;
  syncedItems: number;
  errorItems: number;
  conflictItems: number;
  storageSize: number; // bytes
  lastSync: Date | null;
}

export class OfflineStorageService {
  private static instance: OfflineStorageService;
  private db: SQLite.WebSQLDatabase | null = null;
  private isInitialized = false;
  private syncQueue: StorageItem[] = [];
  private conflictQueue: SyncConflict[] = [];

  constructor() {
    this.initialize();
  }

  static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  /**
   * Initialize the offline storage system
   */
  private async initialize(): Promise<void> {
    try {
      // Open SQLite database
      this.db = SQLite.openDatabase('salessync_offline.db');
      
      // Create tables
      await this.createTables();
      
      // Load sync queue
      await this.loadSyncQueue();
      
      // Load conflict queue
      await this.loadConflictQueue();
      
      this.isInitialized = true;
      console.log('Offline storage initialized successfully');
    } catch (error) {
      console.error('Offline storage initialization error:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        // Main storage table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS storage_items (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            sync_status TEXT NOT NULL DEFAULT 'LOCAL',
            version INTEGER NOT NULL DEFAULT 1,
            checksum TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `);

        // Sync queue table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 0,
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_attempt INTEGER,
            error_message TEXT,
            created_at INTEGER NOT NULL
          )
        `);

        // Conflict resolution table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sync_conflicts (
            id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            local_data TEXT NOT NULL,
            server_data TEXT NOT NULL,
            conflict_type TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            resolved INTEGER NOT NULL DEFAULT 0,
            resolution_data TEXT
          )
        `);

        // Metadata table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS storage_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `);

        // File attachments table
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS file_attachments (
            id TEXT PRIMARY KEY,
            item_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            checksum TEXT NOT NULL,
            uploaded INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
          )
        `);

        // Create indexes
        tx.executeSql('CREATE INDEX IF NOT EXISTS idx_storage_type ON storage_items(type)');
        tx.executeSql('CREATE INDEX IF NOT EXISTS idx_storage_sync_status ON storage_items(sync_status)');
        tx.executeSql('CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority DESC)');
        tx.executeSql('CREATE INDEX IF NOT EXISTS idx_file_attachments_item ON file_attachments(item_id)');
      }, 
      (error) => {
        console.error('Create tables error:', error);
        reject(error);
      },
      () => {
        console.log('Database tables created successfully');
        resolve();
      });
    });
  }

  /**
   * Store item with automatic versioning and conflict detection
   */
  async storeItem(type: string, data: any, id?: string): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const itemId = id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const checksum = this.calculateChecksum(JSON.stringify(data));

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        // Check if item exists
        tx.executeSql(
          'SELECT version, checksum FROM storage_items WHERE id = ?',
          [itemId],
          (_, result) => {
            let version = 1;
            if (result.rows.length > 0) {
              const existingItem = result.rows.item(0);
              version = existingItem.version + 1;
              
              // Check for conflicts
              if (existingItem.checksum !== checksum) {
                console.log(`Version conflict detected for item ${itemId}`);
              }
            }

            // Insert or update item
            tx.executeSql(
              `INSERT OR REPLACE INTO storage_items 
               (id, type, data, timestamp, sync_status, version, checksum, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                itemId,
                type,
                JSON.stringify(data),
                timestamp,
                'LOCAL',
                version,
                checksum,
                timestamp,
                timestamp
              ],
              () => {
                // Add to sync queue
                this.addToSyncQueue(itemId, 'UPSERT');
                resolve(itemId);
              },
              (_, error) => {
                console.error('Store item error:', error);
                reject(error);
                return false;
              }
            );
          },
          (_, error) => {
            console.error('Check existing item error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Retrieve item by ID
   */
  async getItem(id: string): Promise<StorageItem | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM storage_items WHERE id = ?',
          [id],
          (_, result) => {
            if (result.rows.length > 0) {
              const row = result.rows.item(0);
              const item: StorageItem = {
                id: row.id,
                type: row.type,
                data: JSON.parse(row.data),
                timestamp: new Date(row.timestamp),
                syncStatus: row.sync_status,
                version: row.version,
                checksum: row.checksum
              };
              resolve(item);
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            console.error('Get item error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Retrieve items by type with filtering and pagination
   */
  async getItemsByType(
    type: string,
    options?: {
      syncStatus?: string;
      limit?: number;
      offset?: number;
      orderBy?: 'timestamp' | 'updated_at';
      orderDirection?: 'ASC' | 'DESC';
    }
  ): Promise<StorageItem[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      syncStatus,
      limit = 100,
      offset = 0,
      orderBy = 'timestamp',
      orderDirection = 'DESC'
    } = options || {};

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      let query = 'SELECT * FROM storage_items WHERE type = ?';
      const params: any[] = [type];

      if (syncStatus) {
        query += ' AND sync_status = ?';
        params.push(syncStatus);
      }

      query += ` ORDER BY ${orderBy} ${orderDirection} LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      this.db.transaction(tx => {
        tx.executeSql(
          query,
          params,
          (_, result) => {
            const items: StorageItem[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              items.push({
                id: row.id,
                type: row.type,
                data: JSON.parse(row.data),
                timestamp: new Date(row.timestamp),
                syncStatus: row.sync_status,
                version: row.version,
                checksum: row.checksum
              });
            }
            resolve(items);
          },
          (_, error) => {
            console.error('Get items by type error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Delete item
   */
  async deleteItem(id: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM storage_items WHERE id = ?',
          [id],
          (_, result) => {
            if (result.rowsAffected > 0) {
              // Add to sync queue for deletion
              this.addToSyncQueue(id, 'DELETE');
              resolve(true);
            } else {
              resolve(false);
            }
          },
          (_, error) => {
            console.error('Delete item error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Store file attachment
   */
  async storeFileAttachment(
    itemId: string,
    filePath: string,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Calculate checksum
      const fileContent = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.Base64
      });
      const checksum = this.calculateChecksum(fileContent);

      // Create unique file ID
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Copy file to app's document directory
      const documentsDir = FileSystem.documentDirectory;
      const newFilePath = `${documentsDir}attachments/${fileId}_${fileName}`;
      
      // Ensure attachments directory exists
      await FileSystem.makeDirectoryAsync(`${documentsDir}attachments/`, { intermediates: true });
      
      // Copy file
      await FileSystem.copyAsync({
        from: filePath,
        to: newFilePath
      });

      // Store in database
      return new Promise((resolve, reject) => {
        if (!this.db) {
          reject(new Error('Database not initialized'));
          return;
        }

        this.db.transaction(tx => {
          tx.executeSql(
            `INSERT INTO file_attachments 
             (id, item_id, file_path, file_name, file_size, mime_type, checksum, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              fileId,
              itemId,
              newFilePath,
              fileName,
              fileInfo.size,
              mimeType,
              checksum,
              Date.now()
            ],
            () => {
              resolve(fileId);
            },
            (_, error) => {
              console.error('Store file attachment error:', error);
              reject(error);
              return false;
            }
          );
        });
      });
    } catch (error) {
      console.error('Store file attachment error:', error);
      throw error;
    }
  }

  /**
   * Get file attachments for item
   */
  async getFileAttachments(itemId: string): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM file_attachments WHERE item_id = ?',
          [itemId],
          (_, result) => {
            const attachments = [];
            for (let i = 0; i < result.rows.length; i++) {
              attachments.push(result.rows.item(i));
            }
            resolve(attachments);
          },
          (_, error) => {
            console.error('Get file attachments error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Add item to sync queue
   */
  private async addToSyncQueue(itemId: string, operation: 'UPSERT' | 'DELETE', priority: number = 0): Promise<void> {
    if (!this.db) return;

    const queueId = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      this.db!.transaction(tx => {
        tx.executeSql(
          `INSERT INTO sync_queue (id, item_id, operation, priority, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [queueId, itemId, operation, priority, Date.now()],
          () => {
            resolve();
          },
          (_, error) => {
            console.error('Add to sync queue error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Get sync queue items
   */
  async getSyncQueue(limit: number = 50): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT sq.*, si.data, si.type 
           FROM sync_queue sq
           LEFT JOIN storage_items si ON sq.item_id = si.id
           ORDER BY sq.priority DESC, sq.created_at ASC
           LIMIT ?`,
          [limit],
          (_, result) => {
            const items = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              items.push({
                queueId: row.id,
                itemId: row.item_id,
                operation: row.operation,
                priority: row.priority,
                retryCount: row.retry_count,
                data: row.data ? JSON.parse(row.data) : null,
                type: row.type
              });
            }
            resolve(items);
          },
          (_, error) => {
            console.error('Get sync queue error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Remove item from sync queue
   */
  async removeFromSyncQueue(queueId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.transaction(tx => {
        tx.executeSql(
          'DELETE FROM sync_queue WHERE id = ?',
          [queueId],
          () => {
            resolve();
          },
          (_, error) => {
            console.error('Remove from sync queue error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Update sync status
   */
  async updateSyncStatus(itemId: string, status: StorageItem['syncStatus']): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.transaction(tx => {
        tx.executeSql(
          'UPDATE storage_items SET sync_status = ?, updated_at = ? WHERE id = ?',
          [status, Date.now(), itemId],
          () => {
            resolve();
          },
          (_, error) => {
            console.error('Update sync status error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Handle sync conflict
   */
  async handleSyncConflict(
    itemId: string,
    localData: any,
    serverData: any,
    conflictType: 'UPDATE' | 'DELETE' | 'CREATE'
  ): Promise<void> {
    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO sync_conflicts 
           (id, item_id, local_data, server_data, conflict_type, timestamp)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            conflictId,
            itemId,
            JSON.stringify(localData),
            JSON.stringify(serverData),
            conflictType,
            Date.now()
          ],
          () => {
            // Update item status to conflict
            this.updateSyncStatus(itemId, 'CONFLICT');
            resolve();
          },
          (_, error) => {
            console.error('Handle sync conflict error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(tx => {
        tx.executeSql(
          `SELECT 
             COUNT(*) as total_items,
             SUM(CASE WHEN sync_status = 'LOCAL' THEN 1 ELSE 0 END) as local_items,
             SUM(CASE WHEN sync_status = 'SYNCED' THEN 1 ELSE 0 END) as synced_items,
             SUM(CASE WHEN sync_status = 'ERROR' THEN 1 ELSE 0 END) as error_items,
             SUM(CASE WHEN sync_status = 'CONFLICT' THEN 1 ELSE 0 END) as conflict_items,
             SUM(LENGTH(data)) as storage_size
           FROM storage_items`,
          [],
          async (_, result) => {
            const row = result.rows.item(0);
            
            // Get last sync time
            const lastSync = await this.getMetadata('last_sync');
            
            const stats: StorageStats = {
              totalItems: row.total_items || 0,
              localItems: row.local_items || 0,
              syncedItems: row.synced_items || 0,
              errorItems: row.error_items || 0,
              conflictItems: row.conflict_items || 0,
              storageSize: row.storage_size || 0,
              lastSync: lastSync ? new Date(parseInt(lastSync)) : null
            };
            
            resolve(stats);
          },
          (_, error) => {
            console.error('Get storage stats error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Store metadata
   */
  async setMetadata(key: string, value: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.transaction(tx => {
        tx.executeSql(
          'INSERT OR REPLACE INTO storage_metadata (key, value, updated_at) VALUES (?, ?, ?)',
          [key, value, Date.now()],
          () => {
            resolve();
          },
          (_, error) => {
            console.error('Set metadata error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Get metadata
   */
  async getMetadata(key: string): Promise<string | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      this.db!.transaction(tx => {
        tx.executeSql(
          'SELECT value FROM storage_metadata WHERE key = ?',
          [key],
          (_, result) => {
            if (result.rows.length > 0) {
              resolve(result.rows.item(0).value);
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            console.error('Get metadata error:', error);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.transaction(tx => {
        tx.executeSql('DELETE FROM storage_items');
        tx.executeSql('DELETE FROM sync_queue');
        tx.executeSql('DELETE FROM sync_conflicts');
        tx.executeSql('DELETE FROM file_attachments');
        tx.executeSql('DELETE FROM storage_metadata');
      },
      (error) => {
        console.error('Clear all data error:', error);
        reject(error);
      },
      () => {
        console.log('All data cleared successfully');
        resolve();
      });
    });
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: string): string {
    let hash = 0;
    if (data.length === 0) return hash.toString();
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Load sync queue into memory
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueItems = await this.getSyncQueue();
      this.syncQueue = queueItems;
    } catch (error) {
      console.error('Load sync queue error:', error);
    }
  }

  /**
   * Load conflict queue into memory
   */
  private async loadConflictQueue(): Promise<void> {
    // Implementation for loading conflicts
  }

  // Convenience methods for specific data types

  async saveVisit(visit: any): Promise<string> {
    return this.storeItem('visit', visit, visit.id);
  }

  async getVisit(visitId: string): Promise<any> {
    const item = await this.getItem(visitId);
    return item ? item.data : null;
  }

  async getActiveVisit(customerId: string): Promise<any> {
    const visits = await this.getItemsByType('visit', { syncStatus: 'LOCAL' });
    return visits.find(v => v.data.customerId === customerId && v.data.status !== 'COMPLETED')?.data || null;
  }

  async saveCustomer(customer: any): Promise<string> {
    return this.storeItem('customer', customer, customer.id);
  }

  async getCustomer(customerId: string): Promise<any> {
    const item = await this.getItem(customerId);
    return item ? item.data : null;
  }

  async saveLocationPoint(location: any): Promise<string> {
    return this.storeItem('location', location);
  }

  async getLocationHistory(): Promise<any[]> {
    const items = await this.getItemsByType('location', { limit: 1000 });
    return items.map(item => item.data);
  }

  async saveMovementData(movement: any): Promise<string> {
    return this.storeItem('movement', movement);
  }
}

export default OfflineStorageService;