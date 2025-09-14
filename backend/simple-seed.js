const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple database seeding...');

  // Create super admin company first
  const superAdminCompany = await prisma.company.upsert({
    where: { slug: 'salessync-platform' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'SalesSync Platform',
      slug: 'salessync-platform',
      settings: {
        theme: 'light',
        currency: 'ZAR',
        timezone: 'Africa/Johannesburg'
      },
      subscriptionTier: 'PLATFORM',
      isActive: true
    }
  });

  console.log('✅ Super Admin company created:', superAdminCompany.name);

  // Create a test company
  const testCompany = await prisma.company.upsert({
    where: { slug: 'testcompany' },
    update: {},
    create: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Company',
      slug: 'testcompany',
      settings: {
        theme: 'light',
        currency: 'ZAR',
        timezone: 'Africa/Johannesburg'
      },
      subscriptionTier: 'ENTERPRISE',
      isActive: true
    }
  });

  console.log('✅ Test company created:', testCompany.name);

  // Create Super Admin
  const superAdminPassword = await bcrypt.hash('SuperAdmin123!', 12);
  const superAdmin = await prisma.user.upsert({
    where: { 
      companyId_email: {
        companyId: '00000000-0000-0000-0000-000000000000',
        email: 'superadmin@salessync.com'
      }
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      companyId: '00000000-0000-0000-0000-000000000000',
      email: 'superadmin@salessync.com',
      password: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+27123456789',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
      profile: {
        avatar: null,
        bio: 'System Super Administrator',
        preferences: {
          theme: 'light',
          notifications: true
        }
      },
      isActive: true
    }
  });

  console.log('✅ Super Admin created:', superAdmin.email);

  // Create Company Admin
  const companyAdminPassword = await bcrypt.hash('CompanyAdmin123!', 12);
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
      password: companyAdminPassword,
      firstName: 'Company',
      lastName: 'Admin',
      phone: '+27123456790',
      role: 'COMPANY_ADMIN',
      permissions: ['MANAGE_USERS', 'MANAGE_CAMPAIGNS', 'VIEW_REPORTS'],
      profile: {
        avatar: null,
        bio: 'Company Administrator',
        preferences: {
          theme: 'light',
          notifications: true
        }
      },
      isActive: true
    }
  });

  console.log('✅ Company Admin created:', companyAdmin.email);

  // Create Field Agent
  const agentPassword = await bcrypt.hash('Agent123!', 12);
  const agent = await prisma.user.upsert({
    where: { 
      companyId_email: {
        companyId: testCompany.id,
        email: 'agent@testcompany.com'
      }
    },
    update: {},
    create: {
      companyId: testCompany.id,
      email: 'agent@testcompany.com',
      password: agentPassword,
      firstName: 'Field',
      lastName: 'Agent',
      phone: '+27123456791',
      role: 'AGENT',
      permissions: ['EXECUTE_VISITS', 'RECORD_SALES', 'COMPLETE_SURVEYS'],
      profile: {
        avatar: null,
        bio: 'Field Sales Agent',
        preferences: {
          theme: 'light',
          notifications: true
        }
      },
      isActive: true
    }
  });

  console.log('✅ Field Agent created:', agent.email);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('Super Admin: superadmin@salessync.com / SuperAdmin123!');
  console.log('Company Admin: admin@testcompany.com / CompanyAdmin123!');
  console.log('Field Agent: agent@testcompany.com / Agent123!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });