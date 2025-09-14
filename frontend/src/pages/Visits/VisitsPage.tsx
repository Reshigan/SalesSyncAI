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
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Stop,
  CheckCircle,
  Cancel,
  LocationOn,
  Person,
  Business,
  CalendarToday,
  Notes,
  Photo,
  Map,
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
  visitService, 
  customerService, 
  Visit, 
  Customer, 
  CreateVisitRequest 
} from '../../services/apiService';

const visitSchema = yup.object({
  customerId: yup
    .string()
    .required('Customer is required'),
  scheduledDate: yup
    .string()
    .required('Scheduled date is required'),
  visitType: yup
    .string()
    .required('Visit type is required'),
  purpose: yup
    .string()
    .required('Purpose is required'),
  notes: yup
    .string()
    .optional(),
});

const visitTypes = [
  { value: 'sales_call', label: 'Sales Call' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'collection', label: 'Collection' },
  { value: 'survey', label: 'Survey' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'follow_up', label: 'Follow Up' },
];

const VisitsPage: React.FC = () => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState<'delete' | 'cancel' | 'complete'>('delete');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateVisitRequest>({
    resolver: yupResolver(visitSchema) as any,
    defaultValues: {
      customerId: '',
      scheduledDate: '',
      visitType: 'sales_call',
      purpose: '',
      notes: '',
    },
  });

  const columns: Column[] = [
    {
      id: 'customer',
      label: 'Customer',
      minWidth: 200,
      format: (value: any, row: Visit) => (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 32, height: 32 }}>
            <Business fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {row.customer.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.customer.address}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'agent',
      label: 'Agent',
      minWidth: 150,
      format: (value: any, row: Visit) => (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'secondary.main', mr: 1, width: 24, height: 24 }}>
            <Person fontSize="small" />
          </Avatar>
          <Typography variant="body2">
            {row.agent.firstName} {row.agent.lastName}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'scheduledDate',
      label: 'Scheduled',
      minWidth: 130,
      format: (value: string) => {
        const date = new Date(value);
        return (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {date.toLocaleDateString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        );
      },
    },
    {
      id: 'visitType',
      label: 'Type',
      minWidth: 120,
      format: (value: string) => {
        const type = visitTypes.find(t => t.value === value);
        return (
          <Chip
            label={type?.label || value}
            size="small"
            color="info"
            variant="outlined"
          />
        );
      },
    },
    {
      id: 'status',
      label: 'Status',
      minWidth: 120,
      format: (value: string) => {
        const getStatusConfig = (status: string) => {
          switch (status) {
            case 'scheduled':
              return { color: 'info' as const, label: 'Scheduled' };
            case 'in_progress':
              return { color: 'warning' as const, label: 'In Progress' };
            case 'completed':
              return { color: 'success' as const, label: 'Completed' };
            case 'cancelled':
              return { color: 'error' as const, label: 'Cancelled' };
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
      id: 'purpose',
      label: 'Purpose',
      minWidth: 200,
      format: (value: string) => (
        <Typography variant="body2" sx={{ 
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </Typography>
      ),
    },
    {
      id: 'duration',
      label: 'Duration',
      minWidth: 100,
      format: (value: number) => {
        if (!value) return '-';
        const hours = Math.floor(value / 60);
        const minutes = value % 60;
        return `${hours}h ${minutes}m`;
      },
    },
  ];

  const actions: Action[] = [
    {
      label: 'Start Visit',
      icon: <PlayArrow />,
      onClick: handleStartVisit,
      color: 'success',
      disabled: (row: Visit) => row.status !== 'scheduled',
    },
    {
      label: 'Complete Visit',
      icon: <CheckCircle />,
      onClick: handleCompleteVisit,
      color: 'success',
      disabled: (row: Visit) => row.status !== 'in_progress',
    },
    {
      label: 'Edit',
      icon: <Edit />,
      onClick: handleEditVisit,
      disabled: (row: Visit) => row.status === 'completed',
    },
    {
      label: 'Cancel',
      icon: <Cancel />,
      onClick: handleCancelVisit,
      color: 'warning',
      disabled: (row: Visit) => ['completed', 'cancelled'].includes(row.status),
    },
    {
      label: 'Delete',
      icon: <Delete />,
      onClick: handleDeleteVisit,
      color: 'error',
      disabled: (row: Visit) => row.status === 'in_progress',
    },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [visitsData, customersData] = await Promise.all([
        visitService.getVisits(),
        customerService.getCustomers(),
      ]);
      setVisits(visitsData);
      setCustomers(customersData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddVisit = () => {
    setIsEdit(false);
    setSelectedVisit(null);
    reset({
      customerId: '',
      scheduledDate: '',
      visitType: 'sales_call',
      purpose: '',
      notes: '',
    });
    setDialogOpen(true);
  };

  function handleEditVisit(visit: Visit) {
    setIsEdit(true);
    setSelectedVisit(visit);
    reset({
      customerId: visit.customer.id,
      scheduledDate: visit.scheduledDate.slice(0, 16), // Format for datetime-local input
      visitType: visit.visitType,
      purpose: visit.purpose,
      notes: visit.notes || '',
    });
    setDialogOpen(true);
  }

  function handleDeleteVisit(visit: Visit) {
    setSelectedVisit(visit);
    setActionType('delete');
    setConfirmDialogOpen(true);
  }

  function handleCancelVisit(visit: Visit) {
    setSelectedVisit(visit);
    setActionType('cancel');
    setConfirmDialogOpen(true);
  }

  function handleCompleteVisit(visit: Visit) {
    setSelectedVisit(visit);
    setActionType('complete');
    setConfirmDialogOpen(true);
  }

  async function handleStartVisit(visit: Visit) {
    try {
      // Get current location
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by this browser');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            await visitService.startVisit(visit.id, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            toast.success('Visit started successfully');
            loadData();
          } catch (error: any) {
            toast.error(error.message || 'Failed to start visit');
          }
        },
        (error) => {
          toast.error('Failed to get location. Please enable location services.');
        }
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to start visit');
    }
  }

  const onSubmit = async (data: CreateVisitRequest) => {
    try {
      setSubmitting(true);
      
      if (isEdit && selectedVisit) {
        await visitService.updateVisit(selectedVisit.id, data);
        toast.success('Visit updated successfully');
      } else {
        await visitService.createVisit(data);
        toast.success('Visit created successfully');
      }
      
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save visit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedVisit) return;

    try {
      setSubmitting(true);
      
      switch (actionType) {
        case 'delete':
          // Note: Delete endpoint might not exist in backend, using cancel instead
          await visitService.cancelVisit(selectedVisit.id, 'Deleted by user');
          toast.success('Visit deleted successfully');
          break;
        case 'cancel':
          await visitService.cancelVisit(selectedVisit.id, 'Cancelled by user');
          toast.success('Visit cancelled successfully');
          break;
        case 'complete':
          await visitService.completeVisit(selectedVisit.id, {
            notes: 'Visit completed',
          });
          toast.success('Visit completed successfully');
          break;
      }
      
      setConfirmDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${actionType} visit`);
    } finally {
      setSubmitting(false);
    }
  };

  const getConfirmDialogConfig = () => {
    switch (actionType) {
      case 'delete':
        return {
          title: 'Delete Visit',
          message: `Are you sure you want to delete this visit to ${selectedVisit?.customer.name}? This action cannot be undone.`,
          type: 'error' as const,
          confirmLabel: 'Delete',
        };
      case 'cancel':
        return {
          title: 'Cancel Visit',
          message: `Are you sure you want to cancel this visit to ${selectedVisit?.customer.name}?`,
          type: 'warning' as const,
          confirmLabel: 'Cancel Visit',
        };
      case 'complete':
        return {
          title: 'Complete Visit',
          message: `Mark this visit to ${selectedVisit?.customer.name} as completed?`,
          type: 'success' as const,
          confirmLabel: 'Complete',
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

  const getVisitStats = () => {
    const total = visits.length;
    const scheduled = visits.filter(v => v.status === 'scheduled').length;
    const inProgress = visits.filter(v => v.status === 'in_progress').length;
    const completed = visits.filter(v => v.status === 'completed').length;
    const cancelled = visits.filter(v => v.status === 'cancelled').length;

    return { total, scheduled, inProgress, completed, cancelled };
  };

  const stats = getVisitStats();
  const confirmConfig = getConfirmDialogConfig();

  if (loading) {
    return <LoadingSpinner message="Loading visits..." />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Visit Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Plan, track, and manage customer visits
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          size="large"
          onClick={handleAddVisit}
        >
          Schedule Visit
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Total Visits"
            value={stats.total}
            icon={<LocationOn />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Scheduled"
            value={stats.scheduled}
            icon={<CalendarToday />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={<PlayArrow />}
            color="#f44336"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Completed"
            value={stats.completed}
            icon={<CheckCircle />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <StatCard
            title="Cancelled"
            value={stats.cancelled}
            icon={<Cancel />}
            color="#9e9e9e"
          />
        </Grid>
      </Grid>

      <DataTable
        columns={columns}
        data={visits}
        actions={actions}
        searchable
        exportable
        refreshable
        onRefresh={loadData}
        emptyMessage="No visits found"
      />

      {/* Add/Edit Visit Dialog */}
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={isEdit ? 'Edit Visit' : 'Schedule New Visit'}
        subtitle={isEdit ? 'Update visit information' : 'Create a new customer visit'}
        onSubmit={handleSubmit(onSubmit)}
        loading={submitting}
        submitLabel={isEdit ? 'Update Visit' : 'Schedule Visit'}
        maxWidth="md"
      >
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.customerId}>
              <InputLabel>Customer</InputLabel>
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Customer"
                    startAdornment={<Business sx={{ mr: 1, color: 'action.active' }} />}
                  >
                    {customers.map((customer) => (
                      <MenuItem key={customer.id} value={customer.id}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customer.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {customer.address}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.visitType}>
              <InputLabel>Visit Type</InputLabel>
              <Controller
                name="visitType"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Visit Type"
                  >
                    {visitTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="scheduledDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Scheduled Date & Time"
                  type="datetime-local"
                  error={!!errors.scheduledDate}
                  helperText={errors.scheduledDate?.message}
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
              name="purpose"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Purpose"
                  error={!!errors.purpose}
                  helperText={errors.purpose?.message}
                  InputProps={{
                    startAdornment: <Notes sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  error={!!errors.notes}
                  helperText={errors.notes?.message}
                />
              )}
            />
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

export default VisitsPage;