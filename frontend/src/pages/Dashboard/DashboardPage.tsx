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
  createTheme,
  ThemeProvider,
  Button,
  IconButton,
} from '@mui/material';
import {
  TrendingUp,
  People,
  ShoppingCart,
  Campaign,
  LocationOn,
  Assessment,
  Bolt,
  Rocket,
  Speed,
  FlashOn,
  Whatshot,
  Star,
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

  // Edgy Dark Orange Theme
  const edgyTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#FF6B35',
        dark: '#E55A2B',
        light: '#FF8A65',
      },
      secondary: {
        main: '#FF9500',
        dark: '#E6850E',
        light: '#FFB84D',
      },
      background: {
        default: '#0A0A0A',
        paper: '#1A1A1A',
      },
      text: {
        primary: '#FFFFFF',
        secondary: '#B0B0B0',
      },
    },
    typography: {
      fontFamily: 'Poppins, sans-serif',
      h4: {
        fontWeight: 800,
        background: 'linear-gradient(135deg, #FF6B35 0%, #FF9500 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      },
      h6: {
        fontWeight: 700,
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
            border: '1px solid #333333',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 20px rgba(255, 107, 53, 0.3)',
              borderColor: '#FF6B35',
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: '8px',
            height: '12px',
            backgroundColor: '#333333',
          },
          bar: {
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF9500 100%)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF9500 100%)',
            color: 'white',
            fontWeight: 600,
          },
        },
      },
    },
  });

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
      message: '🔥 Massive sale closed by Alex Thunder',
      amount: '$2,850',
      time: '2 minutes ago',
      icon: <Whatshot />,
      color: '#FF6B35',
    },
    {
      id: 2,
      type: 'visit',
      message: '⚡ Lightning visit at TechHub Store',
      time: '15 minutes ago',
      icon: <Bolt />,
      color: '#FF9500',
    },
    {
      id: 3,
      type: 'campaign',
      message: '🚀 Rocket Campaign launched successfully',
      time: '1 hour ago',
      icon: <Rocket />,
      color: '#FF6B35',
    },
    {
      id: 4,
      type: 'user',
      message: '⭐ Star agent Maya Power joined the team',
      time: '2 hours ago',
      icon: <Star />,
      color: '#FF9500',
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
    <ThemeProvider theme={edgyTheme}>
      <Box sx={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%)', minHeight: '100vh', p: 3 }}>
        {/* Welcome Header */}
        <Box sx={{ mb: 4, position: 'relative' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 60,
                height: 60,
                background: 'linear-gradient(135deg, #FF6B35 0%, #FF9500 100%)',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(255, 107, 53, 0.3)',
                animation: 'pulse-orange 2s ease-in-out infinite',
              }}
            >
              <Bolt sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                {getWelcomeMessage()}, {user?.firstName}! ⚡
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: '18px' }}>
                🚀 Crushing your field operations today
              </Typography>
            </Box>
          </Box>
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
                        background: `linear-gradient(135deg, ${activity.color} 0%, #FF9500 100%)`,
                        width: 40,
                        height: 40,
                        mr: 2,
                        boxShadow: `0 4px 12px ${activity.color}40`,
                      }}
                    >
                      {activity.icon}
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Whatshot sx={{ color: '#FF6B35', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Sales Target</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#FF6B35' }}>
                      78%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={78}
                    sx={{ 
                      height: 12, 
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
                    }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Speed sx={{ color: '#FF9500', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Visit Completion</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#FF9500' }}>
                      92%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={92}
                    sx={{ 
                      height: 12, 
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
                    }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Rocket sx={{ color: '#FF6B35', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Campaign Progress</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#FF6B35' }}>
                      65%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={65}
                    sx={{ 
                      height: 12, 
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(255, 107, 53, 0.3)',
                    }}
                  />
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Star sx={{ color: '#FF9500', fontSize: 20 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Agent Productivity</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#FF9500' }}>
                      85%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={85}
                    sx={{ 
                      height: 12, 
                      borderRadius: 8,
                      boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)',
                    }}
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
                  <Button
                    fullWidth
                    sx={{
                      p: 3,
                      background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                      border: '2px solid #333333',
                      borderRadius: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#FF6B35',
                        boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
                      },
                    }}
                  >
                    <Box>
                      <Campaign sx={{ fontSize: 40, color: '#FF6B35', mb: 1 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                        🚀 Create Campaign
                      </Typography>
                    </Box>
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    sx={{
                      p: 3,
                      background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                      border: '2px solid #333333',
                      borderRadius: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#FF9500',
                        boxShadow: '0 8px 32px rgba(255, 149, 0, 0.3)',
                      },
                    }}
                  >
                    <Box>
                      <People sx={{ fontSize: 40, color: '#FF9500', mb: 1 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                        ⚡ Add User
                      </Typography>
                    </Box>
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    sx={{
                      p: 3,
                      background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                      border: '2px solid #333333',
                      borderRadius: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#FF6B35',
                        boxShadow: '0 8px 32px rgba(255, 107, 53, 0.3)',
                      },
                    }}
                  >
                    <Box>
                      <Assessment sx={{ fontSize: 40, color: '#FF6B35', mb: 1 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                        📊 View Reports
                      </Typography>
                    </Box>
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    fullWidth
                    sx={{
                      p: 3,
                      background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
                      border: '2px solid #333333',
                      borderRadius: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#FF9500',
                        boxShadow: '0 8px 32px rgba(255, 149, 0, 0.3)',
                      },
                    }}
                  >
                    <Box>
                      <TrendingUp sx={{ fontSize: 40, color: '#FF9500', mb: 1 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'white' }}>
                        📈 Analytics
                      </Typography>
                    </Box>
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Add custom animations */}
      <style>
        {`
          @keyframes pulse-orange {
            0%, 100% {
              box-shadow: 0 4px 20px rgba(255, 107, 53, 0.3);
            }
            50% {
              box-shadow: 0 4px 20px rgba(255, 107, 53, 0.6), 0 0 30px rgba(255, 107, 53, 0.4);
            }
          }
        `}
      </style>
      </Box>
    </ThemeProvider>
  );
};

export default DashboardPage;