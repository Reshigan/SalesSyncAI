import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Link,
  Divider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Business,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/Common/LoadingSpinner';
import GoNxtFooter from '../../components/Layout/GoNxtFooter';

interface LoginFormData {
  email: string;
  password: string;
}

const schema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

const LoginPage: React.FC = () => {
  const { login, loading, error, clearError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: LoginFormData) => {
    clearError();
    try {
      await login(data.email, data.password);
    } catch (error) {
      // Error is handled in the auth context
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const demoCredentials = [
    { role: 'Company Admin', email: 'demo@techcorp.com', password: 'Demo123!' },
    { role: 'Area Manager', email: 'manager@techcorp.com', password: 'Manager123!' },
    { role: 'Field Sales Agent', email: 'agent1@techcorp.com', password: 'Agent123!' },
    { role: 'Field Sales Agent', email: 'agent2@techcorp.com', password: 'Agent123!' },
    { role: 'Field Sales Agent', email: 'agent3@techcorp.com', password: 'Agent123!' },
  ];

  const fillDemoCredentials = (email: string, password: string) => {
    const emailField = document.getElementById('email') as HTMLInputElement;
    const passwordField = document.getElementById('password') as HTMLInputElement;
    
    if (emailField && passwordField) {
      emailField.value = email;
      passwordField.value = password;
      
      // Trigger change events
      emailField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1200, display: 'flex', gap: 4 }}>
        {/* Login Form */}
        <Card
          sx={{
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Logo and Title */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Business sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                SalesSync
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sync Your Success in the Field
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit(onSubmit)}>
              <TextField
                id="email"
                fullWidth
                label="Email Address"
                type="email"
                margin="normal"
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                id="password"
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                margin="normal"
                {...register('password')}
                error={!!errors.password}
                helperText={errors.password?.message}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={togglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {loading ? <LoadingSpinner size={24} message="" /> : 'Sign In'}
              </Button>

              <Box sx={{ textAlign: 'center' }}>
                <Link href="#" variant="body2" color="primary">
                  Forgot your password?
                </Link>
              </Box>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card
          sx={{
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: { xs: 'none', md: 'block' },
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3, textAlign: 'center' }}>
              Demo Credentials
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Click on any role below to auto-fill the login form
            </Typography>

            {demoCredentials.map((cred, index) => (
              <Box key={index}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => fillDemoCredentials(cred.email, cred.password)}
                  sx={{
                    mb: 2,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    py: 1.5,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {cred.role}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cred.email}
                    </Typography>
                  </Box>
                </Button>
              </Box>
            ))}

            <Divider sx={{ my: 3 }} />

            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              <strong>Demo Company:</strong> TechCorp Solutions
              <br />
              <strong>Features:</strong> Complete tech product catalog with realistic sales data
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* GoNxt Developer Footer */}
      <GoNxtFooter />
    </Box>
  );
};

export default LoginPage;