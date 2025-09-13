import React from 'react';
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

import { useAuth } from '../../contexts/AuthContext';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  color,
}) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'success.main';
      case 'negative':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: color, mr: 2 }}>
            {icon}
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Box>
        {change && (
          <Typography
            variant="body2"
            sx={{ color: getChangeColor(), fontWeight: 500 }}
          >
            {change}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // Mock data - in real app, this would come from API
  const stats = [
    {
      title: 'Total Sales',
      value: 'R 2,847,392',
      change: '+12.5% from last month',
      changeType: 'positive' as const,
      icon: <ShoppingCart />,
      color: '#10B981',
    },
    {
      title: 'Active Campaigns',
      value: 8,
      change: '3 ending this week',
      changeType: 'neutral' as const,
      icon: <Campaign />,
      color: '#FB923C',
    },
    {
      title: 'Visits Completed',
      value: 1247,
      change: '+8.2% from last week',
      changeType: 'positive' as const,
      icon: <LocationOn />,
      color: '#3B82F6',
    },
    {
      title: 'Active Agents',
      value: 24,
      change: '2 new this month',
      changeType: 'positive' as const,
      icon: <People />,
      color: '#8B5CF6',
    },
  ];

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
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>

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