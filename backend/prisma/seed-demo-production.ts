import { PrismaClient, UserRole, VisitStatus, SyncStatus, PaymentMethod, PaymentStatus, ActivationStatus, CashReconciliationStatus, CampaignType, CampaignStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production demo database seeding...');

  // Create Demo Company - TechCorp Solutions
  const demoCompany = await prisma.company.upsert({
    where: { slug: 'techcorp-demo' },
    update: {},
    create: {
      name: 'TechCorp Solutions',
      slug: 'techcorp-demo',
      subscriptionTier: 'PROFESSIONAL',
      settings: {
        features: ['FIELD_SALES', 'FIELD_MARKETING', 'PROMOTIONS', 'AI_ANALYTICS', 'INVENTORY_MANAGEMENT'],
        branding: {
          primaryColor: '#1E3A8A',
          secondaryColor: '#FB923C',
          logo: '/assets/techcorp-logo.png'
        },
        salesSettings: {
          defaultCommissionRate: 7.5,
          requireVisitPhotos: true,
          autoSyncInterval: 15,
          workingHours: {
            start: '08:00',
            end: '18:00'
          }
        }
      }
    }
  });

  console.log('✅ Demo company created: TechCorp Solutions');

  // Create Demo Users with easy-to-remember credentials
  
  // 1. Company Admin - demo@techcorp.com / Demo123!
  const hashedAdminPassword = await bcrypt.hash('Demo123!', 10);
  const demoAdmin = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: demoCompany.id,
        email: 'demo@techcorp.com'
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      email: 'demo@techcorp.com',
      password: hashedAdminPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      phone: '+27123456789',
      role: UserRole.COMPANY_ADMIN,
      permissions: ['MANAGE_USERS', 'MANAGE_CAMPAIGNS', 'VIEW_REPORTS', 'MANAGE_SETTINGS', 'MANAGE_INVENTORY'],
      profile: {
        location: 'Head Office - Johannesburg',
        department: 'Administration',
        bio: 'Demo administrator account for testing and demonstrations',
        avatar: '/assets/avatars/admin.jpg'
      }
    }
  });

  // 2. Sales Manager - manager@techcorp.com / Manager123!
  const hashedManagerPassword = await bcrypt.hash('Manager123!', 10);
  const salesManager = await prisma.user.upsert({
    where: {
      companyId_email: {
        companyId: demoCompany.id,
        email: 'manager@techcorp.com'
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      email: 'manager@techcorp.com',
      password: hashedManagerPassword,
      firstName: 'Sarah',
      lastName: 'Manager',
      phone: '+27123456790',
      role: UserRole.AREA_MANAGER,
      permissions: ['MANAGE_TEAM', 'VIEW_REPORTS', 'MANAGE_CAMPAIGNS', 'APPROVE_ORDERS'],
      profile: {
        location: 'Regional Office - Sandton',
        department: 'Sales Management',
        bio: 'Regional sales manager overseeing Gauteng operations',
        avatar: '/assets/avatars/manager.jpg',
        territory: 'Gauteng Province'
      }
    }
  });

  // 3. Field Sales Agents with easy credentials
  const hashedAgentPassword = await bcrypt.hash('Agent123!', 10);
  
  const fieldAgents = [
    {
      email: 'agent1@techcorp.com',
      firstName: 'John',
      lastName: 'Agent',
      phone: '+27123456791',
      location: 'Johannesburg North',
      territory: 'Sandton, Randburg, Fourways',
      bio: 'Senior field sales agent specializing in corporate accounts'
    },
    {
      email: 'agent2@techcorp.com',
      firstName: 'Lisa',
      lastName: 'Sales',
      phone: '+27123456792',
      location: 'Johannesburg South',
      territory: 'Roodepoort, Soweto, Lenasia',
      bio: 'Field sales representative focusing on retail partnerships'
    },
    {
      email: 'agent3@techcorp.com',
      firstName: 'Mike',
      lastName: 'Field',
      phone: '+27123456793',
      location: 'Cape Town',
      territory: 'Cape Town CBD, Bellville, Parow',
      bio: 'Western Cape regional sales representative'
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
        role: UserRole.FIELD_SALES_AGENT,
        permissions: ['CREATE_VISITS', 'MANAGE_CUSTOMERS', 'CREATE_ORDERS', 'VIEW_INVENTORY'],
        profile: {
          location: agent.location,
          department: 'Field Sales',
          territory: agent.territory,
          bio: agent.bio,
          avatar: `/assets/avatars/${agent.firstName.toLowerCase()}.jpg`
        }
      }
    });
    createdAgents.push(createdAgent);
  }

  console.log('✅ Demo users created with easy login credentials');

  // Create comprehensive product catalog for tech company
  const productCategories = [
    {
      name: 'Laptops',
      products: [
        { name: 'TechBook Pro 15"', unitPrice: 15999.00, sku: 'TBP15', description: 'High-performance laptop for professionals' },
        { name: 'TechBook Air 13"', unitPrice: 12999.00, sku: 'TBA13', description: 'Ultra-portable laptop for business travel' },
        { name: 'TechBook Gaming 17"', unitPrice: 22999.00, sku: 'TBG17', description: 'Gaming laptop with RTX graphics' },
        { name: 'TechBook Student 14"', unitPrice: 8999.00, sku: 'TBS14', description: 'Affordable laptop for students' }
      ]
    },
    {
      name: 'Smartphones',
      products: [
        { name: 'TechPhone Pro Max', unitPrice: 18999.00, sku: 'TPM128', description: 'Flagship smartphone with advanced camera' },
        { name: 'TechPhone Standard', unitPrice: 12999.00, sku: 'TPS64', description: 'Mid-range smartphone with great battery life' },
        { name: 'TechPhone Lite', unitPrice: 6999.00, sku: 'TPL32', description: 'Budget-friendly smartphone for everyday use' }
      ]
    },
    {
      name: 'Accessories',
      products: [
        { name: 'Wireless Earbuds Pro', unitPrice: 2999.00, sku: 'WEP01', description: 'Premium wireless earbuds with noise cancellation' },
        { name: 'Fast Charger 65W', unitPrice: 899.00, sku: 'FC65W', description: 'Universal fast charger for all devices' },
        { name: 'Laptop Stand Adjustable', unitPrice: 1299.00, sku: 'LSA01', description: 'Ergonomic laptop stand for better posture' },
        { name: 'Bluetooth Mouse', unitPrice: 599.00, sku: 'BTM01', description: 'Wireless mouse with precision tracking' }
      ]
    },
    {
      name: 'Software',
      products: [
        { name: 'Office Suite Pro License', unitPrice: 2499.00, sku: 'OSP01', description: 'Annual license for professional office suite' },
        { name: 'Antivirus Premium', unitPrice: 899.00, sku: 'AVP01', description: 'Premium antivirus protection for 1 year' },
        { name: 'Design Software License', unitPrice: 4999.00, sku: 'DSL01', description: 'Professional design software annual license' }
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
          unitPrice: product.unitPrice,
          isActive: true,
        }
      });
      createdProducts.push(createdProduct);
    }
  }

  console.log('✅ Product catalog created with tech products');

  // Create diverse customer database
  const customerTypes = [
    {
      type: 'Corporate',
      customers: [
        {
          name: 'ABC Corporation',
          contactPerson: 'David Johnson',
          email: 'david.johnson@abccorp.co.za',
          phone: '+27115551001',
          address: '123 Business Park, Sandton, 2196',
          territory: 'Sandton, Randburg, Fourways',
          creditLimit: 500000
        },
        {
          name: 'XYZ Holdings',
          contactPerson: 'Sarah Wilson',
          email: 'sarah.wilson@xyzholdings.co.za',
          phone: '+27115551002',
          address: '456 Corporate Drive, Rosebank, 2196',
          territory: 'Sandton, Randburg, Fourways',
          creditLimit: 750000
        },
        {
          name: 'Tech Innovations Ltd',
          contactPerson: 'Michael Brown',
          email: 'michael.brown@techinnovations.co.za',
          phone: '+27125551003',
          address: '789 Innovation Hub, Pretoria, 0181',
          territory: 'Cape Town CBD, Bellville, Parow',
          creditLimit: 300000
        }
      ]
    },
    {
      type: 'Retail Store',
      customers: [
        {
          name: 'TechZone Sandton',
          contactPerson: 'Lisa Garcia',
          email: 'lisa.garcia@techzone.co.za',
          phone: '+27115551004',
          address: '321 Nelson Mandela Square, Sandton, 2196',
          territory: 'Sandton, Randburg, Fourways',
          creditLimit: 100000
        },
        {
          name: 'Digital World Rosebank',
          contactPerson: 'Robert Taylor',
          email: 'robert.taylor@digitalworld.co.za',
          phone: '+27115551005',
          address: '654 Oxford Road, Rosebank, 2196',
          territory: 'Sandton, Randburg, Fourways',
          creditLimit: 75000
        },
        {
          name: 'Gadget Galaxy Cape Town',
          contactPerson: 'Emma Davis',
          email: 'emma.davis@gadgetgalaxy.co.za',
          phone: '+27215551006',
          address: '987 Long Street, Cape Town, 8001',
          territory: 'Cape Town CBD, Bellville, Parow',
          creditLimit: 50000
        }
      ]
    },
    {
      type: 'Educational',
      customers: [
        {
          name: 'University of Johannesburg',
          contactPerson: 'Prof. James Anderson',
          email: 'james.anderson@uj.ac.za',
          phone: '+27115551007',
          address: 'Auckland Park Campus, Johannesburg, 2006',
          territory: 'Sandton, Randburg, Fourways',
          creditLimit: 1000000
        },
        {
          name: 'Wits Business School',
          contactPerson: 'Dr. Jennifer Martinez',
          email: 'jennifer.martinez@wits.ac.za',
          phone: '+27115551008',
          address: '2 St Davids Place, Parktown, 2193',
          territory: 'Sandton, Randburg, Fourways',
          creditLimit: 800000
        }
      ]
    }
  ];

  const createdCustomers = [];
  for (const customerType of customerTypes) {
    for (const customer of customerType.customers) {
      const createdCustomer = await prisma.customer.upsert({
        where: {
          id: `${demoCompany.id}-${customer.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`
        },
        update: {},
        create: {
          companyId: demoCompany.id,
          name: customer.name,
          category: customerType.type,
          contactPerson: customer.contactPerson,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          isActive: true,
          creditLimit: customer.creditLimit,
        }
      });
      createdCustomers.push(createdCustomer);
    }
  }

  console.log('✅ Customer database created with diverse business types');

  // Create sample visits with realistic data
  const visitStatuses = [VisitStatus.COMPLETED, VisitStatus.IN_PROGRESS, VisitStatus.PLANNED];
  const createdVisits = [];

  for (let i = 0; i < 25; i++) {
    const randomAgent = createdAgents[Math.floor(Math.random() * createdAgents.length)];
    const randomCustomer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
    const randomStatus = visitStatuses[Math.floor(Math.random() * visitStatuses.length)];
    
    // Create visits in the last 14 days
    const visitDate = new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000);
    
    const visit = await prisma.visit.create({
      data: {
        companyId: demoCompany.id,
        agentId: randomAgent.id,
        customerId: randomCustomer.id,
        plannedStartTime: visitDate,
        actualStartTime: randomStatus === VisitStatus.COMPLETED ? visitDate : null,
        actualEndTime: randomStatus === VisitStatus.COMPLETED ? new Date(visitDate.getTime() + 90 * 60 * 1000) : null,
        status: randomStatus,
        notes: randomStatus === VisitStatus.COMPLETED ? 
          `Productive meeting with ${randomCustomer.name}. Discussed new product offerings and upcoming promotions. Customer showed strong interest in our latest laptop models.` :
          `Scheduled visit to ${randomCustomer.name} for product demonstration and relationship building.`,
        gpsLocation: {
          arrival: { lat: -26.2041 + (Math.random() - 0.5) * 0.1, lng: 28.0473 + (Math.random() - 0.5) * 0.1 },
          departure: randomStatus === VisitStatus.COMPLETED ? 
            { lat: -26.2041 + (Math.random() - 0.5) * 0.1, lng: 28.0473 + (Math.random() - 0.5) * 0.1 } : null
        },
        syncStatus: SyncStatus.SYNCED
      }
    });
    createdVisits.push(visit);
  }

  console.log('✅ Sample visits created with realistic scenarios');

  // Create sample sales orders
  const createdSales = [];
  for (let i = 0; i < 15; i++) {
    const randomAgent = createdAgents[Math.floor(Math.random() * createdAgents.length)];
    const randomCustomer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
    const randomProducts = createdProducts.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4) + 1);
    
    const saleDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    
    let totalAmount = 0;
    const saleItems = randomProducts.map(product => {
      const quantity = Math.floor(Math.random() * 5) + 1;
      const itemTotal = product.unitPrice * quantity;
      totalAmount += itemTotal;
      
      return {
        productId: product.id,
        quantity: quantity,
        unitPrice: product.unitPrice,
        totalPrice: itemTotal
      };
    });

    // Generate unique invoice number
    const invoiceNumber = `INV-${String(Date.now()).slice(-8)}-${String(i + 1).padStart(3, '0')}`;
    
    const sale = await prisma.sale.create({
      data: {
        companyId: demoCompany.id,
        agentId: randomAgent.id,
        customerId: randomCustomer.id,
        invoiceNumber: invoiceNumber,
        totalAmount: totalAmount,
        paymentMethod: [PaymentMethod.CREDIT, PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER][Math.floor(Math.random() * 3)],
        paymentStatus: PaymentStatus.PAID,
        createdAt: saleDate
      }
    });

    // Create sale items separately
    for (const item of saleItems) {
      await prisma.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.totalPrice
        }
      });
    }

    createdSales.push(sale);
  }

  console.log('✅ Sample sales orders created');

  // Create a sample marketing campaign
  const campaign = await prisma.campaign.create({
    data: {
      companyId: demoCompany.id,
      name: 'Q4 Tech Promotion 2024',
      description: 'End-of-year technology promotion featuring laptops and smartphones',
      type: CampaignType.PROMOTION,
      status: CampaignStatus.ACTIVE,
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-12-31'),
      budget: 500000,
      targetAudience: ['Corporate', 'Educational', 'Retail Store'],
      objectives: [
        'Increase Q4 sales by 25%',
        'Clear inventory of older laptop models',
        'Promote new smartphone lineup'
      ],
      kpis: {
        targetSales: 2000000,
        targetCustomers: 50,
        targetVisits: 200
      }
    }
  });

  console.log('✅ Sample marketing campaign created');

  // Print login credentials summary
  console.log('\n🎉 Production demo database seeded successfully!');
  console.log('\n📋 DEMO LOGIN CREDENTIALS:');
  console.log('================================');
  console.log('Company: TechCorp Solutions');
  console.log('');
  console.log('👤 Admin Account:');
  console.log('   Email: demo@techcorp.com');
  console.log('   Password: Demo123!');
  console.log('   Role: Company Admin');
  console.log('');
  console.log('👤 Manager Account:');
  console.log('   Email: manager@techcorp.com');
  console.log('   Password: Manager123!');
  console.log('   Role: Area Manager');
  console.log('');
  console.log('👤 Field Agent Accounts:');
  console.log('   Email: agent1@techcorp.com');
  console.log('   Password: Agent123!');
  console.log('   Role: Field Sales Agent');
  console.log('');
  console.log('   Email: agent2@techcorp.com');
  console.log('   Password: Agent123!');
  console.log('   Role: Field Sales Agent');
  console.log('');
  console.log('   Email: agent3@techcorp.com');
  console.log('   Password: Agent123!');
  console.log('   Role: Field Sales Agent');
  console.log('');
  console.log('📊 DEMO DATA SUMMARY:');
  console.log('================================');
  console.log(`✅ ${createdProducts.length} products created`);
  console.log(`✅ ${createdCustomers.length} customers created`);
  console.log(`✅ ${createdVisits.length} visits created`);
  console.log(`✅ ${createdSales.length} sales orders created`);
  console.log('✅ 1 marketing campaign created');
  console.log('');
  console.log('🚀 Ready for production demo!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });