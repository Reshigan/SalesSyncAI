import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { ShoppingCart } from '@mui/icons-material';

const SalesPage: React.FC = () => {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Sales Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track sales performance, manage transactions, and analyze revenue
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <ShoppingCart sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Sales Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This feature is coming soon. You'll be able to view sales reports,
            track revenue performance, manage transactions, and analyze sales trends.
          </Typography>
          <Chip label="Coming Soon" color="primary" variant="outlined" />
        </CardContent>
      </Card>
    </Box>
  );
};

export default SalesPage;