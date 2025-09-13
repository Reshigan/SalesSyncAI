import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
} from '@mui/material';
import { Add, Campaign } from '@mui/icons-material';

const CampaignsPage: React.FC = () => {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Marketing Campaigns
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create and manage field marketing campaigns and activations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
        >
          Create Campaign
        </Button>
      </Box>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Campaign sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Campaign Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This feature is coming soon. You'll be able to create and manage
            field marketing campaigns, brand activations, and promotional events.
          </Typography>
          <Chip label="Coming Soon" color="primary" variant="outlined" />
        </CardContent>
      </Card>
    </Box>
  );
};

export default CampaignsPage;