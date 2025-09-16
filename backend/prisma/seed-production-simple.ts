import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production database seeding (simple schema)...');

  // Create demo users with proper bcrypt hashed passwords
  const hashedPassword1 = await bcrypt.hash('admin123', 10);
  const hashedPassword2 = await bcrypt.hash('manager123', 10);
  const hashedPassword3 = await bcrypt.hash('agent123', 10);
  const hashedPassword4 = await bcrypt.hash('user123', 10);

  // Create Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@salessync.com' },
    update: {},
    create: {
      email: 'admin@salessync.com',
      password: hashedPassword1,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true
    }
  });

  // Create Company Admin
  const companyAdmin = await prisma.user.upsert({
    where: { email: 'admin@premiumbeverages.com' },
    update: {},
    create: {
      email: 'admin@premiumbeverages.com',
      password: hashedPassword1,
      name: 'Sarah Johnson',
      role: 'COMPANY_ADMIN',
      isActive: true
    }
  });

  // Create Area Manager
  const areaManager = await prisma.user.upsert({
    where: { email: 'manager@premiumbeverages.com' },
    update: {},
    create: {
      email: 'manager@premiumbeverages.com',
      password: hashedPassword2,
      name: 'Michael Thompson',
      role: 'AREA_MANAGER',
      isActive: true
    }
  });

  // Create Field Sales Agent
  const fieldAgent = await prisma.user.upsert({
    where: { email: 'agent@premiumbeverages.com' },
    update: {},
    create: {
      email: 'agent@premiumbeverages.com',
      password: hashedPassword3,
      name: 'James Wilson',
      role: 'FIELD_SALES_AGENT',
      isActive: true
    }
  });

  console.log('✅ Users created successfully');

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { id: 'customer-001' },
    update: {},
    create: {
      userId: fieldAgent.id,
      name: 'Pick n Pay Sandton',
      email: 'john.smith@pnp.co.za',
      phone: '+27115551001',
      company: 'Pick n Pay',
      address: '123 Rivonia Road, Sandton, 2196',
      isActive: true
    }
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: 'customer-002' },
    update: {},
    create: {
      userId: fieldAgent.id,
      name: 'Checkers Rosebank',
      email: 'mary.johnson@checkers.co.za',
      phone: '+27115551002',
      company: 'Checkers',
      address: '456 Oxford Road, Rosebank, 2196',
      isActive: true
    }
  });

  const customer3 = await prisma.customer.upsert({
    where: { id: 'customer-003' },
    update: {},
    create: {
      userId: fieldAgent.id,
      name: '7-Eleven Fourways',
      email: 'sarah.brown@7eleven.co.za',
      phone: '+27115551004',
      company: '7-Eleven',
      address: '321 William Nicol Drive, Fourways, 2055',
      isActive: true
    }
  });

  console.log('✅ Customers created successfully');

  // Create sample leads
  const lead1 = await prisma.lead.upsert({
    where: { id: 'lead-001' },
    update: {},
    create: {
      userId: fieldAgent.id,
      name: 'Woolworths Menlyn',
      email: 'peter.wilson@woolworths.co.za',
      phone: '+27125551003',
      company: 'Woolworths',
      status: 'NEW'
    }
  });

  const lead2 = await prisma.lead.upsert({
    where: { id: 'lead-002' },
    update: {},
    create: {
      userId: fieldAgent.id,
      name: 'Spar Hatfield',
      email: 'lisa.garcia@spar.co.za',
      phone: '+27125551006',
      company: 'Spar',
      status: 'QUALIFIED'
    }
  });

  console.log('✅ Leads created successfully');

  // Create sample visits
  const visit1 = await prisma.visit.upsert({
    where: { id: 'visit-001' },
    update: {},
    create: {
      userId: fieldAgent.id,
      customerId: customer1.id,
      visitDate: new Date('2024-01-15'),
      status: 'COMPLETED',
      notes: 'Successful visit to Pick n Pay Sandton. Discussed new product placement.'
    }
  });

  const visit2 = await prisma.visit.upsert({
    where: { id: 'visit-002' },
    update: {},
    create: {
      userId: fieldAgent.id,
      customerId: customer2.id,
      visitDate: new Date('2024-01-16'),
      status: 'COMPLETED',
      notes: 'Visit to Checkers Rosebank. Customer satisfied with current products.'
    }
  });

  const visit3 = await prisma.visit.upsert({
    where: { id: 'visit-003' },
    update: {},
    create: {
      userId: fieldAgent.id,
      customerId: customer3.id,
      visitDate: new Date('2024-01-17'),
      status: 'PLANNED',
      notes: 'Scheduled visit to 7-Eleven Fourways for product demo.'
    }
  });

  console.log('✅ Visits created successfully');

  // Create sample sales
  const sale1 = await prisma.sale.upsert({
    where: { id: 'sale-001' },
    update: {},
    create: {
      userId: fieldAgent.id,
      customerId: customer1.id,
      visitId: visit1.id,
      amount: 2500.00,
      status: 'COMPLETED',
      saleDate: new Date('2024-01-15'),
      notes: 'Premium Cola 330ml - 100 units'
    }
  });

  const sale2 = await prisma.sale.upsert({
    where: { id: 'sale-002' },
    update: {},
    create: {
      userId: fieldAgent.id,
      customerId: customer2.id,
      visitId: visit2.id,
      amount: 1800.00,
      status: 'COMPLETED',
      saleDate: new Date('2024-01-16'),
      notes: 'Orange Fizz 330ml - 75 units'
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