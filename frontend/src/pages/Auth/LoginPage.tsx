import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
  Grid,
  ThemeProvider,
  createTheme,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

interface LoginFormData {
  email: string;
  password: string;
}

const loginSchema = yup.object().shape({
  email: yup.string().email('Invalid email format').required('Email is required'),
  password: yup.string().required('Password is required'),
});

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
  });

  // Modern Blue and Orange Theme
  const corporateTheme = createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: '#1E3A8A', // Deep Blue
        dark: '#1E40AF',
        light: '#3B82F6',
      },
      secondary: {
        main: '#FB923C', // Vibrant Orange
        dark: '#EA580C',
        light: '#FDBA74',
      },
      background: {
        default: '#F8FAFC',
        paper: '#FFFFFF',
      },
      text: {
        primary: '#374151',
        secondary: '#6B7280',
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            padding: '10px 24px',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setError('');
    try {
      await authService.login(data.email, data.password);
      console.log('Login successful!');
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={corporateTheme}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center" justifyContent="center">
            <Grid item xs={12} md={6}>
              <Box
                sx={{
                  textAlign: 'center',
                  mb: { xs: 4, md: 0 },
                  p: 4,
                }}
              >
                <Typography
                  variant="h2"
                  component="h1"
                  sx={{
                    fontWeight: 800,
                    mb: 2,
                    background: 'linear-gradient(135deg, #1E3A8A 0%, #FB923C 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  SalesSync AI
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 500,
                    mb: 4,
                    color: '#64748B',
                  }}
                >
                  Intelligent Field Sales Management
                </Typography>
                <Box
                  component="img"
                  src="/assets/login-illustration.svg"
                  alt="Sales Analytics Illustration"
                  sx={{
                    width: '100%',
                    maxWidth: 500,
                    filter: 'drop-shadow(0px 10px 20px rgba(30, 58, 138, 0.2))',
                  }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper
                elevation={2}
                sx={{
                  p: 4,
                  borderRadius: 3,
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                }}
              >
                <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: '#1E3A8A' }}>
                  Welcome Back
                </Typography>
                <Typography variant="body1" sx={{ mb: 4, color: '#64748B' }}>
                  Sign in to your account to continue
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                <form onSubmit={handleSubmit(onSubmit)}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    variant="outlined"
                    margin="normal"
                    {...register('email')}
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    sx={{ mb: 3 }}
                  />

                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    variant="outlined"
                    margin="normal"
                    {...register('password')}
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    sx={{ mb: 4 }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{
                      py: 1.5,
                      background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 100%)',
                      },
                    }}
                  >
                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
                  </Button>
                </form>

                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                    Forgot your password? Contact your administrator.
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default LoginPage;
