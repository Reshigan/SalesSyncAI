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
  createTheme,
  ThemeProvider,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Bolt,
  TrendingUp,
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
    { role: 'Company Admin', email: 'admin@salessync.com', password: 'admin123', icon: '👑' },
    { role: 'Regional Manager', email: 'manager@salessync.com', password: 'manager123', icon: '📊' },
    { role: 'Field Sales Agent', email: 'sales@salessync.com', password: 'sales123', icon: '🚀' },
    { role: 'Field Representative', email: 'field@salessync.com', password: 'field123', icon: '⚡' },
  ];

  // Dark Orange Theme
  const darkOrangeTheme = createTheme({
    palette: {
      mode: 'dark',
      primary: {
        main: '#FF6B35',
        dark: '#E55A2B',
        light: '#FF8A65',
      },
      secondary: {
        main: '#FF9500',
        dark: '#E6850E',
        light: '#FFB84D',
      },
      background: {
        default: '#0A0A0A',
        paper: '#1A1A1A',
      },
      text: {
        primary: '#FFFFFF',
        secondary: '#B0B0B0',
      },
    },
    typography: {
      fontFamily: 'Poppins, sans-serif',
      h4: {
        fontWeight: 800,
        background: 'linear-gradient(135deg, #FF6B35 0%, #FF9500 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)',
            border: '1px solid #333333',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              backgroundColor: '#1A1A1A',
              '& fieldset': {
                borderColor: '#333333',
                borderWidth: '2px',
              },
              '&:hover fieldset': {
                borderColor: '#FF6B35',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#FF6B35',
                boxShadow: '0 0 0 3px rgba(255, 107, 53, 0.1)',
              },
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '16px',
            padding: '12px 24px',
          },
          contained: {
            background: 'linear-gradient(135deg, #FF6B35 0%, #FF9500 100%)',
            boxShadow: '0 4px 20px rgba(255, 107, 53, 0.3)',
            '&:hover': {
              background: 'linear-gradient(135deg, #E55A2B 0%, #E6850E 100%)',
              transform: 'translateY(-2px)',
              boxShadow: '0 0 20px rgba(255, 107, 53, 0.5)',
            },
          },
          outlined: {
            borderColor: '#333333',
            borderWidth: '2px',
            color: '#FFFFFF',
            '&:hover': {
              borderColor: '#FF6B35',
              backgroundColor: 'rgba(255, 107, 53, 0.1)',
              transform: 'translateY(-1px)',
            },
          },
        },
      },
    },
  });

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
    <ThemeProvider theme={darkOrangeTheme}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 50%, #0A0A0A 100%)',
          position: 'relative',
          overflow: 'hidden',
          p: 2,
        }}
      >
        {/* Animated Background Elements */}
        <Box
          sx={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(255, 107, 53, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 6s ease-in-out infinite',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '20%',
            right: '15%',
            width: '150px',
            height: '150px',
            background: 'radial-gradient(circle, rgba(255, 149, 0, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            animation: 'float 8s ease-in-out infinite reverse',
          }}
        />

        <Box sx={{ width: '100%', maxWidth: 1200, display: 'flex', gap: 4, zIndex: 1 }}>
          {/* Login Form */}
          <Card
            className="fade-in"
            sx={{
              width: '100%',
              maxWidth: 400,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 20px rgba(255, 107, 53, 0.3)',
              },
            }}
          >
            <CardContent sx={{ p: 4 }}>
              {/* Logo and Title */}
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 80,
                    height: 80,
                    background: 'linear-gradient(135deg, #FF6B35 0%, #FF9500 100%)',
                    borderRadius: '20px',
                    mb: 2,
                    boxShadow: '0 4px 20px rgba(255, 107, 53, 0.3)',
                    animation: 'glow 2s ease-in-out infinite alternate',
                  }}
                >
                  <Bolt sx={{ fontSize: 40, color: 'white' }} />
                </Box>
                <Typography variant="h4" sx={{ mb: 1 }}>
                  SalesSync
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '16px', fontWeight: 500 }}>
                  ⚡ Power Your Sales Performance
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '14px', mt: 1, display: 'block' }}>
                  🚀 Field Marketing Platform
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
            className="slide-in-right"
            sx={{
              width: '100%',
              maxWidth: 400,
              display: { xs: 'none', md: 'block' },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 20px rgba(255, 107, 53, 0.3)',
              },
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <TrendingUp sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  🚀 Demo Access
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Click any role to auto-fill credentials
                </Typography>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                  ✨ Try different user roles instantly
                </Typography>
              </Box>

              {demoCredentials.map((cred, index) => (
                <Button
                  key={index}
                  fullWidth
                  variant="outlined"
                  onClick={() => fillDemoCredentials(cred.email, cred.password)}
                  sx={{
                    mb: 2,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    py: 2,
                    px: 3,
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255, 107, 53, 0.1), transparent)',
                      transition: 'left 0.5s',
                    },
                    '&:hover::before': {
                      left: '100%',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ fontSize: '24px' }}>{cred.icon}</Typography>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'white' }}>
                        {cred.role}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cred.email}
                      </Typography>
                    </Box>
                  </Box>
                </Button>
              ))}

              <Divider sx={{ my: 3, borderColor: '#333333' }} />

              <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, backgroundColor: 'rgba(255, 107, 53, 0.1)' }}>
                <Typography variant="body2" color="text.secondary">
                  <strong style={{ color: '#FF6B35' }}>Demo Company:</strong> Demo Company
                  <br />
                  <strong style={{ color: '#FF6B35' }}>Features:</strong> Full sales management suite
                  <br />
                  <strong style={{ color: '#FF6B35' }}>Status:</strong> Ready for testing 🎯
                </Typography>
              </Box>
            </CardContent>
          </Card>
      </Box>

        {/* GoNxt Developer Footer */}
        <GoNxtFooter />
      </Box>

      {/* Add floating animation keyframes */}
      <style>
        {`
          @keyframes float {
            0%, 100% {
              transform: translateY(0px) rotate(0deg);
            }
            50% {
              transform: translateY(-20px) rotate(180deg);
            }
          }
        `}
      </style>
    </ThemeProvider>
  );
};

export default LoginPage;