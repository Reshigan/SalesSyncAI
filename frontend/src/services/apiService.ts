import axios, { AxiosResponse } from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:12000/api';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Base API service class
class BaseAPIService {
  protected async get<T>(endpoint: string): Promise<T> {
    const response: AxiosResponse<APIResponse<T>> = await axios.get(`${API_URL}${endpoint}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'API request failed');
    }
    return response.data.data!;
  }

  protected async post<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<APIResponse<T>> = await axios.post(`${API_URL}${endpoint}`, data);
    if (!response.data.success) {
      throw new Error(response.data.error || 'API request failed');
    }
    return response.data.data!;
  }

  protected async put<T>(endpoint: string, data?: any): Promise<T> {
    const response: AxiosResponse<APIResponse<T>> = await axios.put(`${API_URL}${endpoint}`, data);
    if (!response.data.success) {
      throw new Error(response.data.error || 'API request failed');
    }
    return response.data.data!;
  }

  protected async delete<T>(endpoint: string): Promise<T> {
    const response: AxiosResponse<APIResponse<T>> = await axios.delete(`${API_URL}${endpoint}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'API request failed');
    }
    return response.data.data!;
  }
}

// User Management Service
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
  updatedAt: string;
  isActive: boolean;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  password: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
}

class UserService extends BaseAPIService {
  async getUsers(): Promise<User[]> {
    return this.get<User[]>('/admin/users');
  }

  async getUser(id: string): Promise<User> {
    return this.get<User>(`/admin/users/${id}`);
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    return this.post<User>('/admin/users', userData);
  }

  async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    return this.put<User>(`/admin/users/${id}`, userData);
  }

  async deleteUser(id: string): Promise<void> {
    return this.delete<void>(`/admin/users/${id}`);
  }

  async resetPassword(id: string): Promise<{ temporaryPassword: string }> {
    return this.post<{ temporaryPassword: string }>(`/admin/users/${id}/reset-password`);
  }
}

// Customer Management Service
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  customerType: string;
  status: string;
  assignedAgent?: User;
  lastVisitDate?: string;
  totalOrders: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  email?: string;
  phone?: string;
  address: string;
  latitude: number;
  longitude: number;
  customerType: string;
  assignedAgentId?: string;
}

class CustomerService extends BaseAPIService {
  async getCustomers(): Promise<Customer[]> {
    return this.get<Customer[]>('/field-sales/customers');
  }

  async getCustomer(id: string): Promise<Customer> {
    return this.get<Customer>(`/field-sales/customers/${id}`);
  }

  async createCustomer(customerData: CreateCustomerRequest): Promise<Customer> {
    return this.post<Customer>('/field-sales/customers', customerData);
  }

  async updateCustomer(id: string, customerData: Partial<CreateCustomerRequest>): Promise<Customer> {
    return this.put<Customer>(`/field-sales/customers/${id}`, customerData);
  }

  async deleteCustomer(id: string): Promise<void> {
    return this.delete<void>(`/field-sales/customers/${id}`);
  }
}

// Visit Management Service
export interface Visit {
  id: string;
  customer: Customer;
  agent: User;
  scheduledDate: string;
  actualDate?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  visitType: string;
  purpose: string;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  photos: string[];
  duration?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitRequest {
  customerId: string;
  scheduledDate: string;
  visitType: string;
  purpose: string;
  notes?: string;
}

class VisitService extends BaseAPIService {
  async getVisits(): Promise<Visit[]> {
    return this.get<Visit[]>('/field-sales/visits');
  }

  async getVisit(id: string): Promise<Visit> {
    return this.get<Visit>(`/field-sales/visits/${id}`);
  }

  async createVisit(visitData: CreateVisitRequest): Promise<Visit> {
    return this.post<Visit>('/field-sales/visits', visitData);
  }

  async updateVisit(id: string, visitData: Partial<CreateVisitRequest>): Promise<Visit> {
    return this.put<Visit>(`/field-sales/visits/${id}`, visitData);
  }

  async startVisit(id: string, location: { latitude: number; longitude: number }): Promise<Visit> {
    return this.post<Visit>(`/field-sales/visits/${id}/start`, { location });
  }

  async completeVisit(id: string, data: { notes?: string; photos?: string[] }): Promise<Visit> {
    return this.post<Visit>(`/field-sales/visits/${id}/complete`, data);
  }

  async cancelVisit(id: string, reason: string): Promise<Visit> {
    return this.post<Visit>(`/field-sales/visits/${id}/cancel`, { reason });
  }
}

// Campaign Management Service
export interface Campaign {
  id: string;
  name: string;
  description: string;
  type: 'brand_awareness' | 'product_launch' | 'promotion' | 'survey';
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: string;
  endDate: string;
  budget: number;
  targetAudience: string;
  materials: string[];
  assignedAgents: User[];
  metrics: {
    impressions: number;
    engagement: number;
    conversions: number;
    roi: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignRequest {
  name: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  budget: number;
  targetAudience: string;
  assignedAgentIds: string[];
}

class CampaignService extends BaseAPIService {
  async getCampaigns(): Promise<Campaign[]> {
    return this.get<Campaign[]>('/field-marketing/campaigns');
  }

  async getCampaign(id: string): Promise<Campaign> {
    return this.get<Campaign>(`/field-marketing/campaigns/${id}`);
  }

  async createCampaign(campaignData: CreateCampaignRequest): Promise<Campaign> {
    return this.post<Campaign>('/field-marketing/campaigns', campaignData);
  }

  async updateCampaign(id: string, campaignData: Partial<CreateCampaignRequest>): Promise<Campaign> {
    return this.put<Campaign>(`/field-marketing/campaigns/${id}`, campaignData);
  }

  async deleteCampaign(id: string): Promise<void> {
    return this.delete<void>(`/field-marketing/campaigns/${id}`);
  }

  async activateCampaign(id: string): Promise<Campaign> {
    return this.post<Campaign>(`/field-marketing/campaigns/${id}/activate`);
  }

  async pauseCampaign(id: string): Promise<Campaign> {
    return this.post<Campaign>(`/field-marketing/campaigns/${id}/pause`);
  }
}

// Order Management Service
export interface Order {
  id: string;
  customer: Customer;
  agent: User;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod?: string;
  deliveryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CreateOrderRequest {
  customerId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
  paymentMethod?: string;
  deliveryDate?: string;
  notes?: string;
}

class OrderService extends BaseAPIService {
  async getOrders(): Promise<Order[]> {
    return this.get<Order[]>('/field-sales/orders');
  }

  async getOrder(id: string): Promise<Order> {
    return this.get<Order>(`/field-sales/orders/${id}`);
  }

  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    return this.post<Order>('/field-sales/orders', orderData);
  }

  async updateOrder(id: string, orderData: Partial<CreateOrderRequest>): Promise<Order> {
    return this.put<Order>(`/field-sales/orders/${id}`, orderData);
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    return this.put<Order>(`/field-sales/orders/${id}/status`, { status });
  }

  async cancelOrder(id: string, reason: string): Promise<Order> {
    return this.post<Order>(`/field-sales/orders/${id}/cancel`, { reason });
  }
}

// Product Management Service
export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  isActive: boolean;
  images: string[];
  specifications: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

class ProductService extends BaseAPIService {
  async getProducts(): Promise<Product[]> {
    return this.get<Product[]>('/field-sales/products');
  }

  async getProduct(id: string): Promise<Product> {
    return this.get<Product>(`/field-sales/products/${id}`);
  }
}

// Reporting Service
export interface DashboardStats {
  totalSales: {
    value: number;
    change: number;
    changeType: 'positive' | 'negative' | 'neutral';
  };
  activeCampaigns: {
    value: number;
    change: number;
    changeType: 'positive' | 'negative' | 'neutral';
  };
  visitsCompleted: {
    value: number;
    change: number;
    changeType: 'positive' | 'negative' | 'neutral';
  };
  activeAgents: {
    value: number;
    change: number;
    changeType: 'positive' | 'negative' | 'neutral';
  };
}

export interface SalesReport {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topProducts: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }[];
  salesByAgent: {
    agentId: string;
    agentName: string;
    orders: number;
    revenue: number;
  }[];
  salesTrend: {
    date: string;
    revenue: number;
    orders: number;
  }[];
}

class ReportingService extends BaseAPIService {
  async getDashboardStats(): Promise<DashboardStats> {
    return this.get<DashboardStats>('/reporting/dashboard-stats');
  }

  async getSalesReport(startDate: string, endDate: string): Promise<SalesReport> {
    return this.get<SalesReport>(`/reporting/sales?startDate=${startDate}&endDate=${endDate}`);
  }

  async getVisitReport(startDate: string, endDate: string): Promise<any> {
    return this.get<any>(`/reporting/visits?startDate=${startDate}&endDate=${endDate}`);
  }

  async getCampaignReport(startDate: string, endDate: string): Promise<any> {
    return this.get<any>(`/reporting/campaigns?startDate=${startDate}&endDate=${endDate}`);
  }

  async exportReport(type: string, format: string, filters: any): Promise<Blob> {
    const response = await axios.post(
      `${API_URL}/reporting/export`,
      { type, format, filters },
      { responseType: 'blob' }
    );
    return response.data;
  }
}

// Survey Service
export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  status: 'draft' | 'active' | 'completed';
  targetAudience: string;
  responses: number;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: string;
  type: 'text' | 'multiple_choice' | 'rating' | 'yes_no' | 'photo';
  question: string;
  options?: string[];
  required: boolean;
}

class SurveyService extends BaseAPIService {
  async getSurveys(): Promise<Survey[]> {
    return this.get<Survey[]>('/field-marketing/surveys');
  }

  async getSurvey(id: string): Promise<Survey> {
    return this.get<Survey>(`/field-marketing/surveys/${id}`);
  }

  async createSurvey(surveyData: Partial<Survey>): Promise<Survey> {
    return this.post<Survey>('/field-marketing/surveys', surveyData);
  }

  async updateSurvey(id: string, surveyData: Partial<Survey>): Promise<Survey> {
    return this.put<Survey>(`/field-marketing/surveys/${id}`, surveyData);
  }

  async deleteSurvey(id: string): Promise<void> {
    return this.delete<void>(`/field-marketing/surveys/${id}`);
  }
}

// Export service instances
export const userService = new UserService();
export const customerService = new CustomerService();
export const visitService = new VisitService();
export const campaignService = new CampaignService();
export const orderService = new OrderService();
export const productService = new ProductService();
export const reportingService = new ReportingService();
export const surveyService = new SurveyService();