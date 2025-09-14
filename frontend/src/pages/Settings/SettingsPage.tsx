import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  Divider,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Settings,
  Person,
  Business,
  Security,
  Notifications,
  Extension,
  Backup,
  Edit,
  Save,
  Cancel,
  CloudUpload,
  Email,
  Sms,
  Phone,
  Webhook,
  Api,
  Storage,
  Shield,
  Key,
  Lock,
  Visibility,
  VisibilityOff,
  Assessment,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import FormDialog from '../../components/Common/FormDialog';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const profileSchema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  phone: yup.string().optional(),
});

const companySchema = yup.object({
  name: yup.string().required('Company name is required'),
  address: yup.string().required('Address is required'),
  phone: yup.string().optional(),
  email: yup.string().email('Invalid email').optional(),
  website: yup.string().url('Invalid URL').optional(),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup.string().min(6, 'Password must be at least 6 characters').required('New password is required'),
  confirmPassword: yup.string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your password'),
});

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Notification settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    weeklyReports: true,
    systemAlerts: true,
    marketingEmails: false,
  });

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    passwordExpiry: 90,
    loginNotifications: true,
  });

  // Integration settings
  const [integrations, setIntegrations] = useState({
    whatsappEnabled: false,
    emailIntegration: true,
    smsProvider: 'twilio',
    webhookUrl: '',
    apiAccess: true,
  });

  const profileForm = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    },
  });

  const companyForm = useForm({
    resolver: yupResolver(companySchema),
    defaultValues: {
      name: user?.company?.name || '',
      address: '',
      phone: '',
      email: '',
      website: '',
    },
  });

  const passwordForm = useForm({
    resolver: yupResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleProfileSave = async (data: any) => {
    try {
      setLoading(true);
      // API call to update profile
      toast.success('Profile updated successfully');
      setEditingProfile(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySave = async (data: any) => {
    try {
      setLoading(true);
      // API call to update company
      toast.success('Company information updated successfully');
      setEditingCompany(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update company information');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (data: any) => {
    try {
      setLoading(true);
      // API call to change password
      toast.success('Password changed successfully');
      setShowPasswordDialog(false);
      passwordForm.reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setNotifications(prev => ({
      ...prev,
      [key]: event.target.checked,
    }));
  };

  const handleSecurityChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSecuritySettings(prev => ({
      ...prev,
      [key]: event.target.checked,
    }));
  };

  const handleIntegrationChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setIntegrations(prev => ({
      ...prev,
      [key]: event.target.checked,
    }));
  };

  const saveNotificationSettings = async () => {
    try {
      setLoading(true);
      // API call to save notification settings
      toast.success('Notification settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save notification settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSecuritySettings = async () => {
    try {
      setLoading(true);
      // API call to save security settings
      toast.success('Security settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save security settings');
    } finally {
      setLoading(false);
    }
  };

  const saveIntegrationSettings = async () => {
    try {
      setLoading(true);
      // API call to save integration settings
      toast.success('Integration settings saved');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save integration settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure system settings, user preferences, and company information
        </Typography>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
            <Tab icon={<Person />} label="Profile" />
            <Tab icon={<Business />} label="Company" />
            <Tab icon={<Security />} label="Security" />
            <Tab icon={<Notifications />} label="Notifications" />
            <Tab icon={<Extension />} label="Integrations" />
            <Tab icon={<Backup />} label="Data & Backup" />
          </Tabs>
        </Box>

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Avatar
                    sx={{
                      width: 100,
                      height: 100,
                      mx: 'auto',
                      mb: 2,
                      bgcolor: 'primary.main',
                      fontSize: '2rem',
                    }}
                  >
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {user?.role?.replace('_', ' ')}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    size="small"
                  >
                    Upload Photo
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Personal Information
                    </Typography>
                    {!editingProfile ? (
                      <Button
                        startIcon={<Edit />}
                        onClick={() => setEditingProfile(true)}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Box>
                        <Button
                          startIcon={<Cancel />}
                          onClick={() => setEditingProfile(false)}
                          sx={{ mr: 1 }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<Save />}
                          onClick={profileForm.handleSubmit(handleProfileSave)}
                          disabled={loading}
                        >
                          Save
                        </Button>
                      </Box>
                    )}
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="firstName"
                        control={profileForm.control}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="First Name"
                            disabled={!editingProfile}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Controller
                        name="lastName"
                        control={profileForm.control}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Last Name"
                            disabled={!editingProfile}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Controller
                        name="email"
                        control={profileForm.control}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Email Address"
                            disabled={!editingProfile}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Controller
                        name="phone"
                        control={profileForm.control}
                        render={({ field, fieldState }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Phone Number"
                            disabled={!editingProfile}
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                  <Divider sx={{ my: 3 }} />
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Lock />}
                    onClick={() => setShowPasswordDialog(true)}
                  >
                    Change Password
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Company Tab */}
        <TabPanel value={tabValue} index={1}>
          <Card variant="outlined">
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Company Information
                </Typography>
                {!editingCompany ? (
                  <Button
                    startIcon={<Edit />}
                    onClick={() => setEditingCompany(true)}
                  >
                    Edit
                  </Button>
                ) : (
                  <Box>
                    <Button
                      startIcon={<Cancel />}
                      onClick={() => setEditingCompany(false)}
                      sx={{ mr: 1 }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<Save />}
                      onClick={companyForm.handleSubmit(handleCompanySave)}
                      disabled={loading}
                    >
                      Save
                    </Button>
                  </Box>
                )}
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Controller
                    name="name"
                    control={companyForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Company Name"
                        disabled={!editingCompany}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="address"
                    control={companyForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Address"
                        multiline
                        rows={3}
                        disabled={!editingCompany}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="phone"
                    control={companyForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Phone Number"
                        disabled={!editingCompany}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="email"
                    control={companyForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Email Address"
                        disabled={!editingCompany}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Controller
                    name="website"
                    control={companyForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Website"
                        disabled={!editingCompany}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Security Settings
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <Shield />
                      </ListItemIcon>
                      <ListItemText
                        primary="Two-Factor Authentication"
                        secondary="Add an extra layer of security to your account"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={securitySettings.twoFactorAuth}
                          onChange={handleSecurityChange('twoFactorAuth')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Key />
                      </ListItemIcon>
                      <ListItemText
                        primary="Login Notifications"
                        secondary="Get notified when someone logs into your account"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={securitySettings.loginNotifications}
                          onChange={handleSecurityChange('loginNotifications')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Session Timeout (minutes)"
                        type="number"
                        value={securitySettings.sessionTimeout}
                        onChange={(e) => setSecuritySettings(prev => ({
                          ...prev,
                          sessionTimeout: parseInt(e.target.value) || 30
                        }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Password Expiry (days)"
                        type="number"
                        value={securitySettings.passwordExpiry}
                        onChange={(e) => setSecuritySettings(prev => ({
                          ...prev,
                          passwordExpiry: parseInt(e.target.value) || 90
                        }))}
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      onClick={saveSecuritySettings}
                      disabled={loading}
                    >
                      Save Security Settings
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={3}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                Notification Preferences
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email Notifications"
                    secondary="Receive notifications via email"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.emailNotifications}
                      onChange={handleNotificationChange('emailNotifications')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Sms />
                  </ListItemIcon>
                  <ListItemText
                    primary="SMS Notifications"
                    secondary="Receive notifications via SMS"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.smsNotifications}
                      onChange={handleNotificationChange('smsNotifications')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Phone />
                  </ListItemIcon>
                  <ListItemText
                    primary="Push Notifications"
                    secondary="Receive push notifications in the app"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.pushNotifications}
                      onChange={handleNotificationChange('pushNotifications')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Assessment />
                  </ListItemIcon>
                  <ListItemText
                    primary="Weekly Reports"
                    secondary="Receive weekly performance reports"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.weeklyReports}
                      onChange={handleNotificationChange('weeklyReports')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Security />
                  </ListItemIcon>
                  <ListItemText
                    primary="System Alerts"
                    secondary="Receive important system alerts"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.systemAlerts}
                      onChange={handleNotificationChange('systemAlerts')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <Email />
                  </ListItemIcon>
                  <ListItemText
                    primary="Marketing Emails"
                    secondary="Receive marketing and promotional emails"
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      checked={notifications.marketingEmails}
                      onChange={handleNotificationChange('marketingEmails')}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              </List>
              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={saveNotificationSettings}
                  disabled={loading}
                >
                  Save Notification Settings
                </Button>
              </Box>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Integrations Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Third-Party Integrations
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <Phone />
                      </ListItemIcon>
                      <ListItemText
                        primary="WhatsApp Integration"
                        secondary="Enable WhatsApp messaging for customer communication"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={integrations.whatsappEnabled}
                          onChange={handleIntegrationChange('whatsappEnabled')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Email />
                      </ListItemIcon>
                      <ListItemText
                        primary="Email Integration"
                        secondary="Enable email notifications and communications"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={integrations.emailIntegration}
                          onChange={handleIntegrationChange('emailIntegration')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <Api />
                      </ListItemIcon>
                      <ListItemText
                        primary="API Access"
                        secondary="Enable API access for third-party applications"
                      />
                      <ListItemSecondaryAction>
                        <Switch
                          checked={integrations.apiAccess}
                          onChange={handleIntegrationChange('apiAccess')}
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                  <Divider sx={{ my: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>SMS Provider</InputLabel>
                        <Select
                          value={integrations.smsProvider}
                          label="SMS Provider"
                          onChange={(e) => setIntegrations(prev => ({
                            ...prev,
                            smsProvider: e.target.value
                          }))}
                        >
                          <MenuItem value="twilio">Twilio</MenuItem>
                          <MenuItem value="nexmo">Nexmo</MenuItem>
                          <MenuItem value="clickatell">Clickatell</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Webhook URL"
                        value={integrations.webhookUrl}
                        onChange={(e) => setIntegrations(prev => ({
                          ...prev,
                          webhookUrl: e.target.value
                        }))}
                        placeholder="https://your-webhook-url.com"
                      />
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      onClick={saveIntegrationSettings}
                      disabled={loading}
                    >
                      Save Integration Settings
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Data & Backup Tab */}
        <TabPanel value={tabValue} index={5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Data Export
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Export your data for backup or migration purposes
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button variant="outlined" startIcon={<Storage />}>
                      Export All Data
                    </Button>
                    <Button variant="outlined" startIcon={<Person />}>
                      Export User Data
                    </Button>
                    <Button variant="outlined" startIcon={<Business />}>
                      Export Company Data
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                    Backup Settings
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Configure automatic backup settings
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Automatic Backups"
                        secondary="Enable automatic daily backups"
                      />
                      <ListItemSecondaryAction>
                        <Switch defaultChecked />
                      </ListItemSecondaryAction>
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Cloud Storage"
                        secondary="Store backups in cloud storage"
                      />
                      <ListItemSecondaryAction>
                        <Switch defaultChecked />
                      </ListItemSecondaryAction>
                    </ListItem>
                  </List>
                  <Button variant="contained" startIcon={<Backup />} sx={{ mt: 2 }}>
                    Create Backup Now
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Data Retention Policy:</strong> We retain your data for as long as your account is active. 
                  You can request data deletion at any time by contacting support.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>

      {/* Password Change Dialog */}
      <FormDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        title="Change Password"
        subtitle="Enter your current password and choose a new one"
        onSubmit={passwordForm.handleSubmit(handlePasswordChange)}
        loading={loading}
        submitLabel="Change Password"
      >
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Controller
              name="currentPassword"
              control={passwordForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        edge="end"
                      >
                        {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="newPassword"
              control={passwordForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        edge="end"
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Controller
              name="confirmPassword"
              control={passwordForm.control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    endAdornment: (
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    ),
                  }}
                />
              )}
            />
          </Grid>
        </Grid>
      </FormDialog>
    </Box>
  );
};

export default SettingsPage;