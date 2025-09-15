const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple database seeding...');

  try {
    // Create a demo company
    const company = await prisma.company.upsert({
      where: { slug: 'demo-company' },
      update: {},
      create: {
        name: 'Demo Company',
        slug: 'demo-company',
        description: 'Demo company for testing',
        isActive: true,
      },
    });
    console.log('✅ Company created:', company.name);

    // Create a demo user
    const user = await prisma.user.upsert({
      where: { email: 'admin@demo.com' },
      update: {},
      create: {
        email: 'admin@demo.com',
        password: '$2b$10$rQZ9QmjQZ9QmjQZ9QmjQZO', // hashed 'password123'
        name: 'Demo Admin',
        role: 'ADMIN',
        isActive: true,
        companyId: company.id,
      },
    });
    console.log('✅ User created:', user.name);

    // Create a demo customer
    const customer = await prisma.customer.upsert({
      where: { 
        email_userId: {
          email: 'customer@demo.com',
          userId: user.id
        }
      },
      update: {},
      create: {
        name: 'Demo Customer',
        email: 'customer@demo.com',
        phone: '+1234567890',
        company: 'Customer Corp',
        address: '123 Demo Street',
        userId: user.id,
        companyId: company.id,
        isActive: true,
      },
    });
    console.log('✅ Customer created:', customer.name);

    // Create a demo lead
    const lead = await prisma.lead.upsert({
      where: {
        email_userId: {
          email: 'lead@demo.com',
          userId: user.id
        }
      },
      update: {},
      create: {
        name: 'Demo Lead',
        email: 'lead@demo.com',
        phone: '+1234567891',
        company: 'Lead Corp',
        status: 'NEW',
        userId: user.id,
        companyId: company.id,
      },
    });
    console.log('✅ Lead created:', lead.name);

    console.log('🎉 Simple seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });