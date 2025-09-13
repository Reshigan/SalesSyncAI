import { PrismaClient, UserRole, CampaignType, CampaignStatus, VisitStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Super Admin
  const superAdminPassword = await bcrypt.hash('SuperAdmin123!', 12);
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@salessync.com' },
    update: {},
    create: {
      email: 'superadmin@salessync.com',
      password: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+27123456789',
      role: UserRole.SUPER_ADMIN,
      permissions: ['*'], // All permissions
      profile: {
        avatar: null,
        bio: 'System Super Administrator',
        preferences: {
          theme: 'light',
          notifications: true
        }
      },
      companyId: '00000000-0000-0000-0000-000000000000' // Placeholder for super admin
    }
  });

  console.log('✅ Super Admin created');

  // Create Test Company
  const testCompany = await prisma.company.upsert({
    where: { slug: 'testcompany' },
    update: {},
    create: {
      name: 'TestCompany Ltd',
      slug: 'testcompany',
      logo: 'https://via.placeholder.com/200x200?text=TestCompany',
      settings: {
        currency: 'ZAR',
        timezone: 'Africa/Johannesburg',
        language: 'en',
        features: {
          fieldSales: true,
          fieldMarketing: true,
          promotions: true,
          aiAnalytics: true,
          fraudDetection: true
        }
      },
      subscriptionTier: 'enterprise',
      isActive: true
    }
  });

  console.log('✅ Test Company created');

  // Create Company Admin
  const adminPassword = await bcrypt.hash('TestAdmin123!', 12);
  
  const companyAdmin = await prisma.user.upsert({
    where: { email: 'admin@testcompany.com' },
    update: {},
    create: {
      companyId: testCompany.id,
      email: 'admin@testcompany.com',
      password: adminPassword,
      firstName: 'John',
      lastName: 'Administrator',
      phone: '+27123456790',
      role: UserRole.COMPANY_ADMIN,
      permissions: [
        'users.manage',
        'campaigns.manage',
        'reports.view',
        'settings.manage',
        'warehouses.manage',
        'products.manage'
      ],
      profile: {
        avatar: null,
        bio: 'Company Administrator',
        department: 'Management'
      }
    }
  });

  // Create Regional Manager
  const regionalManagerPassword = await bcrypt.hash('RegionalManager123!', 12);
  
  const regionalManager = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'regional.manager@testcompany.com',
      password: regionalManagerPassword,
      firstName: 'Sarah',
      lastName: 'Regional',
      phone: '+27123456791',
      role: UserRole.REGIONAL_MANAGER,
      permissions: [
        'agents.manage',
        'visits.view',
        'reports.view',
        'campaigns.view'
      ],
      profile: {
        region: 'Gauteng',
        territory: 'Johannesburg Metro'
      }
    }
  });

  // Create Field Sales Agent
  const salesAgentPassword = await bcrypt.hash('SalesAgent123!', 12);
  
  const salesAgent = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'sales.agent@testcompany.com',
      password: salesAgentPassword,
      firstName: 'Mike',
      lastName: 'Salesperson',
      phone: '+27123456792',
      role: UserRole.FIELD_SALES_AGENT,
      permissions: [
        'visits.create',
        'sales.create',
        'stock.draw',
        'cash.reconcile'
      ],
      profile: {
        employeeId: 'SA001',
        territory: 'Sandton',
        vehicleRegistration: 'GP123ABC'
      }
    }
  });

  // Create Field Marketing Agent
  const marketingAgentPassword = await bcrypt.hash('MarketingAgent123!', 12);
  
  const marketingAgent = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'marketing.agent@testcompany.com',
      password: marketingAgentPassword,
      firstName: 'Lisa',
      lastName: 'Marketer',
      phone: '+27123456793',
      role: UserRole.FIELD_MARKETING_AGENT,
      permissions: [
        'campaigns.execute',
        'surveys.create',
        'customers.create',
        'materials.manage'
      ],
      profile: {
        employeeId: 'MA001',
        specialization: 'Brand Activation'
      }
    }
  });

  // Create Promoter
  const promoterPassword = await bcrypt.hash('Promoter123!', 12);
  
  const promoter = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'promoter@testcompany.com',
      password: promoterPassword,
      firstName: 'David',
      lastName: 'Promoter',
      phone: '+27123456794',
      role: UserRole.PROMOTER,
      permissions: [
        'activations.execute',
        'events.manage',
        'content.create'
      ],
      profile: {
        employeeId: 'PR001',
        eventExperience: 'Consumer Electronics, FMCG'
      }
    }
  });

  console.log('✅ Users created');

  // Create Warehouses
  const mainWarehouse = await prisma.warehouse.create({
    data: {
      companyId: testCompany.id,
      name: 'Main Distribution Center',
      address: '123 Industrial Road, Johannesburg, 2000',
      coordinates: {
        lat: -26.2041,
        lng: 28.0473
      },
      managerId: companyAdmin.id,
      isActive: true
    }
  });

  const secondaryWarehouse = await prisma.warehouse.create({
    data: {
      companyId: testCompany.id,
      name: 'Sandton Hub',
      address: '456 Business Avenue, Sandton, 2196',
      coordinates: {
        lat: -26.1076,
        lng: 28.0567
      },
      managerId: regionalManager.id,
      isActive: true
    }
  });

  // Assign agents to warehouses
  await prisma.userWarehouse.createMany({
    data: [
      { userId: salesAgent.id, warehouseId: mainWarehouse.id },
      { userId: salesAgent.id, warehouseId: secondaryWarehouse.id },
      { userId: marketingAgent.id, warehouseId: mainWarehouse.id }
    ]
  });

  console.log('✅ Warehouses created');

  // Create Brands
  const cocaColaBrand = await prisma.brand.create({
    data: {
      companyId: testCompany.id,
      name: 'Coca-Cola',
      logo: 'https://via.placeholder.com/150x150?text=Coca-Cola',
      description: 'The world\'s favorite soft drink',
      isActive: true
    }
  });

  const samsungBrand = await prisma.brand.create({
    data: {
      companyId: testCompany.id,
      name: 'Samsung',
      logo: 'https://via.placeholder.com/150x150?text=Samsung',
      description: 'Leading technology brand',
      isActive: true
    }
  });

  console.log('✅ Brands created');

  // Create Products
  const products = await prisma.product.createMany({
    data: [
      {
        companyId: testCompany.id,
        brandId: cocaColaBrand.id,
        name: 'Coca-Cola 330ml Can',
        description: 'Classic Coca-Cola in 330ml can',
        sku: 'CC-330-CAN',
        barcode: '1234567890123',
        category: 'Beverages',
        unitPrice: 12.50,
        isActive: true
      },
      {
        companyId: testCompany.id,
        brandId: cocaColaBrand.id,
        name: 'Coca-Cola 500ml Bottle',
        description: 'Classic Coca-Cola in 500ml bottle',
        sku: 'CC-500-BTL',
        barcode: '1234567890124',
        category: 'Beverages',
        unitPrice: 18.00,
        isActive: true
      },
      {
        companyId: testCompany.id,
        brandId: samsungBrand.id,
        name: 'Samsung Galaxy A54',
        description: 'Samsung Galaxy A54 5G Smartphone',
        sku: 'SAM-A54-5G',
        barcode: '1234567890125',
        category: 'Electronics',
        unitPrice: 8999.00,
        isActive: true
      },
      {
        companyId: testCompany.id,
        brandId: samsungBrand.id,
        name: 'Samsung Galaxy Buds2',
        description: 'Samsung Galaxy Buds2 Wireless Earbuds',
        sku: 'SAM-BUDS2',
        barcode: '1234567890126',
        category: 'Electronics',
        unitPrice: 2499.00,
        isActive: true
      }
    ]
  });

  console.log('✅ Products created');

  // Get created products for stock levels
  const allProducts = await prisma.product.findMany({
    where: { companyId: testCompany.id }
  });

  // Create Stock Levels
  const stockLevels = [];
  for (const product of allProducts) {
    stockLevels.push(
      {
        warehouseId: mainWarehouse.id,
        productId: product.id,
        quantity: Math.floor(Math.random() * 1000) + 100,
        reservedQty: Math.floor(Math.random() * 50)
      },
      {
        warehouseId: secondaryWarehouse.id,
        productId: product.id,
        quantity: Math.floor(Math.random() * 500) + 50,
        reservedQty: Math.floor(Math.random() * 25)
      }
    );
  }

  await prisma.stockLevel.createMany({
    data: stockLevels
  });

  console.log('✅ Stock levels created');

  // Create Customers
  const customers = [];
  const customerNames = [
    'Spaza Shop Corner', 'Mini Market Express', 'Fresh Foods Store', 'Quick Stop Convenience',
    'Local Grocery Hub', 'Community Store', 'Neighborhood Market', 'Daily Needs Shop',
    'Corner Cafe & Store', 'Village Market', 'Express Mini Mart', 'Local Food Store',
    'Community Corner Shop', 'Quick Buy Store', 'Fresh Market', 'Daily Essentials',
    'Local Convenience', 'Mini Supermarket', 'Corner Store Plus', 'Community Mart'
  ];

  for (let i = 0; i < 20; i++) {
    customers.push({
      companyId: testCompany.id,
      name: customerNames[i],
      contactPerson: `Owner ${i + 1}`,
      phone: `+2712345${String(i + 1).padStart(4, '0')}`,
      email: `owner${i + 1}@example.com`,
      address: `${100 + i} Main Street, Johannesburg, 200${i % 10}`,
      coordinates: {
        lat: -26.2041 + (Math.random() - 0.5) * 0.1,
        lng: 28.0473 + (Math.random() - 0.5) * 0.1
      },
      category: i % 3 === 0 ? 'Spaza Shop' : i % 3 === 1 ? 'Mini Market' : 'Convenience Store',
      creditLimit: Math.floor(Math.random() * 10000) + 1000,
      isActive: true
    });
  }

  await prisma.customer.createMany({
    data: customers
  });

  const allCustomers = await prisma.customer.findMany({
    where: { companyId: testCompany.id }
  });

  console.log('✅ Customers created');

  // Create Historical Visits (2+ years of data)
  const visits = [];
  const startDate = new Date('2022-01-01');
  const endDate = new Date();
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    // Create 3-5 visits per day
    const visitsPerDay = Math.floor(Math.random() * 3) + 3;
    
    for (let v = 0; v < visitsPerDay; v++) {
      const customer = allCustomers[Math.floor(Math.random() * allCustomers.length)];
      const visitDate = new Date(d);
      visitDate.setHours(8 + v * 2, Math.floor(Math.random() * 60), 0, 0);
      
      const endTime = new Date(visitDate);
      endTime.setMinutes(endTime.getMinutes() + Math.floor(Math.random() * 60) + 30);
      
      visits.push({
        companyId: testCompany.id,
        agentId: salesAgent.id,
        customerId: customer.id,
        plannedStartTime: visitDate,
        actualStartTime: visitDate,
        actualEndTime: endTime,
        status: VisitStatus.COMPLETED,
        gpsLocation: {
          arrival: {
            lat: (customer.coordinates as any).lat + (Math.random() - 0.5) * 0.001,
            lng: (customer.coordinates as any).lng + (Math.random() - 0.5) * 0.001
          },
          departure: {
            lat: (customer.coordinates as any).lat + (Math.random() - 0.5) * 0.001,
            lng: (customer.coordinates as any).lng + (Math.random() - 0.5) * 0.001
          }
        },
        activities: [
          { type: 'survey', status: 'completed', duration: 300 },
          { type: 'sale', status: 'completed', duration: 600 },
          { type: 'photo', status: 'completed', duration: 120 }
        ],
        photos: [
          { url: 'https://via.placeholder.com/800x600?text=Store+Front', type: 'store_exterior' },
          { url: 'https://via.placeholder.com/800x600?text=Product+Display', type: 'product_display' }
        ],
        notes: `Visit completed successfully. Customer satisfied with service.`,
        syncStatus: 'SYNCED'
      });
    }
  }

  // Create visits in batches to avoid memory issues
  const batchSize = 100;
  for (let i = 0; i < visits.length; i += batchSize) {
    const batch = visits.slice(i, i + batchSize);
    await prisma.visit.createMany({
      data: batch
    });
  }

  console.log(`✅ ${visits.length} Historical visits created`);

  // Create Historical Sales
  const allVisits = await prisma.visit.findMany({
    where: { companyId: testCompany.id },
    take: 500 // Limit for performance
  });

  const sales = [];
  let invoiceCounter = 1;

  for (const visit of allVisits) {
    // 70% of visits result in sales
    if (Math.random() < 0.7) {
      const saleProducts = allProducts.slice(0, Math.floor(Math.random() * 3) + 1);
      let totalAmount = 0;
      
      const saleItems = saleProducts.map(product => {
        const quantity = Math.floor(Math.random() * 10) + 1;
        const unitPrice = Number(product.unitPrice);
        const total = quantity * unitPrice;
        totalAmount += total;
        
        return {
          productId: product.id,
          quantity,
          unitPrice,
          discount: 0,
          total
        };
      });

      const paymentMethod = Math.random() < 0.8 ? PaymentMethod.CASH : PaymentMethod.CARD;
      
      sales.push({
        companyId: testCompany.id,
        agentId: visit.agentId,
        customerId: visit.customerId,
        visitId: visit.id,
        invoiceNumber: `INV-${String(invoiceCounter++).padStart(6, '0')}`,
        totalAmount,
        taxAmount: totalAmount * 0.15, // 15% VAT
        discountAmount: 0,
        paymentMethod,
        paymentStatus: PaymentStatus.PAID,
        paidAmount: totalAmount,
        createdAt: visit.actualStartTime || visit.plannedStartTime
      });
    }
  }

  // Create sales in batches
  for (let i = 0; i < sales.length; i += batchSize) {
    const batch = sales.slice(i, i + batchSize);
    await prisma.sale.createMany({
      data: batch
    });
  }

  console.log(`✅ ${sales.length} Historical sales created`);

  // Create Campaigns
  const campaigns = await prisma.campaign.createMany({
    data: [
      {
        companyId: testCompany.id,
        brandId: cocaColaBrand.id,
        name: 'Summer Refresh Campaign',
        description: 'Promote Coca-Cola during summer season',
        type: CampaignType.BRAND_ACTIVATION,
        startDate: new Date('2024-12-01'),
        endDate: new Date('2025-02-28'),
        budget: 50000,
        status: CampaignStatus.ACTIVE,
        materials: [
          { type: 'banner', name: 'Summer Refresh Banner', quantity: 10 },
          { type: 'standee', name: 'Coca-Cola Standee', quantity: 5 }
        ],
        targets: {
          visits: 1000,
          sales: 500,
          newCustomers: 100
        },
        territories: ['Johannesburg', 'Sandton', 'Randburg']
      },
      {
        companyId: testCompany.id,
        brandId: samsungBrand.id,
        name: 'Galaxy A54 Launch',
        description: 'Launch campaign for Samsung Galaxy A54',
        type: CampaignType.PRODUCT_LAUNCH,
        startDate: new Date('2024-11-01'),
        endDate: new Date('2024-12-31'),
        budget: 100000,
        status: CampaignStatus.ACTIVE,
        materials: [
          { type: 'demo_unit', name: 'Galaxy A54 Demo', quantity: 20 },
          { type: 'brochure', name: 'Product Brochure', quantity: 1000 }
        ],
        targets: {
          demonstrations: 500,
          leads: 200,
          sales: 100
        },
        territories: ['Gauteng Province']
      }
    ]
  });

  console.log('✅ Campaigns created');

  // Create Surveys
  const brandSurvey = await prisma.survey.create({
    data: {
      companyId: testCompany.id,
      title: 'Brand Awareness Survey',
      description: 'Survey to measure brand awareness and customer preferences',
      questions: [
        {
          id: '1',
          question: 'Which soft drink brands are you familiar with?',
          type: 'multiple_choice',
          options: ['Coca-Cola', 'Pepsi', 'Fanta', 'Sprite', 'Other'],
          required: true
        },
        {
          id: '2',
          question: 'How often do you purchase soft drinks?',
          type: 'multiple_choice',
          options: ['Daily', 'Weekly', 'Monthly', 'Rarely', 'Never'],
          required: true
        },
        {
          id: '3',
          question: 'Rate your satisfaction with Coca-Cola products',
          type: 'rating',
          scale: 5,
          required: true
        },
        {
          id: '4',
          question: 'Take a photo of the current product display',
          type: 'photo',
          required: true,
          photoRequirements: {
            minWidth: 800,
            minHeight: 600,
            quality: 0.8
          }
        }
      ],
      isActive: true
    }
  });

  console.log('✅ Surveys created');

  // Create Brand Questionnaires
  const cocaColaQuestionnaire = await prisma.brandQuestionnaire.create({
    data: {
      brandId: cocaColaBrand.id,
      title: 'Coca-Cola Brand Assessment',
      questions: [
        {
          id: '1',
          question: 'How visible are Coca-Cola products in this store?',
          type: 'rating',
          scale: 5,
          required: true
        },
        {
          id: '2',
          question: 'What is the approximate shelf space percentage for Coca-Cola?',
          type: 'number',
          required: true
        },
        {
          id: '3',
          question: 'Take a photo of the beverage section showing Coca-Cola placement',
          type: 'photo',
          required: true,
          photoRequirements: {
            description: 'Clear view of beverage shelf with Coca-Cola products visible'
          }
        }
      ],
      estimatedDuration: 10,
      incentivePerCompletion: 25.00,
      isActive: true
    }
  });

  console.log('✅ Brand questionnaires created');

  // Create some recent survey responses
  const recentVisits = await prisma.visit.findMany({
    where: {
      companyId: testCompany.id,
      actualStartTime: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    },
    take: 50
  });

  const surveyResponses = recentVisits.map(visit => ({
    surveyId: brandSurvey.id,
    visitId: visit.id,
    agentId: visit.agentId,
    responses: [
      { questionId: '1', answer: ['Coca-Cola', 'Pepsi', 'Fanta'] },
      { questionId: '2', answer: 'Weekly' },
      { questionId: '3', answer: 4 },
      { questionId: '4', answer: 'https://via.placeholder.com/800x600?text=Product+Display' }
    ],
    completionTime: Math.floor(Math.random() * 300) + 180, // 3-8 minutes
    qualityScore: Math.random() * 2 + 3, // 3-5 score
    fraudRiskScore: Math.random() * 1 // 0-1 score
  }));

  await prisma.surveyResponse.createMany({
    data: surveyResponses
  });

  console.log('✅ Survey responses created');

  // Create Activations
  const allCampaigns = await prisma.campaign.findMany({
    where: { companyId: testCompany.id }
  });

  const activations = [];
  for (const campaign of allCampaigns) {
    // Create 3-5 activations per campaign
    const activationCount = Math.floor(Math.random() * 3) + 3;
    
    for (let i = 0; i < activationCount; i++) {
      const startDate = new Date(campaign.startDate);
      startDate.setDate(startDate.getDate() + i * 7); // Weekly activations
      
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 8); // 8-hour activations
      
      activations.push({
        companyId: testCompany.id,
        campaignId: campaign.id,
        name: `${campaign.name} - Activation ${i + 1}`,
        description: `Brand activation event for ${campaign.name}`,
        location: {
          type: 'public_location',
          name: `Mall ${i + 1}`,
          address: `Shopping Center ${i + 1}, Johannesburg`,
          coordinates: {
            lat: -26.2041 + (Math.random() - 0.5) * 0.05,
            lng: 28.0473 + (Math.random() - 0.5) * 0.05
          }
        },
        scheduledStart: startDate,
        scheduledEnd: endDate,
        actualStart: startDate,
        actualEnd: endDate,
        status: 'COMPLETED',
        requiredMaterials: campaign.materials,
        targetMetrics: {
          interactions: 100,
          leads: 20,
          sales: 10
        },
        gpsTracking: {
          checkIn: {
            lat: -26.2041 + (Math.random() - 0.5) * 0.05,
            lng: 28.0473 + (Math.random() - 0.5) * 0.05,
            timestamp: startDate
          },
          checkOut: {
            lat: -26.2041 + (Math.random() - 0.5) * 0.05,
            lng: 28.0473 + (Math.random() - 0.5) * 0.05,
            timestamp: endDate
          }
        }
      });
    }
  }

  await prisma.activation.createMany({
    data: activations
  });

  console.log('✅ Activations created');

  // Assign promoters to activations
  const allActivations = await prisma.activation.findMany({
    where: { companyId: testCompany.id }
  });

  const activationAssignments = allActivations.map(activation => ({
    activationId: activation.id,
    promoterId: promoter.id,
    role: 'lead_promoter'
  }));

  await prisma.activationAssignment.createMany({
    data: activationAssignments
  });

  // Create activation performance records
  const activationPerformances = allActivations.map(activation => ({
    activationId: activation.id,
    promoterId: promoter.id,
    customerInteractions: Array.from({ length: Math.floor(Math.random() * 50) + 20 }, (_, i) => ({
      id: `interaction_${i}`,
      timestamp: new Date(activation.scheduledStart!.getTime() + i * 10 * 60 * 1000),
      demographics: {
        ageGroup: ['18_24', '25_34', '35_44', '45_54'][Math.floor(Math.random() * 4)],
        gender: ['male', 'female'][Math.floor(Math.random() * 2)]
      },
      interactionType: ['product_demo', 'survey', 'lead_capture'][Math.floor(Math.random() * 3)],
      duration: Math.floor(Math.random() * 300) + 60,
      engagementLevel: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
      outcome: ['positive', 'neutral'][Math.floor(Math.random() * 2)]
    })),
    contentCreated: [
      { type: 'photo', url: 'https://via.placeholder.com/800x600?text=Activation+Setup' },
      { type: 'photo', url: 'https://via.placeholder.com/800x600?text=Customer+Interaction' },
      { type: 'video', url: 'https://via.placeholder.com/800x600?text=Product+Demo' }
    ],
    salesGenerated: Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, i) => ({
      productId: allProducts[Math.floor(Math.random() * allProducts.length)].id,
      quantity: Math.floor(Math.random() * 5) + 1,
      amount: Math.floor(Math.random() * 1000) + 100
    })),
    performanceMetrics: {
      totalInteractions: Math.floor(Math.random() * 50) + 20,
      leadsGenerated: Math.floor(Math.random() * 15) + 5,
      salesMade: Math.floor(Math.random() * 10) + 2,
      contentPieces: 5,
      engagementRate: Math.random() * 0.3 + 0.6 // 60-90%
    },
    qualitativeReport: 'Excellent activation with high customer engagement. Brand visibility was strong and customer feedback was very positive.',
    recommendations: [
      'Continue with similar activation format',
      'Consider extending activation hours',
      'Add more interactive elements'
    ]
  }));

  await prisma.activationPerformance.createMany({
    data: activationPerformances
  });

  console.log('✅ Activation performance records created');

  // Create Cash Reconciliations
  const cashReconciliations = [];
  const reconciliationStartDate = new Date('2024-01-01');
  
  for (let d = new Date(reconciliationStartDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    
    const startingFloat = 500; // R500 starting float
    const cashSales = Math.floor(Math.random() * 2000) + 500; // R500-R2500 in sales
    const changeGiven = Math.floor(Math.random() * 200) + 50; // R50-R250 in change
    const physicalCount = startingFloat + cashSales - changeGiven + (Math.random() - 0.5) * 20; // Small variance
    
    cashReconciliations.push({
      companyId: testCompany.id,
      agentId: salesAgent.id,
      date: new Date(d),
      startingFloat,
      cashSales,
      cashReceived: cashSales,
      changeGiven,
      physicalCount: {
        notes: {
          r200: { quantity: Math.floor(physicalCount / 200), total: Math.floor(physicalCount / 200) * 200 },
          r100: { quantity: Math.floor((physicalCount % 200) / 100), total: Math.floor((physicalCount % 200) / 100) * 100 },
          r50: { quantity: Math.floor((physicalCount % 100) / 50), total: Math.floor((physicalCount % 100) / 50) * 50 },
          r20: { quantity: Math.floor((physicalCount % 50) / 20), total: Math.floor((physicalCount % 50) / 20) * 20 },
          r10: { quantity: Math.floor((physicalCount % 20) / 10), total: Math.floor((physicalCount % 20) / 10) * 10 }
        },
        coins: {
          r5: { quantity: Math.floor((physicalCount % 10) / 5), total: Math.floor((physicalCount % 10) / 5) * 5 },
          r2: { quantity: Math.floor((physicalCount % 5) / 2), total: Math.floor((physicalCount % 5) / 2) * 2 },
          r1: { quantity: Math.floor(physicalCount % 2), total: Math.floor(physicalCount % 2) }
        },
        totalPhysical: physicalCount
      },
      variance: physicalCount - (startingFloat + cashSales - changeGiven),
      expenses: [
        { type: 'fuel', amount: Math.floor(Math.random() * 100) + 50, receipt: 'fuel_receipt.jpg' },
        { type: 'parking', amount: Math.floor(Math.random() * 20) + 5, receipt: 'parking_receipt.jpg' }
      ],
      depositAmount: physicalCount - startingFloat,
      depositStatus: 'COMPLETED',
      status: 'COMPLETED'
    });
  }

  await prisma.cashReconciliation.createMany({
    data: cashReconciliations
  });

  console.log(`✅ ${cashReconciliations.length} Cash reconciliation records created`);

  // Create some audit logs
  const auditLogs = [
    {
      userId: companyAdmin.id,
      companyId: testCompany.id,
      action: 'CREATE',
      resource: 'user',
      resourceId: salesAgent.id,
      newValues: { role: 'FIELD_SALES_AGENT', email: 'sales.agent@testcompany.com' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    {
      userId: companyAdmin.id,
      companyId: testCompany.id,
      action: 'CREATE',
      resource: 'campaign',
      resourceId: allCampaigns[0].id,
      newValues: { name: 'Summer Refresh Campaign', status: 'ACTIVE' },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  ];

  await prisma.auditLog.createMany({
    data: auditLogs
  });

  console.log('✅ Audit logs created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('Super Admin: superadmin@salessync.com / SuperAdmin123!');
  console.log('Company Admin: admin@testcompany.com / TestAdmin123!');
  console.log('Regional Manager: regional.manager@testcompany.com / RegionalManager123!');
  console.log('Sales Agent: sales.agent@testcompany.com / SalesAgent123!');
  console.log('Marketing Agent: marketing.agent@testcompany.com / MarketingAgent123!');
  console.log('Promoter: promoter@testcompany.com / Promoter123!');
  console.log('\n🏢 Test Company: TestCompany Ltd (testcompany)');
  console.log(`📊 Generated: ${visits.length} visits, ${sales.length} sales, ${allCustomers.length} customers`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });