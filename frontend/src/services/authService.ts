import axios, { AxiosResponse } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:12000/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  permissions: string[];
  profile: any;
  company: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier: string;
  };
  lastLoginAt?: string;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class AuthService {
  private token: string | null = null;

  constructor() {
    // Set up axios interceptors
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('salessync_refresh_token');
            if (refreshToken) {
              const response = await this.refreshToken(refreshToken);
              this.setToken(response.token);
              localStorage.setItem('salessync_token', response.token);
              
              // Retry the original request
              originalRequest.headers.Authorization = `Bearer ${response.token}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.clearTokens();
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private clearTokens() {
    this.token = null;
    localStorage.removeItem('salessync_token');
    localStorage.removeItem('salessync_refresh_token');
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response: AxiosResponse<APIResponse<LoginResponse>> = await axios.post(
      `${API_URL}/auth/login`,
      { email, password }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Login failed');
    }

    return response.data.data;
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const response: AxiosResponse<APIResponse<{ token: string }>> = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Token refresh failed');
    }

    return response.data.data;
  }

  async logout(): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } finally {
      this.clearTokens();
    }
  }

  async getProfile(): Promise<User> {
    const response: AxiosResponse<APIResponse<User>> = await axios.get(
      `${API_URL}/auth/me`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get profile');
    }

    return response.data.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response: AxiosResponse<APIResponse<any>> = await axios.post(
      `${API_URL}/auth/change-password`,
      { currentPassword, newPassword }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Password change failed');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const response: AxiosResponse<APIResponse<any>> = await axios.post(
      `${API_URL}/auth/forgot-password`,
      { email }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Password reset request failed');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response: AxiosResponse<APIResponse<any>> = await axios.post(
      `${API_URL}/auth/reset-password`,
      { token, newPassword }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Password reset failed');
    }
  }
}

export const authService = new AuthService();