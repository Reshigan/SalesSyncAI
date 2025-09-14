import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { SUBSCRIPTION_TIERS, UsageCalculator } from '../models/pricing';

const router = Router();

// Get all subscription tiers (public)
router.get('/tiers', async (req, res) => {
  try {
    res.json({
      success: true,
      data: SUBSCRIPTION_TIERS
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription tiers'
    });
  }
});

// Get specific tier details (public)
router.get('/tiers/:tierId', async (req, res) => {
  try {
    const { tierId } = req.params;
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
    
    if (!tier) {
      return res.status(404).json({
        success: false,
        error: 'Subscription tier not found'
      });
    }

    res.json({
      success: true,
      data: tier
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription tier'
    });
  }
});

// Get company subscription (authenticated)
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user!;
    
    // Mock subscription data - in real implementation, fetch from database
    const subscription = {
      id: 'sub_' + companyId,
      companyId,
      tierId: 'professional',
      status: 'active' as const,
      billingCycle: 'monthly' as const,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      autoRenew: true,
      usage: await UsageCalculator.calculateMonthlyUsage(companyId, '2024-09')
    };

    const tier = SUBSCRIPTION_TIERS.find(t => t.id === subscription.tierId);
    const limitCheck = UsageCalculator.checkLimits(subscription, subscription.usage);

    res.json({
      success: true,
      data: {
        subscription,
        tier,
        usage: subscription.usage,
        limits: limitCheck
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription details'
    });
  }
});

// Get usage metrics (authenticated)
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user!;
    const { period } = req.query;
    
    const currentPeriod = period as string || new Date().toISOString().substring(0, 7);
    const usage = await UsageCalculator.calculateMonthlyUsage(companyId, currentPeriod);
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage metrics'
    });
  }
});

// Calculate pricing for upgrade (authenticated)
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { tierId, billingCycle } = req.body;
    
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
    if (!tier) {
      return res.status(404).json({
        success: false,
        error: 'Subscription tier not found'
      });
    }

    const price = billingCycle === 'yearly' ? tier.price.yearly : tier.price.monthly;
    const discount = billingCycle === 'yearly' ? Math.round(((tier.price.monthly * 12) - tier.price.yearly) / (tier.price.monthly * 12) * 100) : 0;
    
    const calculation = {
      tier: tier.displayName,
      tierId: tier.id,
      billingCycle,
      price,
      currency: tier.price.currency,
      discount,
      savings: billingCycle === 'yearly' ? (tier.price.monthly * 12) - tier.price.yearly : 0,
      features: tier.features.filter(f => f.included),
      limits: tier.limits
    };

    res.json({
      success: true,
      data: calculation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to calculate pricing'
    });
  }
});

// Request upgrade quote (authenticated)
router.post('/quote', authenticateToken, async (req, res) => {
  try {
    const { companyId, email } = req.user!;
    const { tierId, billingCycle, message } = req.body;
    
    const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId);
    if (!tier) {
      return res.status(404).json({
        success: false,
        error: 'Subscription tier not found'
      });
    }

    // In real implementation, this would:
    // 1. Create a quote record in database
    // 2. Send notification to sales team
    // 3. Send confirmation email to customer
    
    const quote = {
      id: 'quote_' + Date.now(),
      companyId,
      tierId,
      billingCycle,
      requestedBy: {
        email,
        firstName: 'User',
        lastName: 'Name'
      },
      message,
      status: 'pending',
      createdAt: new Date(),
      tier: tier.displayName,
      estimatedPrice: billingCycle === 'yearly' ? tier.price.yearly : tier.price.monthly,
      currency: tier.price.currency
    };

    res.json({
      success: true,
      data: quote,
      message: 'Quote request submitted successfully. Our sales team will contact you within 24 hours.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to submit quote request'
    });
  }
});

// Get billing history (authenticated)
router.get('/billing', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user!;
    
    // Mock billing history - in real implementation, fetch from database
    const billingHistory = [
      {
        id: 'inv_001',
        invoiceNumber: 'SS-2024-001',
        amount: 799,
        currency: 'ZAR',
        status: 'paid',
        issueDate: new Date('2024-09-01'),
        dueDate: new Date('2024-09-15'),
        paidDate: new Date('2024-09-10'),
        description: 'SalesSync Professional - September 2024'
      },
      {
        id: 'inv_002',
        invoiceNumber: 'SS-2024-002',
        amount: 799,
        currency: 'ZAR',
        status: 'paid',
        issueDate: new Date('2024-08-01'),
        dueDate: new Date('2024-08-15'),
        paidDate: new Date('2024-08-12'),
        description: 'SalesSync Professional - August 2024'
      }
    ];

    res.json({
      success: true,
      data: billingHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing history'
    });
  }
});

export default router;