import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './src/screens/auth/LoginScreen';
import DashboardScreen from './src/screens/dashboard/DashboardScreen';
import VisitPlanScreen from './src/screens/field-sales/VisitPlanScreen';
import VisitExecutionScreen from './src/screens/field-sales/VisitExecutionScreen';
import CampaignListScreen from './src/screens/field-marketing/CampaignListScreen';
import CampaignExecutionScreen from './src/screens/field-marketing/CampaignExecutionScreen';
import ActivationListScreen from './src/screens/promotions/ActivationListScreen';
import ActivationExecutionScreen from './src/screens/promotions/ActivationExecutionScreen';

// Context
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { OfflineProvider } from './src/context/OfflineContext';

// Theme
import { theme } from './src/theme/theme';

// Types
export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  VisitPlan: undefined;
  VisitExecution: { visitId: string };
  CampaignList: undefined;
  CampaignExecution: { campaignId: string };
  ActivationList: undefined;
  ActivationExecution: { activationId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null; // Loading screen would go here
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? "Dashboard" : "Login"}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.primary,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        {user ? (
          // Authenticated screens
          <>
            <Stack.Screen 
              name="Dashboard" 
              component={DashboardScreen}
              options={{ title: 'SalesSync Dashboard' }}
            />
            <Stack.Screen 
              name="VisitPlan" 
              component={VisitPlanScreen}
              options={{ title: 'Visit Plan' }}
            />
            <Stack.Screen 
              name="VisitExecution" 
              component={VisitExecutionScreen}
              options={{ title: 'Visit Execution' }}
            />
            <Stack.Screen 
              name="CampaignList" 
              component={CampaignListScreen}
              options={{ title: 'Marketing Campaigns' }}
            />
            <Stack.Screen 
              name="CampaignExecution" 
              component={CampaignExecutionScreen}
              options={{ title: 'Campaign Execution' }}
            />
            <Stack.Screen 
              name="ActivationList" 
              component={ActivationListScreen}
              options={{ title: 'Activations' }}
            />
            <Stack.Screen 
              name="ActivationExecution" 
              component={ActivationExecutionScreen}
              options={{ title: 'Activation Execution' }}
            />
          </>
        ) : (
          // Unauthenticated screens
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <OfflineProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </OfflineProvider>
      </AuthProvider>
    </PaperProvider>
  );
}