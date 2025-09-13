import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineService } from '../services/offlineService';

interface OfflineContextType {
  isOnline: boolean;
  pendingSyncCount: number;
  syncData: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(online || false);
      
      // Auto-sync when coming back online
      if (online && !isOnline) {
        syncData();
      }
    });

    // Load initial sync count
    loadPendingSyncCount();
    loadLastSyncTime();

    return unsubscribe;
  }, []);

  const loadPendingSyncCount = async () => {
    try {
      const count = await offlineService.getPendingSyncCount();
      setPendingSyncCount(count);
    } catch (error) {
      console.error('Error loading pending sync count:', error);
    }
  };

  const loadLastSyncTime = async () => {
    try {
      const lastSync = await AsyncStorage.getItem('lastSyncTime');
      if (lastSync) {
        setLastSyncTime(new Date(lastSync));
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  };

  const syncData = async () => {
    if (isSyncing || !isOnline) return;

    try {
      setIsSyncing(true);
      
      // Sync pending data
      await offlineService.syncPendingData();
      
      // Update counts and timestamps
      await loadPendingSyncCount();
      const now = new Date();
      setLastSyncTime(now);
      await AsyncStorage.setItem('lastSyncTime', now.toISOString());
      
      console.log('Data sync completed successfully');
    } catch (error) {
      console.error('Data sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const value: OfflineContextType = {
    isOnline,
    pendingSyncCount,
    syncData,
    isSyncing,
    lastSyncTime,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};