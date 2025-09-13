import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Avatar,
  Chip,
  Surface,
  IconButton,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';
import { theme } from '../../theme/theme';
import { RootStackParamList } from '../../../App';

type DashboardNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { user, logout } = useAuth();
  const { isOnline, pendingSyncCount, syncData, isSyncing, lastSyncTime } = useOffline();
  const [refreshing, setRefreshing] = useState(false);
  const [todayStats, setTodayStats] = useState({
    visits: 0,
    surveys: 0,
    interactions: 0,
    sales: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // Load today's statistics
    // This would fetch from API or local storage
    setTodayStats({
      visits: 5,
      surveys: 12,
      interactions: 8,
      sales: 2450,
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    if (isOnline) {
      await syncData();
    }
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'FIELD_SALES_AGENT':
        return 'Field Sales Agent';
      case 'FIELD_MARKETING_AGENT':
        return 'Marketing Agent';
      case 'PROMOTER':
        return 'Promoter';
      case 'COMPANY_ADMIN':
        return 'Company Admin';
      default:
        return role.replace('_', ' ');
    }
  };

  const getQuickActions = () => {
    const actions = [];

    if (user?.role === 'FIELD_SALES_AGENT' || user?.role === 'SENIOR_AGENT') {
      actions.push(
        {
          title: 'Visit Plan',
          subtitle: 'View today\'s visits',
          icon: 'map-marker-path',
          onPress: () => navigation.navigate('VisitPlan'),
          color: theme.colors.primary,
        }
      );
    }

    if (user?.role === 'FIELD_MARKETING_AGENT' || user?.role === 'SENIOR_AGENT') {
      actions.push(
        {
          title: 'Campaigns',
          subtitle: 'Active marketing campaigns',
          icon: 'bullhorn',
          onPress: () => navigation.navigate('CampaignList'),
          color: theme.colors.accent,
        }
      );
    }

    if (user?.role === 'PROMOTER' || user?.role === 'SENIOR_AGENT') {
      actions.push(
        {
          title: 'Activations',
          subtitle: 'Scheduled activations',
          icon: 'calendar-star',
          onPress: () => navigation.navigate('ActivationList'),
          color: theme.colors.success,
        }
      );
    }

    return actions;
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Avatar.Text
              size={50}
              label={`${user?.profile?.firstName?.[0] || ''}${user?.profile?.lastName?.[0] || ''}`}
              style={styles.avatar}
            />
            <View style={styles.userDetails}>
              <Title style={styles.greeting}>
                {getGreeting()}, {user?.profile?.firstName}!
              </Title>
              <Paragraph style={styles.role}>
                {getRoleDisplayName(user?.role || '')}
              </Paragraph>
            </View>
          </View>
          <IconButton
            icon="logout"
            size={24}
            onPress={handleLogout}
            iconColor={theme.colors.text}
          />
        </View>
      </Surface>

      {/* Connection Status */}
      <Card style={styles.statusCard}>
        <Card.Content style={styles.statusContent}>
          <View style={styles.connectionStatus}>
            <Chip
              icon={isOnline ? 'wifi' : 'wifi-off'}
              style={[
                styles.statusChip,
                { backgroundColor: isOnline ? theme.colors.success : theme.colors.error }
              ]}
              textStyle={{ color: '#FFFFFF' }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Chip>
            {pendingSyncCount > 0 && (
              <Chip
                icon="sync"
                style={[styles.statusChip, { backgroundColor: theme.colors.warning }]}
                textStyle={{ color: '#FFFFFF' }}
              >
                {pendingSyncCount} pending
              </Chip>
            )}
          </View>
          {lastSyncTime && (
            <Paragraph style={styles.lastSync}>
              Last sync: {lastSyncTime.toLocaleTimeString()}
            </Paragraph>
          )}
          {isOnline && pendingSyncCount > 0 && (
            <Button
              mode="outlined"
              onPress={syncData}
              loading={isSyncing}
              disabled={isSyncing}
              style={styles.syncButton}
            >
              Sync Now
            </Button>
          )}
        </Card.Content>
      </Card>

      {/* Today's Stats */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <Title style={styles.sectionTitle}>Today's Activity</Title>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Title style={styles.statNumber}>{todayStats.visits}</Title>
              <Paragraph style={styles.statLabel}>Visits</Paragraph>
            </View>
            <View style={styles.statItem}>
              <Title style={styles.statNumber}>{todayStats.surveys}</Title>
              <Paragraph style={styles.statLabel}>Surveys</Paragraph>
            </View>
            <View style={styles.statItem}>
              <Title style={styles.statNumber}>{todayStats.interactions}</Title>
              <Paragraph style={styles.statLabel}>Interactions</Paragraph>
            </View>
            <View style={styles.statItem}>
              <Title style={styles.statNumber}>R{todayStats.sales}</Title>
              <Paragraph style={styles.statLabel}>Sales</Paragraph>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Title style={styles.sectionTitle}>Quick Actions</Title>
        {getQuickActions().map((action, index) => (
          <Card key={index} style={styles.actionCard}>
            <Card.Content style={styles.actionContent}>
              <Avatar.Icon
                size={40}
                icon={action.icon}
                style={[styles.actionIcon, { backgroundColor: action.color }]}
              />
              <View style={styles.actionText}>
                <Title style={styles.actionTitle}>{action.title}</Title>
                <Paragraph style={styles.actionSubtitle}>{action.subtitle}</Paragraph>
              </View>
              <IconButton
                icon="chevron-right"
                size={24}
                onPress={action.onPress}
              />
            </Card.Content>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    elevation: theme.elevation.small,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: theme.colors.primary,
    marginRight: theme.spacing.md,
  },
  userDetails: {
    flex: 1,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  role: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
  statusCard: {
    margin: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  statusContent: {
    alignItems: 'center',
  },
  connectionStatus: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  statusChip: {
    marginHorizontal: theme.spacing.xs,
  },
  lastSync: {
    fontSize: 12,
    color: theme.colors.placeholder,
    marginBottom: theme.spacing.sm,
  },
  syncButton: {
    marginTop: theme.spacing.sm,
  },
  statsCard: {
    margin: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
    color: theme.colors.text,
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
  quickActions: {
    margin: theme.spacing.md,
  },
  actionCard: {
    marginBottom: theme.spacing.md,
    elevation: theme.elevation.small,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginRight: theme.spacing.md,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  actionSubtitle: {
    fontSize: 14,
    color: theme.colors.placeholder,
  },
});

export default DashboardScreen;