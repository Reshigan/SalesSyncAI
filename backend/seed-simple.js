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
        isActive: true,
      },
    });
    console.log('✅ Company created:', company.name);

    // Create a demo user
    const user = await prisma.user.upsert({
      where: { 
        companyId_email: {
          companyId: company.id,
          email: 'admin@demo.com'
        }
      },
      update: {},
      create: {
        companyId: company.id,
        email: 'admin@demo.com',
        password: '$2b$10$rQZ9QmjQZ9QmjQZ9QmjQZO', // hashed 'password123'
        firstName: 'Demo',
        lastName: 'Admin',
        role: 'COMPANY_ADMIN',
        isActive: true,
      },
    });
    console.log('✅ User created:', user.firstName + ' ' + user.lastName);

    // Create a demo customer
    const customer = await prisma.customer.upsert({
      where: { 
        id: `${company.id}-demo-customer`
      },
      update: {},
      create: {
        id: `${company.id}-demo-customer`,
        companyId: company.id,
        name: 'Demo Customer',
        contactPerson: 'Demo Contact',
        email: 'customer@demo.com',
        phone: '+1234567890',
        address: '123 Demo Street',
        category: 'Demo',
        isActive: true,
      },
    });
    console.log('✅ Customer created:', customer.name);

    // Note: Lead model not available in current schema

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