import { PrismaClient, UserRole, VisitStatus, SyncStatus, PaymentMethod, PaymentStatus, ActivationStatus, CashReconciliationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production database seeding...');

  // Create Super Admin Company (for platform management)
  const superAdminCompany = await prisma.company.upsert({
    where: { slug: 'salessync-platform' },
    update: {},
    create: {
      name: 'SalesSync Platform',
      slug: 'salessync-platform',
      subscriptionTier: 'ENTERPRISE',
      settings: {
        features: ['ALL_FEATURES'],
        branding: {
          primaryColor: '#1E3A8A',
          secondaryColor: '#FB923C',
          logo: '/assets/salessync-logo.png'
        }
      }
    }
  });

  // Create Demo Company - Premium Beverages Ltd
  const demoCompany = await prisma.company.upsert({
    where: { slug: 'premium-beverages' },
    update: {},
    create: {
      name: 'Premium Beverages Ltd',
      slug: 'premium-beverages',
      subscriptionTier: 'PROFESSIONAL',
      settings: {
        features: ['FIELD_SALES', 'FIELD_MARKETING', 'PROMOTIONS', 'AI_ANALYTICS'],
        branding: {
          primaryColor: '#1E3A8A',
          secondaryColor: '#FB923C',
          logo: '/assets/premium-beverages-logo.png'
        },
        salesSettings: {
          defaultCommissionRate: 5.0,
          requireVisitPhotos: true,
          autoSyncInterval: 30,
          workingHours: {
            start: '08:00',
            end: '17:00'
          }
        }
      }
    }
  });

  // Create Test Company for development
  const testCompany = await prisma.company.upsert({
    where: { slug: 'testcompany' },
    update: {},
    create: {
      name: 'TestCompany Ltd',
      slug: 'testcompany',
      subscriptionTier: 'BASIC',
      settings: {
        features: ['FIELD_SALES', 'BASIC_ANALYTICS'],
        branding: {
          primaryColor: '#1E3A8A',
          secondaryColor: '#FB923C'
        }
      }
    }
  });

  // Create Super Admin User
  const hashedSuperAdminPassword = await bcrypt.hash('SuperAdmin123!', 10);
  const superAdmin = await prisma.user.upsert({
    where: { 
      companyId_email: {
        companyId: superAdminCompany.id,
        email: 'superadmin@salessync.com'
      }
    },
    update: {},
    create: {
      companyId: superAdminCompany.id,
      email: 'superadmin@salessync.com',
      password: hashedSuperAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+27123456789',
      role: UserRole.SUPER_ADMIN,
      permissions: ['ALL_PERMISSIONS'],
      profile: {
        location: 'Head Office',
        department: 'Platform Administration'
      }
    }
  });

  // Create Demo Company Users
  const hashedAdminPassword = await bcrypt.hash('DemoAdmin123!', 10);
  const demoAdmin = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: demoCompany.id,
        email: 'admin@premiumbeverages.com'
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      email: 'admin@premiumbeverages.com',
      password: hashedAdminPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '+27123456790',
      role: UserRole.COMPANY_ADMIN,
      permissions: ['MANAGE_USERS', 'MANAGE_CAMPAIGNS', 'VIEW_REPORTS', 'MANAGE_SETTINGS'],
      profile: {
        location: 'Head Office - Cape Town',
        department: 'Administration',
        bio: 'Experienced sales administrator with 8+ years in FMCG industry'
      }
    }
  });

  // Create Sales Manager
  const hashedManagerPassword = await bcrypt.hash('Manager123!', 10);
  const salesManager = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: demoCompany.id,
        email: 'manager@premiumbeverages.com'
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      email: 'manager@premiumbeverages.com',
      password: hashedManagerPassword,
      firstName: 'Michael',
      lastName: 'Thompson',
      phone: '+27123456791',
      role: UserRole.SALES_MANAGER,
      permissions: ['MANAGE_TEAM', 'VIEW_REPORTS', 'MANAGE_CAMPAIGNS'],
      profile: {
        location: 'Regional Office - Johannesburg',
        department: 'Sales Management',
        bio: 'Regional sales manager overseeing Gauteng territory'
      }
    }
  });

  // Create Field Agents
  const hashedAgentPassword = await bcrypt.hash('Agent123!', 10);
  
  const fieldAgents = [
    {
      email: 'james.wilson@premiumbeverages.com',
      firstName: 'James',
      lastName: 'Wilson',
      phone: '+27123456792',
      location: 'Johannesburg North',
      territory: 'Sandton, Randburg, Fourways'
    },
    {
      email: 'lisa.martinez@premiumbeverages.com',
      firstName: 'Lisa',
      lastName: 'Martinez',
      phone: '+27123456793',
      location: 'Johannesburg South',
      territory: 'Roodepoort, Soweto, Lenasia'
    },
    {
      email: 'david.brown@premiumbeverages.com',
      firstName: 'David',
      lastName: 'Brown',
      phone: '+27123456794',
      location: 'Cape Town',
      territory: 'CBD, Bellville, Parow'
    },
    {
      email: 'emma.davis@premiumbeverages.com',
      firstName: 'Emma',
      lastName: 'Davis',
      phone: '+27123456795',
      location: 'Durban',
      territory: 'Durban Central, Pinetown, Chatsworth'
    },
    {
      email: 'robert.garcia@premiumbeverages.com',
      firstName: 'Robert',
      lastName: 'Garcia',
      phone: '+27123456796',
      location: 'Pretoria',
      territory: 'Pretoria CBD, Centurion, Hatfield'
    }
  ];

  const createdAgents = [];
  for (const agent of fieldAgents) {
    const createdAgent = await prisma.user.upsert({
      where: {
        companyId_email: {
          companyId: demoCompany.id,
          email: agent.email
        }
      },
      update: {},
      create: {
        companyId: demoCompany.id,
        email: agent.email,
        password: hashedAgentPassword,
        firstName: agent.firstName,
        lastName: agent.lastName,
        phone: agent.phone,
        role: UserRole.FIELD_AGENT,
        permissions: ['CREATE_VISITS', 'MANAGE_CUSTOMERS', 'CREATE_ORDERS'],
        profile: {
          location: agent.location,
          department: 'Field Sales',
          territory: agent.territory,
          bio: `Field sales representative covering ${agent.territory}`
        }
      }
    });
    createdAgents.push(createdAgent);
  }

  // Create Test Company Users (for development)
  const hashedTestPassword = await bcrypt.hash('TestAdmin123!', 10);
  await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: testCompany.id,
        email: 'admin@testcompany.com'
      }
    },
    update: {},
    create: {
      companyId: testCompany.id,
      email: 'admin@testcompany.com',
      password: hashedTestPassword,
      firstName: 'Test',
      lastName: 'Admin',
      phone: '+27123456799',
      role: UserRole.COMPANY_ADMIN,
      permissions: ['MANAGE_USERS', 'MANAGE_CAMPAIGNS', 'VIEW_REPORTS', 'MANAGE_SETTINGS'],
      profile: {
        location: 'Test Location',
        department: 'Testing'
      }
    }
  });

  // Create comprehensive product catalog
  const productCategories = [
    {
      name: 'Soft Drinks',
      products: [
        { name: 'Premium Cola 330ml', price: 12.50, sku: 'PC330', description: 'Classic cola with premium ingredients' },
        { name: 'Premium Cola 500ml', price: 18.00, sku: 'PC500', description: 'Classic cola with premium ingredients - large size' },
        { name: 'Orange Fizz 330ml', price: 11.50, sku: 'OF330', description: 'Natural orange flavored sparkling drink' },
        { name: 'Lemon Lime 330ml', price: 11.50, sku: 'LL330', description: 'Refreshing lemon-lime sparkling drink' },
        { name: 'Ginger Ale 330ml', price: 13.00, sku: 'GA330', description: 'Premium ginger ale with real ginger' }
      ]
    },
    {
      name: 'Energy Drinks',
      products: [
        { name: 'Power Boost Original', price: 25.00, sku: 'PBO250', description: 'High-energy drink with vitamins and caffeine' },
        { name: 'Power Boost Sugar-Free', price: 25.00, sku: 'PBSF250', description: 'Sugar-free energy drink with natural sweeteners' },
        { name: 'Extreme Energy', price: 28.00, sku: 'EE250', description: 'Maximum strength energy drink for athletes' }
      ]
    },
    {
      name: 'Juices',
      products: [
        { name: '100% Orange Juice 1L', price: 35.00, sku: 'OJ1000', description: 'Pure orange juice, no added sugar' },
        { name: '100% Apple Juice 1L', price: 32.00, sku: 'AJ1000', description: 'Pure apple juice from concentrate' },
        { name: 'Tropical Mix 1L', price: 38.00, sku: 'TM1000', description: 'Blend of tropical fruits' },
        { name: 'Cranberry Juice 1L', price: 42.00, sku: 'CJ1000', description: 'Pure cranberry juice with antioxidants' }
      ]
    },
    {
      name: 'Water',
      products: [
        { name: 'Premium Spring Water 500ml', price: 8.00, sku: 'PSW500', description: 'Natural spring water from mountain sources' },
        { name: 'Premium Spring Water 1.5L', price: 15.00, sku: 'PSW1500', description: 'Natural spring water - family size' },
        { name: 'Sparkling Water 500ml', price: 10.00, sku: 'SW500', description: 'Natural sparkling mineral water' }
      ]
    }
  ];

  const createdProducts = [];
  for (const category of productCategories) {
    for (const product of category.products) {
      const createdProduct = await prisma.product.upsert({
        where: {
          companyId_sku: {
            companyId: demoCompany.id,
            sku: product.sku
          }
        },
        update: {},
        create: {
          companyId: demoCompany.id,
          name: product.name,
          sku: product.sku,
          description: product.description,
          category: category.name,
          price: product.price,
          cost: product.price * 0.6, // 40% margin
          isActive: true,
          stockQuantity: Math.floor(Math.random() * 1000) + 100,
          minStockLevel: 50,
          specifications: {
            weight: category.name === 'Water' ? (product.name.includes('1.5L') ? 1500 : 500) : 330,
            volume: product.name.includes('1L') ? 1000 : (product.name.includes('1.5L') ? 1500 : (product.name.includes('500ml') ? 500 : 330)),
            packaging: 'Bottle',
            shelfLife: category.name === 'Juices' ? '12 months' : '24 months'
          }
        }
      });
      createdProducts.push(createdProduct);
    }
  }

  // Create comprehensive customer database
  const customerTypes = [
    {
      type: 'Supermarket',
      customers: [
        {
          name: 'Pick n Pay Sandton',
          contactPerson: 'John Smith',
          email: 'john.smith@pnp.co.za',
          phone: '+27115551001',
          address: '123 Rivonia Road, Sandton, 2196',
          territory: 'Sandton, Randburg, Fourways'
        },
        {
          name: 'Checkers Rosebank',
          contactPerson: 'Mary Johnson',
          email: 'mary.johnson@checkers.co.za',
          phone: '+27115551002',
          address: '456 Oxford Road, Rosebank, 2196',
          territory: 'Sandton, Randburg, Fourways'
        },
        {
          name: 'Woolworths Menlyn',
          contactPerson: 'Peter Wilson',
          email: 'peter.wilson@woolworths.co.za',
          phone: '+27125551003',
          address: '789 Atterbury Road, Menlyn, 0181',
          territory: 'Pretoria CBD, Centurion, Hatfield'
        }
      ]
    },
    {
      type: 'Convenience Store',
      customers: [
        {
          name: '7-Eleven Fourways',
          contactPerson: 'Sarah Brown',
          email: 'sarah.brown@7eleven.co.za',
          phone: '+27115551004',
          address: '321 William Nicol Drive, Fourways, 2055',
          territory: 'Sandton, Randburg, Fourways'
        },
        {
          name: 'Engen Quick Shop',
          contactPerson: 'David Lee',
          email: 'david.lee@engen.co.za',
          phone: '+27115551005',
          address: '654 Jan Smuts Avenue, Rosebank, 2196',
          territory: 'Sandton, Randburg, Fourways'
        },
        {
          name: 'Shell Select Hatfield',
          contactPerson: 'Lisa Garcia',
          email: 'lisa.garcia@shell.co.za',
          phone: '+27125551006',
          address: '987 Burnett Street, Hatfield, 0028',
          territory: 'Pretoria CBD, Centurion, Hatfield'
        }
      ]
    },
    {
      type: 'Restaurant',
      customers: [
        {
          name: 'Ocean Basket Sandton',
          contactPerson: 'Michael Davis',
          email: 'michael.davis@oceanbasket.com',
          phone: '+27115551007',
          address: '147 5th Street, Sandton, 2196',
          territory: 'Sandton, Randburg, Fourways'
        },
        {
          name: 'Spur Steak Ranches',
          contactPerson: 'Jennifer Martinez',
          email: 'jennifer.martinez@spur.co.za',
          phone: '+27115551008',
          address: '258 Beyers Naude Drive, Randburg, 2194',
          territory: 'Sandton, Randburg, Fourways'
        },
        {
          name: 'Nandos Centurion',
          contactPerson: 'Robert Taylor',
          email: 'robert.taylor@nandos.co.za',
          phone: '+27125551009',
          address: '369 Jean Avenue, Centurion, 0157',
          territory: 'Pretoria CBD, Centurion, Hatfield'
        }
      ]
    },
    {
      type: 'Wholesaler',
      customers: [
        {
          name: 'Makro Woodmead',
          contactPerson: 'Amanda Wilson',
          email: 'amanda.wilson@makro.co.za',
          phone: '+27115551010',
          address: '741 Woodmead Drive, Sandton, 2191',
          territory: 'Sandton, Randburg, Fourways'
        },
        {
          name: 'Cash & Carry Pretoria',
          contactPerson: 'Thomas Anderson',
          email: 'thomas.anderson@cashcarry.co.za',
          phone: '+27125551011',
          address: '852 Church Street, Pretoria, 0002',
          territory: 'Pretoria CBD, Centurion, Hatfield'
        }
      ]
    }
  ];

  const createdCustomers = [];
  for (const customerType of customerTypes) {
    for (const customer of customerType.customers) {
      const createdCustomer = await prisma.customer.upsert({
        where: {
          companyId_email: {
            companyId: demoCompany.id,
            email: customer.email
          }
        },
        update: {},
        create: {
          companyId: demoCompany.id,
          name: customer.name,
          type: customerType.type,
          contactPerson: customer.contactPerson,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          isActive: true,
          creditLimit: customerType.type === 'Wholesaler' ? 100000 : (customerType.type === 'Supermarket' ? 50000 : 10000),
          paymentTerms: customerType.type === 'Wholesaler' ? 60 : (customerType.type === 'Supermarket' ? 30 : 7),
          profile: {
            territory: customer.territory,
            preferredDeliveryDay: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][Math.floor(Math.random() * 5)],
            specialInstructions: `${customerType.type} customer requiring regular stock rotation`,
            lastOrderDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      });
      createdCustomers.push(createdCustomer);
    }
  }

  // Create realistic visits with various statuses
  const visitStatuses = [VisitStatus.COMPLETED, VisitStatus.IN_PROGRESS, VisitStatus.SCHEDULED, VisitStatus.CANCELLED];
  const createdVisits = [];

  for (let i = 0; i < 50; i++) {
    const randomAgent = createdAgents[Math.floor(Math.random() * createdAgents.length)];
    const randomCustomer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
    const randomStatus = visitStatuses[Math.floor(Math.random() * visitStatuses.length)];
    
    // Create visits in the last 30 days
    const visitDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    
    const visit = await prisma.visit.create({
      data: {
        companyId: demoCompany.id,
        userId: randomAgent.id,
        customerId: randomCustomer.id,
        scheduledDate: visitDate,
        actualDate: randomStatus === VisitStatus.COMPLETED ? visitDate : null,
        status: randomStatus,
        purpose: ['Sales Visit', 'Delivery', 'Collection', 'Relationship Building', 'Product Demo'][Math.floor(Math.random() * 5)],
        notes: randomStatus === VisitStatus.COMPLETED ? 
          `Successful visit to ${randomCustomer.name}. Customer satisfied with service and product quality.` :
          `Scheduled visit to ${randomCustomer.name} for ${visitDate.toDateString()}`,
        location: randomCustomer.address,
        syncStatus: SyncStatus.SYNCED,
        metadata: {
          duration: randomStatus === VisitStatus.COMPLETED ? Math.floor(Math.random() * 120) + 30 : null,
          weather: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
          trafficCondition: ['Light', 'Moderate', 'Heavy'][Math.floor(Math.random() * 3)]
        }
      }
    });
    createdVisits.push(visit);
  }

  // Create sales orders for completed visits
  const completedVisits = createdVisits.filter(v => v.status === VisitStatus.COMPLETED);
  
  for (let i = 0; i < Math.min(25, completedVisits.length); i++) {
    const visit = completedVisits[i];
    const customer = createdCustomers.find(c => c.id === visit.customerId);
    
    // Create order with 2-5 random products
    const orderProducts = [];
    const numProducts = Math.floor(Math.random() * 4) + 2;
    const selectedProducts = createdProducts.sort(() => 0.5 - Math.random()).slice(0, numProducts);
    
    let totalAmount = 0;
    for (const product of selectedProducts) {
      const quantity = Math.floor(Math.random() * 20) + 1;
      const lineTotal = quantity * product.price;
      totalAmount += lineTotal;
      
      orderProducts.push({
        productId: product.id,
        quantity: quantity,
        unitPrice: product.price,
        totalPrice: lineTotal
      });
    }

    const order = await prisma.order.create({
      data: {
        companyId: demoCompany.id,
        customerId: visit.customerId,
        userId: visit.userId,
        visitId: visit.id,
        orderNumber: `ORD-${Date.now()}-${i.toString().padStart(3, '0')}`,
        orderDate: visit.actualDate || new Date(),
        totalAmount: totalAmount,
        status: ['PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'][Math.floor(Math.random() * 4)],
        paymentMethod: [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.EFT, PaymentMethod.CREDIT][Math.floor(Math.random() * 4)],
        paymentStatus: [PaymentStatus.PENDING, PaymentStatus.PAID, PaymentStatus.OVERDUE][Math.floor(Math.random() * 3)],
        deliveryDate: new Date(visit.actualDate!.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        notes: `Order placed during visit to ${customer?.name}`,
        syncStatus: SyncStatus.SYNCED,
        orderItems: {
          create: orderProducts
        }
      }
    });
  }

  // Create marketing campaigns
  const campaigns = [
    {
      name: 'Summer Refresh Campaign',
      description: 'Promote cold beverages during summer season',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2025-02-28'),
      budget: 50000,
      targetAudience: 'Convenience Stores and Restaurants',
      objectives: ['Increase summer sales by 25%', 'Introduce new flavors', 'Build brand awareness']
    },
    {
      name: 'Back to School Promotion',
      description: 'Target schools and educational institutions',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-02-15'),
      budget: 30000,
      targetAudience: 'Schools and Cafeterias',
      objectives: ['Penetrate education market', 'Establish long-term contracts']
    },
    {
      name: 'Energy Drink Launch',
      description: 'Launch new energy drink variants',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      budget: 75000,
      targetAudience: 'Gyms and Sports Retailers',
      objectives: ['Launch 3 new variants', 'Achieve 15% market share in energy drinks']
    }
  ];

  for (const campaign of campaigns) {
    await prisma.campaign.upsert({
      where: {
        companyId_name: {
          companyId: demoCompany.id,
          name: campaign.name
        }
      },
      update: {},
      create: {
        companyId: demoCompany.id,
        name: campaign.name,
        description: campaign.description,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        budget: campaign.budget,
        isActive: true,
        settings: {
          targetAudience: campaign.targetAudience,
          objectives: campaign.objectives,
          kpis: ['Sales Volume', 'Customer Acquisition', 'Brand Awareness'],
          channels: ['Field Sales', 'Digital Marketing', 'Trade Shows']
        }
      }
    });
  }

  // Create promotions
  const promotions = [
    {
      name: 'Buy 2 Get 1 Free - Soft Drinks',
      description: 'Special offer on all 330ml soft drinks',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-31'),
      discountType: 'PERCENTAGE',
      discountValue: 33.33,
      conditions: 'Minimum purchase of 3 units'
    },
    {
      name: '10% Off Energy Drinks',
      description: 'Discount on all energy drink variants',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-02-15'),
      discountType: 'PERCENTAGE',
      discountValue: 10,
      conditions: 'Valid for all energy drink products'
    },
    {
      name: 'Bulk Purchase Discount',
      description: '15% discount on orders over R500',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-12-31'),
      discountType: 'PERCENTAGE',
      discountValue: 15,
      conditions: 'Minimum order value R500'
    }
  ];

  for (const promotion of promotions) {
    await prisma.promotion.upsert({
      where: {
        companyId_name: {
          companyId: demoCompany.id,
          name: promotion.name
        }
      },
      update: {},
      create: {
        companyId: demoCompany.id,
        name: promotion.name,
        description: promotion.description,
        startDate: promotion.startDate,
        endDate: promotion.endDate,
        isActive: true,
        settings: {
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          conditions: promotion.conditions,
          applicableProducts: 'ALL',
          maxUsagePerCustomer: 10
        }
      }
    });
  }

  console.log('✅ Production database seeding completed successfully!');
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log('Super Admin: superadmin@salessync.com / SuperAdmin123!');
  console.log('');
  console.log('🏢 Premium Beverages Ltd (Demo Company):');
  console.log('Company Admin: admin@premiumbeverages.com / DemoAdmin123!');
  console.log('Sales Manager: manager@premiumbeverages.com / Manager123!');
  console.log('Field Agents: [agent-email] / Agent123!');
  console.log('  - james.wilson@premiumbeverages.com');
  console.log('  - lisa.martinez@premiumbeverages.com');
  console.log('  - david.brown@premiumbeverages.com');
  console.log('  - emma.davis@premiumbeverages.com');
  console.log('  - robert.garcia@premiumbeverages.com');
  console.log('');
  console.log('🧪 Test Company (Development):');
  console.log('Test Admin: admin@testcompany.com / TestAdmin123!');
  console.log('');
  console.log('📊 Sample Data Created:');
  console.log(`- ${3} Companies`);
  console.log(`- ${8} Users`);
  console.log(`- ${createdCustomers.length} Customers`);
  console.log(`- ${createdProducts.length} Products`);
  console.log(`- ${createdVisits.length} Visits`);
  console.log(`- ${Math.min(25, completedVisits.length)} Orders`);
  console.log(`- ${campaigns.length} Marketing Campaigns`);
  console.log(`- ${promotions.length} Promotions`);
  console.log('');
  console.log('🎯 Demo Features:');
  console.log('- Comprehensive product catalog with 4 categories');
  console.log('- Realistic customer database with different business types');
  console.log('- Field sales visits with various statuses');
  console.log('- Sales orders linked to completed visits');
  console.log('- Marketing campaigns and promotions');
  console.log('- Multi-territory coverage (JHB, CPT, DBN, PTA)');
  console.log('- Role-based access control');
  console.log('- Complete sales workflow demonstration');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });