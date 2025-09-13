import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1E3A8A', // Deep Blue
    accent: '#FB923C',  // Vibrant Orange
    success: '#10B981', // Fresh Green
    surface: '#FFFFFF',
    background: '#F8FAFC',
    text: '#374151',    // Charcoal Gray
    placeholder: '#9CA3AF',
    disabled: '#D1D5DB',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    light: {
      fontFamily: 'System',
      fontWeight: '300' as const,
    },
    thin: {
      fontFamily: 'System',
      fontWeight: '100' as const,
    },
  },
  roundness: 8,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  elevation: {
    small: 2,
    medium: 4,
    large: 8,
  },
};