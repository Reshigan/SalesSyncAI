import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Super Admin Company first
  const superAdminCompany = await prisma.company.upsert({
    where: { slug: 'salessync-platform' },
    update: {},
    create: {
      name: 'SalesSync Platform',
      slug: 'salessync-platform',
      subscriptionTier: 'ENTERPRISE',
      settings: {
        timezone: 'Africa/Johannesburg',
        currency: 'ZAR',
        features: ['ALL']
      }
    }
  });

  // Hash passwords
  const superAdminPassword = await bcrypt.hash('SuperAdmin123!', 12);
  
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
      password: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+27123456789',
      role: 'SUPER_ADMIN',
      permissions: ['ALL'],
      profile: {
        department: 'Administration',
        location: 'Head Office'
      }
    }
  });

  console.log('✅ Super Admin created:', superAdmin.email);

  // Create Test Company
  const testCompany = await prisma.company.upsert({
    where: { slug: 'testcompany' },
    update: {},
    create: {
      name: 'TestCompany Ltd',
      slug: 'testcompany',
      subscriptionTier: 'PROFESSIONAL',
      settings: {
        timezone: 'Africa/Johannesburg',
        currency: 'ZAR',
        features: ['FIELD_SALES', 'FIELD_MARKETING', 'PROMOTIONS', 'ANALYTICS']
      }
    }
  });

  const testCompanyPassword = await bcrypt.hash('TestAdmin123!', 12);

  // Create Company Admin
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
      password: testCompanyPassword,
      firstName: 'Test',
      lastName: 'Admin',
      phone: '+27123456790',
      role: 'COMPANY_ADMIN',
      permissions: ['MANAGE_USERS', 'MANAGE_CAMPAIGNS', 'VIEW_REPORTS', 'MANAGE_SETTINGS'],
      profile: {
        department: 'Administration',
        location: 'Head Office'
      }
    }
  });

  console.log('✅ Company Admin created:', companyAdmin.email);

  // Create demo users with proper passwords
  const demoUsers = [
    {
      email: 'sales.agent@testcompany.com',
      password: 'SalesAgent123!',
      firstName: 'Mike',
      lastName: 'Salesperson',
      role: 'AGENT',
      phone: '+27123456791'
    },
    {
      email: 'marketing.agent@testcompany.com',
      password: 'MarketingAgent123!',
      firstName: 'Lisa',
      lastName: 'Marketer',
      role: 'AGENT',
      phone: '+27123456792'
    },
    {
      email: 'promoter@testcompany.com',
      password: 'Promoter123!',
      firstName: 'John',
      lastName: 'Promoter',
      role: 'AGENT',
      phone: '+27123456793'
    },
    {
      email: 'manager@testcompany.com',
      password: 'Manager123!',
      firstName: 'Sarah',
      lastName: 'Manager',
      role: 'REGIONAL_MANAGER',
      phone: '+27123456794'
    }
  ];

  for (const userData of demoUsers) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    
    await prisma.user.upsert({
      where: {
        companyId_email: {
          companyId: testCompany.id,
          email: userData.email
        }
      },
      update: {},
      create: {
        companyId: testCompany.id,
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role as any,
        permissions: userData.role === 'REGIONAL_MANAGER' ? ['MANAGE_AGENTS', 'VIEW_REPORTS'] : ['FIELD_OPERATIONS'],
        profile: {
          department: userData.role === 'REGIONAL_MANAGER' ? 'Management' : 'Field Operations',
          location: 'Field'
        }
      }
    });
    
    console.log(`✅ Demo user created: ${userData.email}`);
  }

  // Create some basic demo data
  console.log('🏢 Creating demo warehouses...');
  
  const warehouse = await prisma.warehouse.create({
    data: {
      companyId: testCompany.id,
      name: 'Main Warehouse',
      address: '123 Industrial Street, Johannesburg, South Africa',
      coordinates: { lat: -26.2041, lng: 28.0473 },
      managerName: 'Warehouse Manager',
      contactPhone: '+27123456795',
      operatingHours: {
        monday: { open: '08:00', close: '17:00' },
        tuesday: { open: '08:00', close: '17:00' },
        wednesday: { open: '08:00', close: '17:00' },
        thursday: { open: '08:00', close: '17:00' },
        friday: { open: '08:00', close: '17:00' },
        saturday: { open: '08:00', close: '12:00' },
        sunday: { closed: true }
      }
    }
  });

  console.log('📦 Creating demo products...');
  
  const products = [
    { name: 'Coca-Cola 330ml', category: 'Beverages', price: 15.99, sku: 'CC-330' },
    { name: 'Pepsi 330ml', category: 'Beverages', price: 14.99, sku: 'PP-330' },
    { name: 'Lays Chips Original', category: 'Snacks', price: 12.99, sku: 'LC-ORG' },
    { name: 'Simba Chips', category: 'Snacks', price: 11.99, sku: 'SC-REG' },
    { name: 'Bread Loaf', category: 'Bakery', price: 18.99, sku: 'BR-WHT' }
  ];

  for (const productData of products) {
    await prisma.product.create({
      data: {
        companyId: testCompany.id,
        name: productData.name,
        sku: productData.sku,
        category: productData.category,
        price: productData.price,
        description: `Premium ${productData.name}`,
        specifications: {
          weight: '330ml',
          brand: productData.name.split(' ')[0]
        }
      }
    });
  }

  console.log('🏪 Creating demo customers...');
  
  const customers = [
    {
      name: 'Spaza Shop Corner',
      address: '456 Township Road, Soweto, Johannesburg',
      coordinates: { lat: -26.2678, lng: 27.8546 },
      phone: '+27123456796',
      type: 'SPAZA_SHOP'
    },
    {
      name: 'Mini Market Central',
      address: '789 Main Street, Sandton, Johannesburg',
      coordinates: { lat: -26.1076, lng: 28.0567 },
      phone: '+27123456797',
      type: 'MINI_MARKET'
    },
    {
      name: 'Corner Cafe',
      address: '321 Suburb Avenue, Randburg, Johannesburg',
      coordinates: { lat: -26.0939, lng: 28.0021 },
      phone: '+27123456798',
      type: 'CAFE'
    }
  ];

  for (const customerData of customers) {
    await prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: customerData.name,
        address: customerData.address,
        coordinates: customerData.coordinates,
        phone: customerData.phone,
        customerType: customerData.type as any,
        profile: {
          businessHours: '08:00-18:00',
          paymentTerms: 'Cash on delivery'
        }
      }
    });
  }

  console.log('✅ Database seeding completed successfully!');
  console.log('\n🔑 Login Credentials:');
  console.log('Super Admin: superadmin@salessync.com / SuperAdmin123!');
  console.log('Company Admin: admin@testcompany.com / TestAdmin123!');
  console.log('Sales Agent: sales.agent@testcompany.com / SalesAgent123!');
  console.log('Marketing Agent: marketing.agent@testcompany.com / MarketingAgent123!');
  console.log('Promoter: promoter@testcompany.com / Promoter123!');
  console.log('Manager: manager@testcompany.com / Manager123!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });