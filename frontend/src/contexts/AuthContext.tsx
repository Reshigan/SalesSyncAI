import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authService, User } from '../services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_CLEAR_ERROR' };

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        loading: false,
        user: action.payload.user,
        token: action.payload.token,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        loading: false,
        user: null,
        token: null,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        loading: false,
        error: null,
      };
    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

const initialState: AuthState = {
  user: null,
  token: null,
  loading: true,
  error: null,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('salessync_token');
      
      if (token) {
        try {
          // Set token in service
          authService.setToken(token);
          
          // Get user profile
          const user = await authService.getProfile();
          
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user, token },
          });
        } catch (error) {
          // Token is invalid, remove it
          localStorage.removeItem('salessync_token');
          localStorage.removeItem('salessync_refresh_token');
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      } else {
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await authService.login(email, password);
      
      // Store tokens
      localStorage.setItem('salessync_token', response.token);
      localStorage.setItem('salessync_refresh_token', response.refreshToken);
      
      // Set token in service
      authService.setToken(response.token);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: response.user,
          token: response.token,
        },
      });

      console.log(`Welcome back, ${response.user.firstName}!`);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Login failed. Please try again.';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: errorMessage,
      });
      console.error(errorMessage);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Ignore logout errors
      console.warn('Logout error:', error);
    } finally {
      // Clear local storage
      localStorage.removeItem('salessync_token');
      localStorage.removeItem('salessync_refresh_token');
      
      // Clear token in service
      authService.setToken(null);
      
      dispatch({ type: 'AUTH_LOGOUT' });
      console.log('Logged out successfully');
    }
  };

  const clearError = () => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};