import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
} from '@mui/material';
import { Add, People } from '@mui/icons-material';

const UsersPage: React.FC = () => {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Users Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage field agents, managers, and administrators
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
        >
          Add User
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <People sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Users Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This feature is coming soon. You'll be able to manage all your field agents,
            managers, and administrators from here.
          </Typography>
          <Chip label="Coming Soon" color="primary" variant="outlined" />
        </CardContent>
      </Card>
    </Box>
  );
};

export default UsersPage;