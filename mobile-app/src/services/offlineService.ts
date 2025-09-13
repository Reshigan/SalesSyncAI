import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { apiService } from './apiService';

interface PendingSync {
  id: string;
  type: 'visit' | 'survey' | 'interaction' | 'photo';
  data: any;
  timestamp: string;
  retryCount: number;
}

class OfflineService {
  private db: SQLite.WebSQLDatabase;

  constructor() {
    this.db = SQLite.openDatabase('salessync_offline.db');
    this.initializeDatabase();
  }

  private initializeDatabase() {
    this.db.transaction(tx => {
      // Pending sync table
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS pending_sync (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          data TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          retry_count INTEGER DEFAULT 0
        );
      `);

      // Offline visits table
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS offline_visits (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT,
          location TEXT NOT NULL,
          status TEXT NOT NULL,
          data TEXT NOT NULL
        );
      `);

      // Offline photos table
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS offline_photos (
          id TEXT PRIMARY KEY,
          visit_id TEXT,
          interaction_id TEXT,
          file_path TEXT NOT NULL,
          type TEXT NOT NULL,
          metadata TEXT,
          uploaded INTEGER DEFAULT 0
        );
      `);

      // Offline surveys table
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS offline_surveys (
          id TEXT PRIMARY KEY,
          questionnaire_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          customer_id TEXT,
          responses TEXT NOT NULL,
          completion_time INTEGER,
          timestamp TEXT NOT NULL
        );
      `);
    });
  }

  // Pending sync operations
  async addPendingSync(type: string, data: any): Promise<string> {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'INSERT INTO pending_sync (id, type, data, timestamp) VALUES (?, ?, ?, ?)',
          [id, type, JSON.stringify(data), new Date().toISOString()],
          () => resolve(id),
          (_, error) => reject(error)
        );
      });
    });
  }

  async getPendingSyncCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT COUNT(*) as count FROM pending_sync',
          [],
          (_, result) => resolve(result.rows.item(0).count),
          (_, error) => reject(error)
        );
      });
    });
  }

  async getPendingSyncItems(): Promise<PendingSync[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM pending_sync ORDER BY timestamp ASC',
          [],
          (_, result) => {
            const items: PendingSync[] = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              items.push({
                id: row.id,
                type: row.type,
                data: JSON.parse(row.data),
                timestamp: row.timestamp,
                retryCount: row.retry_count,
              });
            }
            resolve(items);
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  async removePendingSync(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'DELETE FROM pending_sync WHERE id = ?',
          [id],
          () => resolve(),
          (_, error) => reject(error)
        );
      });
    });
  }

  async incrementRetryCount(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'UPDATE pending_sync SET retry_count = retry_count + 1 WHERE id = ?',
          [id],
          () => resolve(),
          (_, error) => reject(error)
        );
      });
    });
  }

  // Visit operations
  async saveOfflineVisit(visit: any): Promise<string> {
    const id = visit.id || `visit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT OR REPLACE INTO offline_visits 
           (id, customer_id, agent_id, start_time, end_time, location, status, data) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            visit.customerId,
            visit.agentId,
            visit.startTime,
            visit.endTime || null,
            JSON.stringify(visit.location),
            visit.status,
            JSON.stringify(visit)
          ],
          () => resolve(id),
          (_, error) => reject(error)
        );
      });
    });
  }

  async getOfflineVisits(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM offline_visits ORDER BY start_time DESC',
          [],
          (_, result) => {
            const visits = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              visits.push({
                ...JSON.parse(row.data),
                id: row.id,
              });
            }
            resolve(visits);
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // Photo operations
  async saveOfflinePhoto(photo: any): Promise<string> {
    const id = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO offline_photos 
           (id, visit_id, interaction_id, file_path, type, metadata) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            photo.visitId || null,
            photo.interactionId || null,
            photo.filePath,
            photo.type,
            JSON.stringify(photo.metadata || {})
          ],
          () => resolve(id),
          (_, error) => reject(error)
        );
      });
    });
  }

  async getUnuploadedPhotos(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM offline_photos WHERE uploaded = 0',
          [],
          (_, result) => {
            const photos = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              photos.push({
                id: row.id,
                visitId: row.visit_id,
                interactionId: row.interaction_id,
                filePath: row.file_path,
                type: row.type,
                metadata: JSON.parse(row.metadata),
              });
            }
            resolve(photos);
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  async markPhotoUploaded(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'UPDATE offline_photos SET uploaded = 1 WHERE id = ?',
          [id],
          () => resolve(),
          (_, error) => reject(error)
        );
      });
    });
  }

  // Survey operations
  async saveOfflineSurvey(survey: any): Promise<string> {
    const id = `survey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          `INSERT INTO offline_surveys 
           (id, questionnaire_id, agent_id, customer_id, responses, completion_time, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            survey.questionnaireId,
            survey.agentId,
            survey.customerId || null,
            JSON.stringify(survey.responses),
            survey.completionTime || 0,
            new Date().toISOString()
          ],
          () => resolve(id),
          (_, error) => reject(error)
        );
      });
    });
  }

  async getOfflineSurveys(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM offline_surveys ORDER BY timestamp DESC',
          [],
          (_, result) => {
            const surveys = [];
            for (let i = 0; i < result.rows.length; i++) {
              const row = result.rows.item(i);
              surveys.push({
                id: row.id,
                questionnaireId: row.questionnaire_id,
                agentId: row.agent_id,
                customerId: row.customer_id,
                responses: JSON.parse(row.responses),
                completionTime: row.completion_time,
                timestamp: row.timestamp,
              });
            }
            resolve(surveys);
          },
          (_, error) => reject(error)
        );
      });
    });
  }

  // Sync operations
  async syncPendingData(): Promise<void> {
    const pendingItems = await this.getPendingSyncItems();
    
    for (const item of pendingItems) {
      try {
        await this.syncItem(item);
        await this.removePendingSync(item.id);
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        
        // Increment retry count
        await this.incrementRetryCount(item.id);
        
        // Remove item if retry count exceeds limit
        if (item.retryCount >= 3) {
          console.warn(`Removing item ${item.id} after 3 failed attempts`);
          await this.removePendingSync(item.id);
        }
      }
    }

    // Sync photos
    await this.syncPhotos();
  }

  private async syncItem(item: PendingSync): Promise<void> {
    switch (item.type) {
      case 'visit':
        await apiService.post('/field-sales/visits', item.data);
        break;
      case 'survey':
        await apiService.post(`/field-marketing/surveys/${item.data.questionnaireId}/responses`, item.data);
        break;
      case 'interaction':
        await apiService.post('/field-marketing/street-marketing/interactions', item.data);
        break;
      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  private async syncPhotos(): Promise<void> {
    const photos = await this.getUnuploadedPhotos();
    
    for (const photo of photos) {
      try {
        // Upload photo file
        const response = await apiService.uploadFile('/upload/photo', {
          uri: photo.filePath,
          type: 'image/jpeg',
          name: `photo_${photo.id}.jpg`,
        });

        if (response.data.success) {
          await this.markPhotoUploaded(photo.id);
        }
      } catch (error) {
        console.error(`Failed to upload photo ${photo.id}:`, error);
      }
    }
  }

  // Cache management
  async clearCache(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.transaction(tx => {
        tx.executeSql('DELETE FROM pending_sync');
        tx.executeSql('DELETE FROM offline_visits');
        tx.executeSql('DELETE FROM offline_photos');
        tx.executeSql('DELETE FROM offline_surveys');
      }, reject, resolve);
    });
  }

  async getCacheSize(): Promise<number> {
    // This would calculate the total size of cached data
    // For now, return count of items
    const pendingCount = await this.getPendingSyncCount();
    return pendingCount;
  }
}

export const offlineService = new OfflineService();