import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  Title,
  Paragraph,
  Card,
  ActivityIndicator,
  Snackbar,
} from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme/theme';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (role: string) => {
    switch (role) {
      case 'admin':
        setEmail('admin@testcompany.com');
        setPassword('admin123');
        break;
      case 'agent':
        setEmail('agent@testcompany.com');
        setPassword('admin123');
        break;
      case 'marketing':
        setEmail('marketing@testcompany.com');
        setPassword('admin123');
        break;
      case 'promoter':
        setEmail('promoter@testcompany.com');
        setPassword('admin123');
        break;
      default:
        break;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.logoContainer}>
          <Title style={styles.title}>SalesSync</Title>
          <Paragraph style={styles.subtitle}>
            Sync Your Success in the Field
          </Paragraph>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
              disabled={loading}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
              disabled={loading}
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              style={styles.loginButton}
              disabled={loading}
              loading={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>

            <View style={styles.demoSection}>
              <Paragraph style={styles.demoTitle}>Demo Accounts:</Paragraph>
              <View style={styles.demoButtons}>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => fillDemoCredentials('admin')}
                  style={styles.demoButton}
                  disabled={loading}
                >
                  Admin
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => fillDemoCredentials('agent')}
                  style={styles.demoButton}
                  disabled={loading}
                >
                  Agent
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => fillDemoCredentials('marketing')}
                  style={styles.demoButton}
                  disabled={loading}
                >
                  Marketing
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => fillDemoCredentials('promoter')}
                  style={styles.demoButton}
                  disabled={loading}
                >
                  Promoter
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Snackbar
          visible={!!error}
          onDismiss={() => setError('')}
          duration={4000}
          style={styles.snackbar}
        >
          {error}
        </Snackbar>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  card: {
    elevation: theme.elevation.medium,
    borderRadius: theme.roundness * 2,
  },
  input: {
    marginBottom: theme.spacing.md,
  },
  loginButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  demoSection: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  demoTitle: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontWeight: '500',
  },
  demoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  demoButton: {
    marginHorizontal: theme.spacing.xs,
    marginVertical: theme.spacing.xs,
  },
  snackbar: {
    backgroundColor: theme.colors.error,
  },
});

export default LoginScreen;