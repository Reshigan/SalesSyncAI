import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import {
  Dashboard,
  People,
  Campaign,
  LocationOn,
  ShoppingCart,
  Assessment,
  Settings,
  Store,
  TrendingUp,
  Event,
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  onItemClick?: () => void;
}

interface NavigationItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: string;
}

const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    path: '/dashboard',
    icon: <Dashboard />,
  },
  {
    title: 'Users',
    path: '/users',
    icon: <People />,
    roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'REGIONAL_MANAGER'],
  },
  {
    title: 'Campaigns',
    path: '/campaigns',
    icon: <Campaign />,
  },
  {
    title: 'Trade Marketing',
    path: '/trade-marketing',
    icon: <Store />,
    badge: 'Coming Soon',
  },
  {
    title: 'Trade Promotion',
    path: '/trade-promotion',
    icon: <TrendingUp />,
    badge: 'Coming Soon',
  },
  {
    title: 'Events',
    path: '/events',
    icon: <Event />,
    badge: 'Coming Soon',
  },
  {
    title: 'Visits',
    path: '/visits',
    icon: <LocationOn />,
  },
  {
    title: 'Sales',
    path: '/sales',
    icon: <ShoppingCart />,
  },
  {
    title: 'Reports',
    path: '/reports',
    icon: <Assessment />,
  },
  {
    title: 'Settings',
    path: '/settings',
    icon: <Settings />,
    roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ onItemClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleNavigation = (path: string) => {
    navigate(path);
    onItemClick?.();
  };

  const hasAccess = (item: NavigationItem): boolean => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || '');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo and Brand */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <img 
            src="/favicon.svg" 
            alt="SalesSyncAI Logo" 
            style={{ width: '48px', height: '48px' }} 
          />
        </Box>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            mb: 1,
          }}
        >
          SalesSyncAI
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontStyle: 'italic',
          }}
        >
          Intelligent Field Sales Management
        </Typography>
      </Box>

      <Divider />

      {/* Company Info */}
      {user?.company && (
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Company
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {user.company.name}
          </Typography>
          <Chip
            label={user.company.subscriptionTier}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ mt: 1, textTransform: 'capitalize' }}
          />
        </Box>
      )}

      <Divider />

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <List sx={{ px: 1, py: 2 }}>
          {navigationItems.map((item) => {
            if (!hasAccess(item)) return null;

            const isActive = location.pathname === item.path;

            return (
              <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    bgcolor: isActive ? 'primary.main' : 'transparent',
                    color: isActive ? 'primary.contrastText' : 'text.primary',
                    '&:hover': {
                      bgcolor: isActive ? 'primary.dark' : 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActive ? 'primary.contrastText' : 'text.secondary',
                      minWidth: 40,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  />
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      color="secondary"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider />

      {/* User Info */}
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Logged in as
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {user?.firstName} {user?.lastName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {user?.role?.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
        </Typography>
      </Box>
    </Box>
  );
};

export default Sidebar;