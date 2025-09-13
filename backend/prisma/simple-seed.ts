import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple seed...');

  // Clear existing data
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // Create Super Admin Company
  const superAdminCompany = await prisma.company.create({
    data: {
      name: 'SalesSync Platform',
      slug: 'salessync-platform',
      subscriptionTier: 'ENTERPRISE',
      settings: {
        features: ['all'],
        limits: { users: -1, storage: -1 }
      }
    }
  });

  // Create Test Company
  const testCompany = await prisma.company.create({
    data: {
      name: 'Test Company',
      slug: 'test-company',
      subscriptionTier: 'PROFESSIONAL',
      settings: {
        features: ['field_sales', 'field_marketing', 'promotions'],
        limits: { users: 100, storage: 10000 }
      }
    }
  });

  // Hash passwords
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Create Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      companyId: superAdminCompany.id,
      email: 'superadmin@salessync.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      profile: {
        phone: '+27123456789',
        permissions: ['all']
      }
    }
  });

  // Create Test Company Admin
  const testAdmin = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'admin@testcompany.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'Admin',
      role: 'COMPANY_ADMIN',
      isActive: true,
      profile: {
        phone: '+27123456790',
        permissions: ['company_admin']
      }
    }
  });

  // Create Field Sales Agent
  const fieldAgent = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'agent@testcompany.com',
      password: hashedPassword,
      firstName: 'Field',
      lastName: 'Agent',
      role: 'AGENT',
      isActive: true,
      profile: {
        phone: '+27123456791',
        agentType: 'FIELD_SALES',
        territory: 'Cape Town Central'
      }
    }
  });

  // Create Marketing Agent
  const marketingAgent = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'marketing@testcompany.com',
      password: hashedPassword,
      firstName: 'Marketing',
      lastName: 'Agent',
      role: 'AGENT',
      isActive: true,
      profile: {
        phone: '+27123456792',
        agentType: 'FIELD_MARKETING',
        territory: 'Cape Town North'
      }
    }
  });

  // Create Promoter
  const promoter = await prisma.user.create({
    data: {
      companyId: testCompany.id,
      email: 'promoter@testcompany.com',
      password: hashedPassword,
      firstName: 'Event',
      lastName: 'Promoter',
      role: 'AGENT',
      isActive: true,
      profile: {
        phone: '+27123456793',
        agentType: 'PROMOTER',
        territory: 'Cape Town South'
      }
    }
  });

  console.log('✅ Seed completed successfully!');
  console.log('\n🔑 Login Credentials:');
  console.log('Super Admin: superadmin@salessync.com / admin123');
  console.log('Company Admin: admin@testcompany.com / admin123');
  console.log('Field Agent: agent@testcompany.com / admin123');
  console.log('Marketing Agent: marketing@testcompany.com / admin123');
  console.log('Promoter: promoter@testcompany.com / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });