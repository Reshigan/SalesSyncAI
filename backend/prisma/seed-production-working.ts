import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production database seeding (working version)...');

  // First, create a demo company
  const company = await prisma.companies.upsert({
    where: { slug: 'premiumbeverages' },
    update: {},
    create: {
      id: 'company-001',
      name: 'Premium Beverages SA',
      slug: 'premiumbeverages',
      isActive: true,
      updatedAt: new Date()
    }
  });

  console.log('✅ Company created:', company.name);

  // Create demo users with proper bcrypt hashed passwords
  const hashedPassword1 = await bcrypt.hash('admin123', 10);
  const hashedPassword2 = await bcrypt.hash('manager123', 10);
  const hashedPassword3 = await bcrypt.hash('agent123', 10);

  // Create Super Admin
  const superAdmin = await prisma.users.upsert({
    where: { 
      companyId_email: {
        companyId: company.id,
        email: 'admin@salessync.com'
      }
    },
    update: {},
    create: {
      id: 'user-001',
      companyId: company.id,
      email: 'admin@salessync.com',
      password: hashedPassword1,
      firstName: 'Super',
      lastName: 'Admin',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      updatedAt: new Date()
    }
  });

  // Create Company Admin
  const companyAdmin = await prisma.users.upsert({
    where: { 
      companyId_email: {
        companyId: company.id,
        email: 'admin@premiumbeverages.com'
      }
    },
    update: {},
    create: {
      id: 'user-002',
      companyId: company.id,
      email: 'admin@premiumbeverages.com',
      password: hashedPassword1,
      firstName: 'Sarah',
      lastName: 'Johnson',
      name: 'Sarah Johnson',
      role: 'COMPANY_ADMIN',
      isActive: true,
      updatedAt: new Date()
    }
  });

  // Create Area Manager
  const areaManager = await prisma.users.upsert({
    where: { 
      companyId_email: {
        companyId: company.id,
        email: 'manager@premiumbeverages.com'
      }
    },
    update: {},
    create: {
      id: 'user-003',
      companyId: company.id,
      email: 'manager@premiumbeverages.com',
      password: hashedPassword2,
      firstName: 'Michael',
      lastName: 'Thompson',
      name: 'Michael Thompson',
      role: 'AREA_MANAGER',
      isActive: true,
      updatedAt: new Date()
    }
  });

  // Create Field Sales Agent
  const fieldAgent = await prisma.users.upsert({
    where: { 
      companyId_email: {
        companyId: company.id,
        email: 'agent@premiumbeverages.com'
      }
    },
    update: {},
    create: {
      id: 'user-004',
      companyId: company.id,
      email: 'agent@premiumbeverages.com',
      password: hashedPassword3,
      firstName: 'James',
      lastName: 'Wilson',
      name: 'James Wilson',
      role: 'FIELD_SALES_AGENT',
      isActive: true,
      updatedAt: new Date()
    }
  });

  console.log('✅ Users created successfully');

  // Create sample customers (using correct field names)
  const customer1 = await prisma.customers.upsert({
    where: { id: 'customer-001' },
    update: {},
    create: {
      id: 'customer-001',
      companyId: company.id,
      name: 'Pick n Pay Sandton',
      contactPerson: 'John Smith',
      email: 'john.smith@pnp.co.za',
      phone: '+27115551001',
      address: '123 Rivonia Road, Sandton, 2196',
      category: 'Retail',
      isActive: true,
      updatedAt: new Date()
    }
  });

  const customer2 = await prisma.customers.upsert({
    where: { id: 'customer-002' },
    update: {},
    create: {
      id: 'customer-002',
      companyId: company.id,
      name: 'Checkers Rosebank',
      contactPerson: 'Mary Johnson',
      email: 'mary.johnson@checkers.co.za',
      phone: '+27115551002',
      address: '456 Oxford Road, Rosebank, 2196',
      category: 'Retail',
      isActive: true,
      updatedAt: new Date()
    }
  });

  const customer3 = await prisma.customers.upsert({
    where: { id: 'customer-003' },
    update: {},
    create: {
      id: 'customer-003',
      companyId: company.id,
      name: '7-Eleven Fourways',
      contactPerson: 'Sarah Brown',
      email: 'sarah.brown@7eleven.co.za',
      phone: '+27115551004',
      address: '321 William Nicol Drive, Fourways, 2055',
      category: 'Convenience',
      isActive: true,
      updatedAt: new Date()
    }
  });

  console.log('✅ Customers created successfully');

  // Create sample leads (using correct field names)
  const lead1 = await prisma.leads.upsert({
    where: { id: 'lead-001' },
    update: {},
    create: {
      id: 'lead-001',
      userId: fieldAgent.id,
      name: 'Woolworths Menlyn',
      email: 'peter.wilson@woolworths.co.za',
      phone: '+27125551003',
      company: 'Woolworths',
      status: 'NEW',
      updatedAt: new Date()
    }
  });

  const lead2 = await prisma.leads.upsert({
    where: { id: 'lead-002' },
    update: {},
    create: {
      id: 'lead-002',
      userId: fieldAgent.id,
      name: 'Spar Hatfield',
      email: 'lisa.garcia@spar.co.za',
      phone: '+27125551006',
      company: 'Spar',
      status: 'QUALIFIED',
      updatedAt: new Date()
    }
  });

  console.log('✅ Leads created successfully');

  // Create sample visits (using correct field names with agentId)
  const visit1 = await prisma.visits.upsert({
    where: { id: 'visit-001' },
    update: {},
    create: {
      id: 'visit-001',
      companyId: company.id,
      agentId: fieldAgent.id,
      customerId: customer1.id,
      visitDate: new Date('2024-01-15'),
      status: 'COMPLETED',
      notes: 'Successful visit to Pick n Pay Sandton. Discussed new product placement.',
      updatedAt: new Date()
    }
  });

  const visit2 = await prisma.visits.upsert({
    where: { id: 'visit-002' },
    update: {},
    create: {
      id: 'visit-002',
      companyId: company.id,
      agentId: fieldAgent.id,
      customerId: customer2.id,
      visitDate: new Date('2024-01-16'),
      status: 'COMPLETED',
      notes: 'Visit to Checkers Rosebank. Customer satisfied with current products.',
      updatedAt: new Date()
    }
  });

  const visit3 = await prisma.visits.upsert({
    where: { id: 'visit-003' },
    update: {},
    create: {
      id: 'visit-003',
      companyId: company.id,
      agentId: fieldAgent.id,
      customerId: customer3.id,
      visitDate: new Date('2024-01-17'),
      status: 'PLANNED',
      notes: 'Scheduled visit to 7-Eleven Fourways for product demo.',
      updatedAt: new Date()
    }
  });

  console.log('✅ Visits created successfully');

  // Create sample sales (using correct field names with all required fields)
  const sale1 = await prisma.sales.upsert({
    where: { id: 'sale-001' },
    update: {},
    create: {
      id: 'sale-001',
      companyId: company.id,
      agentId: fieldAgent.id,
      customerId: customer1.id,
      visitId: visit1.id,
      invoiceNumber: 'INV-001',
      totalAmount: 2500.00,
      amount: 2500.00,
      paymentMethod: 'CASH',
      saleDate: new Date('2024-01-15'),
      notes: 'Premium Cola 330ml - 100 units',
      updatedAt: new Date()
    }
  });

  const sale2 = await prisma.sales.upsert({
    where: { id: 'sale-002' },
    update: {},
    create: {
      id: 'sale-002',
      companyId: company.id,
      agentId: fieldAgent.id,
      customerId: customer2.id,
      visitId: visit2.id,
      invoiceNumber: 'INV-002',
      totalAmount: 1800.00,
      amount: 1800.00,
      paymentMethod: 'CARD',
      saleDate: new Date('2024-01-16'),
      notes: 'Orange Fizz 330ml - 75 units',
      updatedAt: new Date()
    }
  });

  console.log('✅ Sales created successfully');

  console.log('\n🎉 Production database seeding completed successfully!');
  console.log('\n🔑 Demo Login Credentials:');
  console.log('Super Admin: admin@salessync.com / admin123');
  console.log('Company Admin: admin@premiumbeverages.com / admin123');
  console.log('Area Manager: manager@premiumbeverages.com / manager123');
  console.log('Field Agent: agent@premiumbeverages.com / agent123');
  
  console.log('\n📊 Sample Data Created:');
  console.log('- 1 demo company (Premium Beverages SA)');
  console.log('- 4 demo users with different roles');
  console.log('- 3 sample customers');
  console.log('- 2 sample leads');
  console.log('- 3 sample visits');
  console.log('- 2 sample sales');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });