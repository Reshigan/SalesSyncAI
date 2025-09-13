import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { Assessment } from '@mui/icons-material';

const ReportsPage: React.FC = () => {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Reports & Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive reporting and business intelligence dashboard
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Advanced Reporting
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This feature is coming soon. You'll have access to comprehensive reports,
            AI-powered insights, performance analytics, and business intelligence tools.
          </Typography>
          <Chip label="Coming Soon" color="primary" variant="outlined" />
        </CardContent>
      </Card>
    </Box>
  );
};

export default ReportsPage;