import { PrismaClient, UserRole, VisitStatus, SyncStatus, PaymentMethod, PaymentStatus, ActivationStatus, CashReconciliationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

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

  // Create Test Company
  const testCompany = await prisma.company.upsert({
    where: { slug: 'testcompany' },
    update: {},
    create: {
      name: 'TestCompany Ltd',
      slug: 'testcompany',
      subscriptionTier: 'PROFESSIONAL',
      settings: {
        features: ['FIELD_SALES', 'FIELD_MARKETING', 'PROMOTIONS', 'AI_ANALYTICS'],
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
      permissions: ['PLATFORM_MANAGEMENT', 'ALL_COMPANIES', 'SYSTEM_SETTINGS'],
      profile: {
        location: 'Platform HQ',
        department: 'Platform Management'
      }
    }
  });

  // Create Test Company Admin
  const hashedAdminPassword = await bcrypt.hash('TestAdmin123!', 10);
  const companyAdmin = await prisma.user.upsert({
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
      password: hashedAdminPassword,
      firstName: 'Test',
      lastName: 'Admin',
      phone: '+27123456790',
      role: UserRole.COMPANY_ADMIN,
      permissions: ['MANAGE_USERS', 'MANAGE_CAMPAIGNS', 'VIEW_REPORTS', 'MANAGE_SETTINGS'],
      profile: {
        location: 'Head Office',
        department: 'Administration'
      }
    }
  });

  // Create Field Agents
  const hashedAgentPassword = await bcrypt.hash('Agent123!', 10);
  const agent1 = await prisma.user.upsert({
    where: { 
      companyId_email: {
        companyId: testCompany.id,
        email: 'agent1@testcompany.com'
      }
    },
    update: {},
    create: {
      companyId: testCompany.id,
      email: 'agent1@testcompany.com',
      password: hashedAgentPassword,
      firstName: 'John',
      lastName: 'Agent',
      phone: '+27123456791',
      role: UserRole.AGENT,
      permissions: ['FIELD_VISITS', 'CUSTOMER_MANAGEMENT', 'SALES_ENTRY'],
      profile: {
        location: 'Cape Town',
        department: 'Field Sales',
        territory: 'Western Cape'
      }
    }
  });

  const agent2 = await prisma.user.upsert({
    where: { 
      companyId_email: {
        companyId: testCompany.id,
        email: 'agent2@testcompany.com'
      }
    },
    update: {},
    create: {
      companyId: testCompany.id,
      email: 'agent2@testcompany.com',
      password: hashedAgentPassword,
      firstName: 'Jane',
      lastName: 'Agent',
      phone: '+27123456792',
      role: UserRole.AGENT,
      permissions: ['FIELD_VISITS', 'CUSTOMER_MANAGEMENT', 'SALES_ENTRY'],
      profile: {
        location: 'Johannesburg',
        department: 'Field Sales',
        territory: 'Gauteng'
      }
    }
  });

  // Create Manager
  const hashedManagerPassword = await bcrypt.hash('Manager123!', 10);
  const manager = await prisma.user.upsert({
    where: { 
      companyId_email: {
        companyId: testCompany.id,
        email: 'manager@testcompany.com'
      }
    },
    update: {},
    create: {
      companyId: testCompany.id,
      email: 'manager@testcompany.com',
      password: hashedManagerPassword,
      firstName: 'Mike',
      lastName: 'Manager',
      phone: '+27123456793',
      role: UserRole.TEAM_LEADER,
      permissions: ['MANAGE_TEAM', 'VIEW_REPORTS', 'APPROVE_REQUESTS'],
      profile: {
        location: 'Regional Office',
        department: 'Management',
        territory: 'National'
      }
    }
  });

  // Create some sample customers
  const customers = [];
  for (let i = 1; i <= 10; i++) {
    const customer = await prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: `Customer ${i}`,
        email: `customer${i}@example.com`,
        phone: `+2712345${String(i).padStart(4, '0')}`,
        address: `${i} Main Street, City ${i}, Province`,
        coordinates: {
          lat: -26.2041 + (Math.random() - 0.5) * 0.1,
          lng: 28.0473 + (Math.random() - 0.5) * 0.1
        },
        category: 'RETAIL',
        creditLimit: 10000 + (i * 1000),
        isActive: true
      }
    });
    customers.push(customer);
  }

  // Create some sample products
  const products = [];
  const productNames = ['Coca Cola 330ml', 'Pepsi 330ml', 'Sprite 330ml', 'Fanta 330ml', 'Water 500ml'];
  for (let i = 0; i < productNames.length; i++) {
    const product = await prisma.product.create({
      data: {
        companyId: testCompany.id,
        name: productNames[i],
        sku: `PROD-${String(i + 1).padStart(3, '0')}`,
        barcode: `123456789${String(i).padStart(3, '0')}`,
        category: 'Beverages',
        unitPrice: 15.50 + (i * 2),
        description: `Premium ${productNames[i]} beverage`,
        isActive: true
      }
    });
    products.push(product);
  }

  // Create some sample visits
  const visits = [];
  for (let i = 0; i < 5; i++) {
    const visit = await prisma.visit.create({
      data: {
        companyId: testCompany.id,
        agentId: i % 2 === 0 ? agent1.id : agent2.id,
        customerId: customers[i].id,
        plannedStartTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
        actualStartTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000) + (30 * 60 * 1000)),
        actualEndTime: new Date(Date.now() - (i * 24 * 60 * 60 * 1000) + (90 * 60 * 1000)),
        status: VisitStatus.COMPLETED,
        gpsLocation: {
          arrival: {
            lat: -26.2041 + (Math.random() - 0.5) * 0.1,
            lng: 28.0473 + (Math.random() - 0.5) * 0.1,
            accuracy: 5,
            timestamp: new Date()
          },
          departure: {
            lat: -26.2041 + (Math.random() - 0.5) * 0.1,
            lng: 28.0473 + (Math.random() - 0.5) * 0.1,
            accuracy: 5,
            timestamp: new Date()
          }
        },
        activities: [
          {
            type: 'survey',
            status: 'completed',
            data: { responses: ['Good', 'Satisfied', 'Yes'] }
          },
          {
            type: 'sale',
            status: 'completed',
            data: { amount: 150.00, items: 3 }
          }
        ],
        photos: [
          {
            type: 'store_exterior',
            url: '/uploads/store-exterior-1.jpg',
            timestamp: new Date()
          }
        ],
        notes: `Visit completed successfully. Customer satisfied with service.`,
        syncStatus: SyncStatus.SYNCED
      }
    });
    visits.push(visit);
  }

  // Create some sample sales
  for (let i = 0; i < 3; i++) {
    await prisma.sale.create({
      data: {
        companyId: testCompany.id,
        agentId: agent1.id,
        customerId: customers[i].id,
        visitId: visits[i].id,
        invoiceNumber: `INV-${String(i + 1).padStart(6, '0')}`,
        totalAmount: 150.00 + (i * 50),
        taxAmount: 22.50 + (i * 7.5),
        discountAmount: 0,
        paymentMethod: i % 2 === 0 ? PaymentMethod.CASH : PaymentMethod.CARD,
        paymentStatus: PaymentStatus.PAID,
        paidAmount: 150.00 + (i * 50),
        createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000))
      }
    });
  }

  console.log('✅ Database seeding completed successfully!');
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log('Super Admin: superadmin@salessync.com / SuperAdmin123!');
  console.log('Company Admin: admin@testcompany.com / TestAdmin123!');
  console.log('Field Agent 1: agent1@testcompany.com / Agent123!');
  console.log('Field Agent 2: agent2@testcompany.com / Agent123!');
  console.log('Manager: manager@testcompany.com / Manager123!');
  console.log('');
  console.log('📊 Sample Data Created:');
  console.log(`- ${2} Companies`);
  console.log(`- ${5} Users`);
  console.log(`- ${customers.length} Customers`);
  console.log(`- ${products.length} Products`);
  console.log(`- ${visits.length} Visits`);
  console.log(`- ${3} Sales`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });