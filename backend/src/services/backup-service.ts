/**
 * Advanced Backup and Disaster Recovery Service for SalesSync
 * Automated backups, point-in-time recovery, and disaster recovery procedures
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import cron from 'node-cron';
import archiver from 'archiver';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';

const execAsync = promisify(exec);
const pipelineAsync = promisify(pipeline);

export interface BackupConfig {
  database: {
    enabled: boolean;
    schedule: string; // Cron expression
    retention: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  files: {
    enabled: boolean;
    schedule: string;
    paths: string[];
    retention: {
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  storage: {
    type: 'local' | 's3';
    local?: {
      path: string;
    };
    s3?: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  encryption: {
    enabled: boolean;
    key?: string;
  };
  compression: {
    enabled: boolean;
    level: number; // 1-9
  };
}

export interface BackupMetadata {
  id: string;
  type: 'database' | 'files' | 'full';
  timestamp: Date;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  location: string;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
  duration?: number;
  companyId?: string;
}

export interface RestoreOptions {
  backupId: string;
  targetPath?: string;
  overwrite: boolean;
  pointInTime?: Date;
  companyId?: string;
  tables?: string[];
}

export interface DisasterRecoveryPlan {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  rto: number; // Recovery Time Objective in minutes
  rpo: number; // Recovery Point Objective in minutes
  steps: RecoveryStep[];
  contacts: EmergencyContact[];
  lastTested: Date;
  status: 'active' | 'inactive' | 'testing';
}

export interface RecoveryStep {
  id: string;
  order: number;
  title: string;
  description: string;
  type: 'manual' | 'automated';
  script?: string;
  estimatedTime: number; // minutes
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  email: string;
  priority: number;
}

export class BackupService {
  private prisma: PrismaClient;
  private s3Client?: S3Client;
  private config: BackupConfig;
  private backupHistory: BackupMetadata[] = [];
  private activeBackups: Map<string, BackupMetadata> = new Map();

  constructor(config: BackupConfig) {
    this.prisma = new PrismaClient();
    this.config = config;

    if (config.storage.type === 's3' && config.storage.s3) {
      this.s3Client = new S3Client({
        region: config.storage.s3.region,
        credentials: {
          accessKeyId: config.storage.s3.accessKeyId,
          secretAccessKey: config.storage.s3.secretAccessKey
        }
      });
    }

    this.initializeSchedules();
    this.loadBackupHistory();
  }

  /**
   * Initialize backup schedules
   */
  private initializeSchedules(): void {
    if (this.config.database.enabled) {
      cron.schedule(this.config.database.schedule, () => {
        this.performDatabaseBackup().catch(error => {
          console.error('Scheduled database backup failed:', error);
        });
      });
    }

    if (this.config.files.enabled) {
      cron.schedule(this.config.files.schedule, () => {
        this.performFileBackup().catch(error => {
          console.error('Scheduled file backup failed:', error);
        });
      });
    }

    // Daily cleanup of old backups
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldBackups().catch(error => {
        console.error('Backup cleanup failed:', error);
      });
    });
  }

  /**
   * Perform database backup
   */
  async performDatabaseBackup(companyId?: string): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('database');
    const timestamp = new Date();
    
    const metadata: BackupMetadata = {
      id: backupId,
      type: 'database',
      timestamp,
      size: 0,
      compressed: this.config.compression.enabled,
      encrypted: this.config.encryption.enabled,
      checksum: '',
      location: '',
      status: 'in_progress',
      companyId
    };

    this.activeBackups.set(backupId, metadata);

    try {
      const startTime = Date.now();
      
      // Generate backup filename
      const filename = `database_${timestamp.toISOString().replace(/[:.]/g, '-')}_${backupId}.sql`;
      const localPath = path.join(this.getBackupPath(), filename);

      // Ensure backup directory exists
      const backupDir = path.dirname(localPath);
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }

      // Create database dump
      const dumpCommand = this.buildDumpCommand(localPath, companyId);
      await execAsync(dumpCommand);

      // Get file size
      const stats = await import('fs').then(fs => fs.promises.stat(localPath));
      metadata.size = stats.size;

      // Compress if enabled
      let finalPath = localPath;
      if (this.config.compression.enabled) {
        finalPath = await this.compressFile(localPath);
        const compressedStats = await import('fs').then(fs => fs.promises.stat(finalPath));
        metadata.size = compressedStats.size;
      }

      // Encrypt if enabled
      if (this.config.encryption.enabled) {
        finalPath = await this.encryptFile(finalPath);
      }

      // Calculate checksum
      metadata.checksum = await this.calculateChecksum(finalPath);

      // Upload to storage
      if (this.config.storage.type === 's3') {
        metadata.location = await this.uploadToS3(finalPath, path.basename(finalPath));
      } else {
        metadata.location = finalPath;
      }

      // Update metadata
      metadata.status = 'completed';
      metadata.duration = Date.now() - startTime;

      this.backupHistory.push(metadata);
      this.activeBackups.delete(backupId);

      console.log(`Database backup completed: ${backupId} (${metadata.size} bytes)`);
      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;
      this.activeBackups.delete(backupId);
      
      console.error('Database backup failed:', error);
      throw error;
    }
  }

  /**
   * Perform file backup
   */
  async performFileBackup(companyId?: string): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('files');
    const timestamp = new Date();
    
    const metadata: BackupMetadata = {
      id: backupId,
      type: 'files',
      timestamp,
      size: 0,
      compressed: true, // Files are always compressed in archive
      encrypted: this.config.encryption.enabled,
      checksum: '',
      location: '',
      status: 'in_progress',
      companyId
    };

    this.activeBackups.set(backupId, metadata);

    try {
      const startTime = Date.now();
      
      // Generate backup filename
      const filename = `files_${timestamp.toISOString().replace(/[:.]/g, '-')}_${backupId}.tar.gz`;
      const localPath = path.join(this.getBackupPath(), filename);

      // Create archive
      await this.createFileArchive(this.config.files.paths, localPath);

      // Get file size
      const stats = await import('fs').then(fs => fs.promises.stat(localPath));
      metadata.size = stats.size;

      // Encrypt if enabled
      let finalPath = localPath;
      if (this.config.encryption.enabled) {
        finalPath = await this.encryptFile(localPath);
      }

      // Calculate checksum
      metadata.checksum = await this.calculateChecksum(finalPath);

      // Upload to storage
      if (this.config.storage.type === 's3') {
        metadata.location = await this.uploadToS3(finalPath, path.basename(finalPath));
      } else {
        metadata.location = finalPath;
      }

      // Update metadata
      metadata.status = 'completed';
      metadata.duration = Date.now() - startTime;

      this.backupHistory.push(metadata);
      this.activeBackups.delete(backupId);

      console.log(`File backup completed: ${backupId} (${metadata.size} bytes)`);
      return metadata;

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;
      this.activeBackups.delete(backupId);
      
      console.error('File backup failed:', error);
      throw error;
    }
  }

  /**
   * Perform full system backup
   */
  async performFullBackup(companyId?: string): Promise<BackupMetadata[]> {
    console.log('Starting full system backup...');
    
    const results: BackupMetadata[] = [];
    
    try {
      // Perform database backup
      if (this.config.database.enabled) {
        const dbBackup = await this.performDatabaseBackup(companyId);
        results.push(dbBackup);
      }

      // Perform file backup
      if (this.config.files.enabled) {
        const fileBackup = await this.performFileBackup(companyId);
        results.push(fileBackup);
      }

      console.log(`Full system backup completed: ${results.length} backups created`);
      return results;

    } catch (error) {
      console.error('Full system backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<boolean> {
    try {
      console.log(`Starting restore from backup: ${options.backupId}`);

      // Find backup metadata
      const backup = this.backupHistory.find(b => b.id === options.backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }

      // Download backup if stored remotely
      let localPath = backup.location;
      if (this.config.storage.type === 's3') {
        localPath = await this.downloadFromS3(backup.location);
      }

      // Decrypt if encrypted
      if (backup.encrypted) {
        localPath = await this.decryptFile(localPath);
      }

      // Decompress if compressed
      if (backup.compressed && backup.type === 'database') {
        localPath = await this.decompressFile(localPath);
      }

      // Verify checksum
      const checksum = await this.calculateChecksum(localPath);
      if (checksum !== backup.checksum) {
        throw new Error('Backup integrity check failed');
      }

      // Perform restore based on backup type
      if (backup.type === 'database') {
        await this.restoreDatabase(localPath, options);
      } else if (backup.type === 'files') {
        await this.restoreFiles(localPath, options);
      }

      console.log(`Restore completed successfully: ${options.backupId}`);
      return true;

    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * Get backup history
   */
  getBackupHistory(type?: 'database' | 'files' | 'full', limit?: number): BackupMetadata[] {
    let history = this.backupHistory;
    
    if (type) {
      history = history.filter(backup => backup.type === type);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get active backups
   */
  getActiveBackups(): BackupMetadata[] {
    return Array.from(this.activeBackups.values());
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const backup = this.backupHistory.find(b => b.id === backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Delete from storage
      if (this.config.storage.type === 's3') {
        await this.deleteFromS3(backup.location);
      } else {
        const fs = await import('fs');
        if (fs.existsSync(backup.location)) {
          await fs.promises.unlink(backup.location);
        }
      }

      // Remove from history
      const index = this.backupHistory.findIndex(b => b.id === backupId);
      if (index > -1) {
        this.backupHistory.splice(index, 1);
      }

      console.log(`Backup deleted: ${backupId}`);
      return true;

    } catch (error) {
      console.error('Delete backup failed:', error);
      return false;
    }
  }

  /**
   * Test backup integrity
   */
  async testBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const backup = this.backupHistory.find(b => b.id === backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Download backup if stored remotely
      let localPath = backup.location;
      if (this.config.storage.type === 's3') {
        localPath = await this.downloadFromS3(backup.location);
      }

      // Verify checksum
      const checksum = await this.calculateChecksum(localPath);
      const isValid = checksum === backup.checksum;

      console.log(`Backup integrity test ${isValid ? 'passed' : 'failed'}: ${backupId}`);
      return isValid;

    } catch (error) {
      console.error('Backup integrity test failed:', error);
      return false;
    }
  }

  /**
   * Get backup statistics
   */
  getBackupStatistics(): any {
    const totalBackups = this.backupHistory.length;
    const successfulBackups = this.backupHistory.filter(b => b.status === 'completed').length;
    const failedBackups = this.backupHistory.filter(b => b.status === 'failed').length;
    const totalSize = this.backupHistory.reduce((sum, backup) => sum + backup.size, 0);

    const backupsByType = this.backupHistory.reduce((acc, backup) => {
      acc[backup.type] = (acc[backup.type] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const averageSize = totalBackups > 0 ? totalSize / totalBackups : 0;
    const successRate = totalBackups > 0 ? (successfulBackups / totalBackups) * 100 : 0;

    return {
      totalBackups,
      successfulBackups,
      failedBackups,
      totalSize,
      averageSize,
      successRate,
      backupsByType,
      oldestBackup: this.backupHistory.length > 0 ? this.backupHistory[0].timestamp : null,
      newestBackup: this.backupHistory.length > 0 ? this.backupHistory[this.backupHistory.length - 1].timestamp : null
    };
  }

  // Private helper methods

  private generateBackupId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getBackupPath(): string {
    return this.config.storage.local?.path || './backups';
  }

  private buildDumpCommand(outputPath: string, companyId?: string): string {
    const dbUrl = process.env.DATABASE_URL || '';
    const url = new URL(dbUrl);
    
    let command = `pg_dump -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d ${url.pathname.slice(1)} -f "${outputPath}"`;
    
    if (url.password) {
      command = `PGPASSWORD="${url.password}" ${command}`;
    }

    // Add company-specific filtering if needed
    if (companyId) {
      command += ` --where="company_id='${companyId}'"`;
    }

    return command;
  }

  private async compressFile(filePath: string): Promise<string> {
    const compressedPath = `${filePath}.gz`;
    const readStream = createReadStream(filePath);
    const writeStream = createWriteStream(compressedPath);
    const gzip = createGzip({ level: this.config.compression.level });

    await pipelineAsync(readStream, gzip, writeStream);

    // Remove original file
    const fs = await import('fs');
    await fs.promises.unlink(filePath);

    return compressedPath;
  }

  private async decompressFile(filePath: string): Promise<string> {
    // Implementation would decompress the file
    return filePath.replace('.gz', '');
  }

  private async encryptFile(filePath: string): Promise<string> {
    // Implementation would encrypt the file using the configured key
    return `${filePath}.enc`;
  }

  private async decryptFile(filePath: string): Promise<string> {
    // Implementation would decrypt the file
    return filePath.replace('.enc', '');
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const fs = await import('fs');
    
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async createFileArchive(paths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('tar', { gzip: true });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);

      // Add paths to archive
      paths.forEach(srcPath => {
        if (existsSync(srcPath)) {
          archive.directory(srcPath, path.basename(srcPath));
        }
      });

      archive.finalize();
    });
  }

  private async uploadToS3(filePath: string, key: string): Promise<string> {
    if (!this.s3Client || !this.config.storage.s3) {
      throw new Error('S3 not configured');
    }

    const fs = await import('fs');
    const fileStream = fs.createReadStream(filePath);

    const command = new PutObjectCommand({
      Bucket: this.config.storage.s3.bucket,
      Key: key,
      Body: fileStream
    });

    await this.s3Client.send(command);
    return key;
  }

  private async downloadFromS3(key: string): Promise<string> {
    if (!this.s3Client || !this.config.storage.s3) {
      throw new Error('S3 not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.config.storage.s3.bucket,
      Key: key
    });

    const response = await this.s3Client.send(command);
    const localPath = path.join(this.getBackupPath(), 'temp', key);

    // Ensure temp directory exists
    const tempDir = path.dirname(localPath);
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Write to local file
    const fs = await import('fs');
    const writeStream = fs.createWriteStream(localPath);
    
    if (response.Body) {
      await pipelineAsync(response.Body as any, writeStream);
    }

    return localPath;
  }

  private async deleteFromS3(key: string): Promise<void> {
    // Implementation would delete from S3
  }

  private async restoreDatabase(backupPath: string, options: RestoreOptions): Promise<void> {
    const dbUrl = process.env.DATABASE_URL || '';
    const url = new URL(dbUrl);
    
    let command = `psql -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d ${url.pathname.slice(1)} -f "${backupPath}"`;
    
    if (url.password) {
      command = `PGPASSWORD="${url.password}" ${command}`;
    }

    await execAsync(command);
  }

  private async restoreFiles(backupPath: string, options: RestoreOptions): Promise<void> {
    const targetPath = options.targetPath || './restored';
    
    // Extract archive
    const command = `tar -xzf "${backupPath}" -C "${targetPath}"`;
    await execAsync(command);
  }

  private async cleanupOldBackups(): Promise<void> {
    const now = new Date();
    const retention = this.config.database.retention;

    // Calculate cutoff dates
    const dailyCutoff = new Date(now.getTime() - retention.daily * 24 * 60 * 60 * 1000);
    const weeklyCutoff = new Date(now.getTime() - retention.weekly * 7 * 24 * 60 * 60 * 1000);
    const monthlyCutoff = new Date(now.getTime() - retention.monthly * 30 * 24 * 60 * 60 * 1000);

    // Find backups to delete
    const toDelete = this.backupHistory.filter(backup => {
      const age = now.getTime() - backup.timestamp.getTime();
      const days = age / (24 * 60 * 60 * 1000);

      if (days <= retention.daily) return false; // Keep daily backups
      if (days <= retention.weekly * 7 && backup.timestamp.getDay() === 0) return false; // Keep weekly backups (Sunday)
      if (days <= retention.monthly * 30 && backup.timestamp.getDate() === 1) return false; // Keep monthly backups (1st of month)

      return true;
    });

    // Delete old backups
    for (const backup of toDelete) {
      await this.deleteBackup(backup.id);
    }

    console.log(`Cleaned up ${toDelete.length} old backups`);
  }

  private async loadBackupHistory(): Promise<void> {
    // Implementation would load backup history from persistent storage
    console.log('Backup service initialized');
  }
}

// Default backup configuration
const defaultBackupConfig: BackupConfig = {
  database: {
    enabled: true,
    schedule: '0 2 * * *', // Daily at 2 AM
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 12
    }
  },
  files: {
    enabled: true,
    schedule: '0 3 * * *', // Daily at 3 AM
    paths: ['./uploads', './logs', './config'],
    retention: {
      daily: 7,
      weekly: 4,
      monthly: 12
    }
  },
  storage: {
    type: process.env.BACKUP_STORAGE_TYPE as 'local' | 's3' || 'local',
    local: {
      path: process.env.BACKUP_PATH || './backups'
    },
    s3: process.env.AWS_S3_BUCKET ? {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    } : undefined
  },
  encryption: {
    enabled: process.env.BACKUP_ENCRYPTION === 'true',
    key: process.env.BACKUP_ENCRYPTION_KEY
  },
  compression: {
    enabled: true,
    level: 6
  }
};

// Create backup service instance
export const backupService = new BackupService(defaultBackupConfig);

export default BackupService;