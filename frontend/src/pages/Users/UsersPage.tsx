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
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Lock,
  Person,
  Email,
  Phone,
  Business,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

import DataTable, { Column, Action } from '../../components/Common/DataTable';
import FormDialog from '../../components/Common/FormDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import { userService, User, CreateUserRequest, UpdateUserRequest } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';

const userSchema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  firstName: yup
    .string()
    .required('First name is required'),
  lastName: yup
    .string()
    .required('Last name is required'),
  phone: yup
    .string()
    .optional(),
  role: yup
    .string()
    .required('Role is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .when('isEdit', {
      is: false,
      then: (schema) => schema.required('Password is required'),
      otherwise: (schema) => schema.optional(),
    }),
});

const roles = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'COMPANY_ADMIN', label: 'Company Admin' },
  { value: 'AREA_MANAGER', label: 'Area Manager' },
  { value: 'FIELD_SALES_AGENT', label: 'Field Sales Agent' },
  { value: 'MARKETING_AGENT', label: 'Marketing Agent' },
  { value: 'PROMOTER', label: 'Promoter' },
];

const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEdit, setIsEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserRequest & { isEdit?: boolean }>({
    resolver: yupResolver(userSchema) as any,
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: 'FIELD_SALES_AGENT',
      password: '',
    },
  });

  const columns: Column[] = [
    {
      id: 'avatar',
      label: '',
      minWidth: 60,
      format: (value: any, row: User) => (
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          {row.firstName.charAt(0)}{row.lastName.charAt(0)}
        </Avatar>
      ),
    },
    {
      id: 'name',
      label: 'Name',
      minWidth: 200,
      format: (value: any, row: User) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {row.firstName} {row.lastName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'role',
      label: 'Role',
      minWidth: 150,
      format: (value: string) => {
        const role = roles.find(r => r.value === value);
        return (
          <Chip
            label={role?.label || value}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      },
    },
    {
      id: 'phone',
      label: 'Phone',
      minWidth: 130,
      format: (value: string) => value || '-',
    },
    {
      id: 'company',
      label: 'Company',
      minWidth: 150,
      format: (value: any, row: User) => row.company?.name || '-',
    },
    {
      id: 'isActive',
      label: 'Status',
      minWidth: 100,
      format: (value: boolean) => (
        <Chip
          label={value ? 'Active' : 'Inactive'}
          size="small"
          color={value ? 'success' : 'error'}
          variant="outlined"
        />
      ),
    },
    {
      id: 'lastLoginAt',
      label: 'Last Login',
      minWidth: 150,
      format: (value: string) => {
        if (!value) return 'Never';
        return new Date(value).toLocaleDateString();
      },
    },
  ];

  const actions: Action[] = [
    {
      label: 'Edit',
      icon: <Edit />,
      onClick: handleEditUser,
    },
    {
      label: 'Reset Password',
      icon: <Lock />,
      onClick: handleResetPassword,
    },
    {
      label: 'Delete',
      icon: <Delete />,
      onClick: handleDeleteUser,
      color: 'error',
      disabled: (row: User) => row.id === currentUser?.id,
    },
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers();
      setUsers(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setIsEdit(false);
    setSelectedUser(null);
    reset({
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: 'FIELD_SALES_AGENT',
      password: '',
    });
    setDialogOpen(true);
  };

  function handleEditUser(user: User) {
    setIsEdit(true);
    setSelectedUser(user);
    reset({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      role: user.role,
      password: '',
      isEdit: true,
    });
    setDialogOpen(true);
  }

  function handleDeleteUser(user: User) {
    setSelectedUser(user);
    setConfirmDialogOpen(true);
  }

  async function handleResetPassword(user: User) {
    try {
      const result = await userService.resetPassword(user.id);
      toast.success(`Password reset successfully. Temporary password: ${result.temporaryPassword}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset password');
    }
  }

  const onSubmit = async (data: CreateUserRequest) => {
    try {
      setSubmitting(true);
      
      if (isEdit && selectedUser) {
        const updateData: UpdateUserRequest = {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role,
        };
        await userService.updateUser(selectedUser.id, updateData);
        toast.success('User updated successfully');
      } else {
        await userService.createUser(data);
        toast.success('User created successfully');
      }
      
      setDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    try {
      setSubmitting(true);
      await userService.deleteUser(selectedUser.id);
      toast.success('User deleted successfully');
      setConfirmDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return '#f44336';
      case 'COMPANY_ADMIN':
        return '#ff9800';
      case 'AREA_MANAGER':
        return '#2196f3';
      case 'FIELD_SALES_AGENT':
        return '#4caf50';
      case 'MARKETING_AGENT':
        return '#9c27b0';
      case 'PROMOTER':
        return '#607d8b';
      default:
        return '#757575';
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading users..." />;
  }

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
          onClick={handleAddUser}
        >
          Add User
        </Button>
      </Box>

      <DataTable
        columns={columns}
        data={users}
        actions={actions}
        searchable
        exportable
        refreshable
        onRefresh={loadUsers}
        emptyMessage="No users found"
      />

      {/* Add/Edit User Dialog */}
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={isEdit ? 'Edit User' : 'Add New User'}
        subtitle={isEdit ? 'Update user information' : 'Create a new user account'}
        onSubmit={handleSubmit(onSubmit)}
        loading={submitting}
        submitLabel={isEdit ? 'Update User' : 'Create User'}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Controller
              name="firstName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="First Name"
                  error={!!errors.firstName}
                  helperText={errors.firstName?.message}
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="lastName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Last Name"
                  error={!!errors.lastName}
                  helperText={errors.lastName?.message}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Email Address"
                  type="email"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  disabled={isEdit}
                  InputProps={{
                    startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Phone Number"
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  InputProps={{
                    startAdornment: <Phone sx={{ mr: 1, color: 'action.active' }} />,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth error={!!errors.role}>
              <InputLabel>Role</InputLabel>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Role"
                    startAdornment={<Business sx={{ mr: 1, color: 'action.active' }} />}
                  >
                    {roles.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: getRoleColor(role.value),
                              mr: 1,
                            }}
                          />
                          {role.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
            </FormControl>
          </Grid>
          {!isEdit && (
            <Grid item xs={12}>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Password"
                    type="password"
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    InputProps={{
                      startAdornment: <Lock sx={{ mr: 1, color: 'action.active' }} />,
                    }}
                  />
                )}
              />
            </Grid>
          )}
        </Grid>
      </FormDialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${selectedUser?.firstName} ${selectedUser?.lastName}? This action cannot be undone.`}
        type="error"
        confirmLabel="Delete"
        loading={submitting}
      />
    </Box>
  );
};

export default UsersPage;