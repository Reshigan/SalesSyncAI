import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Avatar,
  TextField,
  MenuItem,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Campaign,
  CalendarToday,
  AttachMoney,
  People,
  TrendingUp,
  Visibility,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

import DataTable, { Column, Action } from '../../components/Common/DataTable';
import FormDialog from '../../components/Common/FormDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import StatCard from '../../components/Common/StatCard';
import { 
  campaignService, 
  userService,
  Campaign as CampaignType, 
  User,
  CreateCampaignRequest 
} from '../../services/apiService';

const campaignSchema = yup.object({
  name: yup
    .string()
    .required('Campaign name is required'),
  description: yup
    .string()
    .required('Description is required'),
  type: yup
    .string()
    .required('Campaign type is required'),
  startDate: yup
    .string()
    .required('Start date is required'),
  endDate: yup
    .string()
    .required('End date is required'),
  budget: yup
    .number()
    .min(0, 'Budget must be positive')
    .required('Budget is required'),
  targetAudience: yup
    .string()
    .required('Target audience is required'),
  assignedAgentIds: yup
    .array()
    .of(yup.string().required())
    .min(1, 'At least one agent must be assigned')
    .required('Assigned agents are required'),
});

const campaignTypes = [
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'survey', label: 'Survey' },
];

const CampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<CampaignType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignType | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState<'delete' | 'activate' | 'pause'>('delete');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCampaignRequest>({
    resolver: yupResolver(campaignSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      type: 'brand_awareness',
      startDate: '',
      endDate: '',
      budget: 0,
      targetAudience: '',
      assignedAgentIds: [],
    },
  });

  const columns: Column[] = [
    {
      id: 'name',
      label: 'Campaign',
      minWidth: 200,
      format: (value: string, row: CampaignType) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.type.replace('_', ' ').toUpperCase()}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 120,
      format: (value: string) => {
        const getStatusConfig = (status: string) => {
          switch (status) {
            case 'draft':
              return { color: 'default' as const, label: 'Draft' };
            case 'active':
              return { color: 'success' as const, label: 'Active' };
            case 'paused':
              return { color: 'warning' as const, label: 'Paused' };
            case 'completed':
              return { color: 'info' as const, label: 'Completed' };
            default:
              return { color: 'default' as const, label: status };
          }
        };
        
        const config = getStatusConfig(value);
        return (
          <Chip
            label={config.label}
            size="small"
            color={config.color}
            variant="filled"
          />
        );
      },
    },
    {
      id: 'startDate',
      label: 'Start Date',
      minWidth: 120,
      format: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      id: 'endDate',
      label: 'End Date',
      minWidth: 120,
      format: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      id: 'budget',
      label: 'Budget',
      minWidth: 120,
      align: 'right',
      format: (value: number) => `R ${value.toLocaleString('en-ZA')}`,
    },
    {
      id: 'assignedAgents',
      label: 'Agents',
      minWidth: 100,
      format: (value: User[]) => (
        <Chip
          label={`${value.length} agents`}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      id: 'metrics',
      label: 'Performance',
      minWidth: 150,
      format: (value: any) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            ROI: {value.roi}%
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {value.impressions} impressions
          </Typography>
        </Box>
      ),
    },
  ];

  const actions: Action[] = [
    {
      label: 'View Details',
      icon: <Visibility />,
      onClick: handleViewCampaign,
    },
    {
      label: 'Edit',
      icon: <Edit />,
      onClick: handleEditCampaign,
      disabled: (row: CampaignType) => row.status === 'completed',
    },
    {
      label: 'Activate',
      icon: <PlayArrow />,
      onClick: handleActivateCampaign,
      color: 'success',
      disabled: (row: CampaignType) => row.status === 'active',
    },
    {
      label: 'Pause',
      icon: <Pause />,
      onClick: handlePauseCampaign,
      color: 'warning',
      disabled: (row: CampaignType) => row.status !== 'active',
    },
    {
      label: 'Delete',
      icon: <Delete />,
      onClick: handleDeleteCampaign,
      color: 'error',
      disabled: (row: CampaignType) => row.status === 'active',
    },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [campaignsData, usersData] = await Promise.all([
        campaignService.getCampaigns(),
        userService.getUsers(),
      ]);
      setCampaigns(campaignsData);
      setUsers(usersData.filter(u => ['FIELD_SALES_AGENT', 'MARKETING_AGENT'].includes(u.role)));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCampaign = () => {
    setIsEdit(false);
    setSelectedCampaign(null);
    reset({
      name: '',
      description: '',
      type: 'brand_awareness',
      startDate: '',
      endDate: '',
      budget: 0,
      targetAudience: '',
      assignedAgentIds: [],
    });
    setDialogOpen(true);
  };

  function handleEditCampaign(campaign: CampaignType) {
    setIsEdit(true);
    setSelectedCampaign(campaign);
    reset({
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      startDate: campaign.startDate.slice(0, 10),
      endDate: campaign.endDate.slice(0, 10),
      budget: campaign.budget,
      targetAudience: campaign.targetAudience,
      assignedAgentIds: campaign.assignedAgents.map(a => a.id),
    });
    setDialogOpen(true);
  }

  function handleViewCampaign(campaign: CampaignType) {
    // For now, just show a toast - could implement a detailed view dialog
    toast.success(`Viewing campaign: ${campaign.name}`);
  }

  function handleDeleteCampaign(campaign: CampaignType) {
    setSelectedCampaign(campaign);
    setActionType('delete');
    setConfirmDialogOpen(true);
  }

  function handleActivateCampaign(campaign: CampaignType) {
    setSelectedCampaign(campaign);
    setActionType('activate');
    setConfirmDialogOpen(true);
  }

  function handlePauseCampaign(campaign: CampaignType) {
    setSelectedCampaign(campaign);
    setActionType('pause');
    setConfirmDialogOpen(true);
  }

  const onSubmit = async (data: CreateCampaignRequest) => {
    try {
      setSubmitting(true);
      
      if (isEdit && selectedCampaign) {
        await campaignService.updateCampaign(selectedCampaign.id, data);
        toast.success('Campaign updated successfully');
      } else {
        await campaignService.createCampaign(data);
        toast.success('Campaign created successfully');
      }
      
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedCampaign) return;

    try {
      setSubmitting(true);
      
      switch (actionType) {
        case 'delete':
          await campaignService.deleteCampaign(selectedCampaign.id);
          toast.success('Campaign deleted successfully');
          break;
        case 'activate':
          await campaignService.activateCampaign(selectedCampaign.id);
          toast.success('Campaign activated successfully');
          break;
        case 'pause':
          await campaignService.pauseCampaign(selectedCampaign.id);
          toast.success('Campaign paused successfully');
          break;
      }
      
      setConfirmDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${actionType} campaign`);
    } finally {
      setSubmitting(false);
    }
  };

  const getConfirmDialogConfig = () => {
    switch (actionType) {
      case 'delete':
        return {
          title: 'Delete Campaign',
          message: `Are you sure you want to delete "${selectedCampaign?.name}"? This action cannot be undone.`,
          type: 'error' as const,
          confirmLabel: 'Delete',
        };
      case 'activate':
        return {
          title: 'Activate Campaign',
          message: `Are you sure you want to activate "${selectedCampaign?.name}"?`,
          type: 'success' as const,
          confirmLabel: 'Activate',
        };
      case 'pause':
        return {
          title: 'Pause Campaign',
          message: `Are you sure you want to pause "${selectedCampaign?.name}"?`,
          type: 'warning' as const,
          confirmLabel: 'Pause',
        };
      default:
        return {
          title: 'Confirm Action',
          message: 'Are you sure?',
          type: 'warning' as const,
          confirmLabel: 'Confirm',
        };
    }
  };

  const getCampaignStats = () => {
    const total = campaigns.length;
    const active = campaigns.filter(c => c.status === 'active').length;
    const draft = campaigns.filter(c => c.status === 'draft').length;
    const completed = campaigns.filter(c => c.status === 'completed').length;
    const totalBudget = campaigns.reduce((sum, campaign) => sum + campaign.budget, 0);

    return { total, active, draft, completed, totalBudget };
  };

  const stats = getCampaignStats();
  const confirmConfig = getConfirmDialogConfig();

  if (loading) {
    return <LoadingSpinner message="Loading campaigns..." />;
  }

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
          onClick={handleAddCampaign}
        >
          Create Campaign
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Campaigns"
            value={stats.total}
            icon={<Campaign />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Active"
            value={stats.active}
            icon={<PlayArrow />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Draft"
            value={stats.draft}
            icon={<Edit />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={<TrendingUp />}
            color="#9c27b0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Budget"
            value={`R ${stats.totalBudget.toLocaleString('en-ZA')}`}
            icon={<AttachMoney />}
            color="#f44336"
          />
        </Grid>
      </Grid>

      <DataTable
        columns={columns}
        data={campaigns}
        actions={actions}
        searchable
        exportable
        refreshable
        onRefresh={loadData}
        emptyMessage="No campaigns found"
      />

      {/* Add/Edit Campaign Dialog */}
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={isEdit ? 'Edit Campaign' : 'Create New Campaign'}
        subtitle={isEdit ? 'Update campaign information' : 'Create a new marketing campaign'}
        onSubmit={handleSubmit(onSubmit)}
        loading={submitting}
        submitLabel={isEdit ? 'Update Campaign' : 'Create Campaign'}
        maxWidth="md"
      >
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Campaign Name"
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.type}>
              <InputLabel>Campaign Type</InputLabel>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Campaign Type"
                  >
                    {campaignTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="budget"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Budget"
                  type="number"
                  inputProps={{ min: 0 }}
                  error={!!errors.budget}
                  helperText={errors.budget?.message}
                  InputProps={{
                    startAdornment: <AttachMoney sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Start Date"
                  type="date"
                  error={!!errors.startDate}
                  helperText={errors.startDate?.message}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    startAdornment: <CalendarToday sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="End Date"
                  type="date"
                  error={!!errors.endDate}
                  helperText={errors.endDate?.message}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    startAdornment: <CalendarToday sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="targetAudience"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Target Audience"
                  error={!!errors.targetAudience}
                  helperText={errors.targetAudience?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth error={!!errors.assignedAgentIds}>
              <InputLabel>Assigned Agents</InputLabel>
              <Controller
                name="assignedAgentIds"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    multiple
                    label="Assigned Agents"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => {
                          const user = users.find(u => u.id === value);
                          return (
                            <Chip
                              key={value}
                              label={user ? `${user.firstName} ${user.lastName}` : value}
                              size="small"
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {users.map((user) => (
                      <MenuItem key={user.id} value={user.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: 'primary.main' }}>
                            <People fontSize="small" />
                          </Avatar>
                          {user.firstName} {user.lastName} ({user.role})
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
        </Grid>
      </FormDialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleConfirmAction}
        title={confirmConfig.title}
        message={confirmConfig.message}
        type={confirmConfig.type}
        confirmLabel={confirmConfig.confirmLabel}
        loading={submitting}
      />
    </Box>
  );
};

export default CampaignsPage;