// Pricing and Subscription Models

export interface SubscriptionTier {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  features: PricingFeature[];
  limits: SubscriptionLimits;
  popular?: boolean;
  enterprise?: boolean;
}

export interface PricingFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface SubscriptionLimits {
  users: number;
  agents: number;
  visits: number; // per month
  campaigns: number; // active campaigns
  storage: number; // GB
  apiCalls: number; // per month
  customReports: number;
  dataRetention: number; // months
}

export interface CompanySubscription {
  id: string;
  companyId: string;
  tierId: string;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  billingCycle: 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  trialEndDate?: Date;
  autoRenew: boolean;
  paymentMethod?: PaymentMethod;
  usage: UsageMetrics;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_transfer' | 'invoice';
  details: {
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    bankName?: string;
    accountNumber?: string;
  };
  isDefault: boolean;
}

export interface UsageMetrics {
  period: string; // YYYY-MM
  users: number;
  agents: number;
  visits: number;
  campaigns: number;
  storageUsed: number; // GB
  apiCalls: number;
  customReports: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  items: InvoiceItem[];
  taxAmount: number;
  totalAmount: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Predefined subscription tiers
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'starter',
    displayName: 'Starter',
    description: 'Perfect for small teams getting started with field operations',
    price: {
      monthly: 299,
      yearly: 2990,
      currency: 'ZAR'
    },
    features: [
      { id: 'field_sales', name: 'Field Sales (DSD)', description: 'Complete field sales operations', included: true },
      { id: 'basic_reporting', name: 'Basic Reporting', description: 'Standard reports and analytics', included: true },
      { id: 'mobile_app', name: 'Mobile App', description: 'iOS and Android mobile applications', included: true },
      { id: 'gps_tracking', name: 'GPS Tracking', description: 'Real-time location tracking', included: true },
      { id: 'offline_sync', name: 'Offline Sync', description: 'Work offline and sync when connected', included: true },
      { id: 'email_support', name: 'Email Support', description: 'Email support during business hours', included: true },
      { id: 'field_marketing', name: 'Field Marketing', description: 'Campaign management and execution', included: false },
      { id: 'promotions', name: 'Promotions & Activations', description: 'Event management and activations', included: false },
      { id: 'ai_analytics', name: 'AI Analytics', description: 'Advanced AI-powered insights', included: false },
      { id: 'custom_reports', name: 'Custom Reports', description: 'Build custom reports and dashboards', included: false },
      { id: 'api_access', name: 'API Access', description: 'Full API access for integrations', included: false },
      { id: 'priority_support', name: 'Priority Support', description: '24/7 priority support', included: false }
    ],
    limits: {
      users: 5,
      agents: 10,
      visits: 1000,
      campaigns: 0,
      storage: 5,
      apiCalls: 10000,
      customReports: 0,
      dataRetention: 12
    }
  },
  {
    id: 'professional',
    name: 'professional',
    displayName: 'Professional',
    description: 'Comprehensive solution for growing field operations',
    price: {
      monthly: 799,
      yearly: 7990,
      currency: 'ZAR'
    },
    features: [
      { id: 'field_sales', name: 'Field Sales (DSD)', description: 'Complete field sales operations', included: true },
      { id: 'field_marketing', name: 'Field Marketing', description: 'Campaign management and execution', included: true },
      { id: 'basic_reporting', name: 'Basic Reporting', description: 'Standard reports and analytics', included: true },
      { id: 'mobile_app', name: 'Mobile App', description: 'iOS and Android mobile applications', included: true },
      { id: 'gps_tracking', name: 'GPS Tracking', description: 'Real-time location tracking', included: true },
      { id: 'offline_sync', name: 'Offline Sync', description: 'Work offline and sync when connected', included: true },
      { id: 'email_support', name: 'Email Support', description: 'Email support during business hours', included: true },
      { id: 'custom_reports', name: 'Custom Reports', description: 'Build custom reports and dashboards', included: true, limit: 10 },
      { id: 'api_access', name: 'API Access', description: 'Full API access for integrations', included: true },
      { id: 'promotions', name: 'Promotions & Activations', description: 'Event management and activations', included: false },
      { id: 'ai_analytics', name: 'AI Analytics', description: 'Advanced AI-powered insights', included: false },
      { id: 'priority_support', name: 'Priority Support', description: '24/7 priority support', included: false }
    ],
    limits: {
      users: 25,
      agents: 50,
      visits: 5000,
      campaigns: 10,
      storage: 25,
      apiCalls: 50000,
      customReports: 10,
      dataRetention: 24
    },
    popular: true
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Complete platform with all features for large organizations',
    price: {
      monthly: 1999,
      yearly: 19990,
      currency: 'ZAR'
    },
    features: [
      { id: 'field_sales', name: 'Field Sales (DSD)', description: 'Complete field sales operations', included: true },
      { id: 'field_marketing', name: 'Field Marketing', description: 'Campaign management and execution', included: true },
      { id: 'promotions', name: 'Promotions & Activations', description: 'Event management and activations', included: true },
      { id: 'ai_analytics', name: 'AI Analytics', description: 'Advanced AI-powered insights', included: true },
      { id: 'basic_reporting', name: 'Basic Reporting', description: 'Standard reports and analytics', included: true },
      { id: 'custom_reports', name: 'Custom Reports', description: 'Unlimited custom reports and dashboards', included: true },
      { id: 'mobile_app', name: 'Mobile App', description: 'iOS and Android mobile applications', included: true },
      { id: 'gps_tracking', name: 'GPS Tracking', description: 'Real-time location tracking', included: true },
      { id: 'offline_sync', name: 'Offline Sync', description: 'Work offline and sync when connected', included: true },
      { id: 'api_access', name: 'API Access', description: 'Full API access for integrations', included: true },
      { id: 'priority_support', name: 'Priority Support', description: '24/7 priority support', included: true },
      { id: 'white_label', name: 'White Label', description: 'Custom branding and white-label options', included: true },
      { id: 'dedicated_manager', name: 'Dedicated Account Manager', description: 'Dedicated customer success manager', included: true }
    ],
    limits: {
      users: -1, // unlimited
      agents: -1, // unlimited
      visits: -1, // unlimited
      campaigns: -1, // unlimited
      storage: 500,
      apiCalls: -1, // unlimited
      customReports: -1, // unlimited
      dataRetention: 60
    },
    enterprise: true
  }
];

// Usage calculation utilities
export class UsageCalculator {
  static calculateMonthlyUsage(companyId: string, period: string): Promise<UsageMetrics> {
    // Implementation would query database for actual usage
    return Promise.resolve({
      period,
      users: 0,
      agents: 0,
      visits: 0,
      campaigns: 0,
      storageUsed: 0,
      apiCalls: 0,
      customReports: 0
    });
  }

  static checkLimits(subscription: CompanySubscription, usage: UsageMetrics): LimitCheckResult {
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === subscription.tierId);
    if (!tier) {
      throw new Error('Invalid subscription tier');
    }

    const violations: LimitViolation[] = [];

    // Check each limit
    if (tier.limits.users !== -1 && usage.users > tier.limits.users) {
      violations.push({
        type: 'users',
        limit: tier.limits.users,
        current: usage.users,
        exceeded: usage.users - tier.limits.users
      });
    }

    if (tier.limits.agents !== -1 && usage.agents > tier.limits.agents) {
      violations.push({
        type: 'agents',
        limit: tier.limits.agents,
        current: usage.agents,
        exceeded: usage.agents - tier.limits.agents
      });
    }

    if (tier.limits.visits !== -1 && usage.visits > tier.limits.visits) {
      violations.push({
        type: 'visits',
        limit: tier.limits.visits,
        current: usage.visits,
        exceeded: usage.visits - tier.limits.visits
      });
    }

    if (tier.limits.campaigns !== -1 && usage.campaigns > tier.limits.campaigns) {
      violations.push({
        type: 'campaigns',
        limit: tier.limits.campaigns,
        current: usage.campaigns,
        exceeded: usage.campaigns - tier.limits.campaigns
      });
    }

    if (tier.limits.storage !== -1 && usage.storageUsed > tier.limits.storage) {
      violations.push({
        type: 'storage',
        limit: tier.limits.storage,
        current: usage.storageUsed,
        exceeded: usage.storageUsed - tier.limits.storage
      });
    }

    if (tier.limits.apiCalls !== -1 && usage.apiCalls > tier.limits.apiCalls) {
      violations.push({
        type: 'apiCalls',
        limit: tier.limits.apiCalls,
        current: usage.apiCalls,
        exceeded: usage.apiCalls - tier.limits.apiCalls
      });
    }

    return {
      withinLimits: violations.length === 0,
      violations,
      tier: tier.displayName,
      upgradeRecommended: violations.length > 0
    };
  }
}

export interface LimitCheckResult {
  withinLimits: boolean;
  violations: LimitViolation[];
  tier: string;
  upgradeRecommended: boolean;
}

export interface LimitViolation {
  type: 'users' | 'agents' | 'visits' | 'campaigns' | 'storage' | 'apiCalls' | 'customReports';
  limit: number;
  current: number;
  exceeded: number;
}