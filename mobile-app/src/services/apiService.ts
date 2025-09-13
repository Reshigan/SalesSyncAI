import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use localhost for development, production URL for builds
    this.baseURL = __DEV__ 
      ? 'http://localhost:12000/api' 
      : 'https://api.salessync.com/api';

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      async (config) => {
        // Add auth token if available
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add tenant ID if available
        const user = await AsyncStorage.getItem('user');
        if (user) {
          const userData = JSON.parse(user);
          config.headers['X-Tenant-ID'] = userData.companyId;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 errors (unauthorized)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh token
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await this.post('/auth/refresh', {
                refreshToken,
              });

              if (response.data.success) {
                const { token } = response.data.data;
                await AsyncStorage.setItem('authToken', token);
                
                // Retry original request with new token
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return this.api(originalRequest);
              }
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user']);
            // Navigation to login would be handled by AuthContext
          }
        }

        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
  }

  // HTTP Methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.put(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.patch(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.api.delete(url, config);
  }

  // File upload
  async uploadFile(url: string, file: any, onUploadProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type || 'image/jpeg',
      name: file.name || 'image.jpg',
    } as any);

    return this.api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onUploadProgress(progress);
        }
      },
    });
  }

  // Batch requests
  async batch(requests: Array<{ method: string; url: string; data?: any }>) {
    const promises = requests.map(request => {
      switch (request.method.toLowerCase()) {
        case 'get':
          return this.get(request.url);
        case 'post':
          return this.post(request.url, request.data);
        case 'put':
          return this.put(request.url, request.data);
        case 'delete':
          return this.delete(request.url);
        default:
          throw new Error(`Unsupported method: ${request.method}`);
      }
    });

    return Promise.allSettled(promises);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

export const apiService = new ApiService();