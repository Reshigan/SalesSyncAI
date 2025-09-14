import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  People,
  ShoppingCart,
  Campaign,
  LocationOn,
  Assessment,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import StatCard from '../../components/Common/StatCard';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { reportingService, DashboardStats } from '../../services/apiService';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const stats = await reportingService.getDashboardStats();
      setDashboardStats(stats);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const recentActivities = [
    {
      id: 1,
      type: 'sale',
      message: 'New sale completed by Mike Salesperson',
      amount: 'R 1,250',
      time: '2 minutes ago',
    },
    {
      id: 2,
      type: 'visit',
      message: 'Visit completed at Spaza Shop Corner',
      time: '15 minutes ago',
    },
    {
      id: 3,
      type: 'campaign',
      message: 'Summer Refresh Campaign started',
      time: '1 hour ago',
    },
    {
      id: 4,
      type: 'user',
      message: 'New agent Lisa Marketer joined',
      time: '2 hours ago',
    },
  ];

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          {getWelcomeMessage()}, {user?.firstName}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your field operations today.
        </Typography>
      </Box>

      {/* Stats Grid */}
      {dashboardStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Total Sales"
              value={`R ${dashboardStats.totalSales.value.toLocaleString('en-ZA')}`}
              change={{
                value: dashboardStats.totalSales.change,
                type: dashboardStats.totalSales.changeType,
                label: 'vs last month',
              }}
              icon={<ShoppingCart />}
              color="#4caf50"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Active Campaigns"
              value={dashboardStats.activeCampaigns.value}
              change={{
                value: dashboardStats.activeCampaigns.change,
                type: dashboardStats.activeCampaigns.changeType,
                label: 'vs last month',
              }}
              icon={<Campaign />}
              color="#2196f3"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Visits Completed"
              value={dashboardStats.visitsCompleted.value}
              change={{
                value: dashboardStats.visitsCompleted.change,
                type: dashboardStats.visitsCompleted.changeType,
                label: 'vs last month',
              }}
              icon={<LocationOn />}
              color="#ff9800"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Active Agents"
              value={dashboardStats.activeAgents.value}
              change={{
                value: dashboardStats.activeAgents.change,
                type: dashboardStats.activeAgents.changeType,
                label: 'vs last month',
              }}
              icon={<People />}
              color="#9c27b0"
            />
          </Grid>
        </Grid>
      )}

      {/* Content Grid */}
      <Grid container spacing={3}>
        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Recent Activity
              </Typography>
              <Box>
                {recentActivities.map((activity) => (
                  <Box
                    key={activity.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      py: 2,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: 'primary.main',
                        width: 32,
                        height: 32,
                        mr: 2,
                      }}
                    >
                      {activity.type === 'sale' && <ShoppingCart fontSize="small" />}
                      {activity.type === 'visit' && <LocationOn fontSize="small" />}
                      {activity.type === 'campaign' && <Campaign fontSize="small" />}
                      {activity.type === 'user' && <People fontSize="small" />}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {activity.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {activity.time}
                      </Typography>
                    </Box>
                    {activity.amount && (
                      <Chip
                        label={activity.amount}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Performance Overview
              </Typography>
              <Box>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Sales Target</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      78%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={78}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Visit Completion</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      92%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={92}
                    color="success"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Campaign Progress</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      65%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={65}
                    color="warning"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Agent Productivity</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      85%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={85}
                    color="info"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <Campaign sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Create Campaign
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <People sx={{ fontSize: 32, color: 'secondary.main', mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Add User
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <Assessment sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      View Reports
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      textAlign: 'center',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <TrendingUp sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Analytics
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DashboardPage;