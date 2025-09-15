#!/usr/bin/env node

/**
 * Simple JavaScript Demo Seed Script
 * 
 * This script creates basic demo data without TypeScript dependencies
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting simple demo database seeding...');

  try {
    // Create Demo Company
    console.log('Creating demo company...');
    const demoCompany = await prisma.company.upsert({
      where: { slug: 'techcorp-demo' },
      update: {},
      create: {
        name: 'TechCorp Solutions',
        slug: 'techcorp-demo',
        subscriptionTier: 'PROFESSIONAL',
        settings: {
          features: ['FIELD_SALES', 'FIELD_MARKETING', 'PROMOTIONS'],
          branding: {
            primaryColor: '#1E3A8A',
            secondaryColor: '#3B82F6',
            logo: '/assets/techcorp-logo.png'
          }
        },
        isActive: true
      }
    });

    // Create Demo Admin User
    console.log('Creating demo admin user...');
    const hashedPassword = await bcrypt.hash('Demo123!', 10);
    
    const adminUser = await prisma.user.upsert({
      where: { 
        companyId_email: {
          companyId: demoCompany.id,
          email: 'demo@techcorp.com'
        }
      },
      update: {},
      create: {
        email: 'demo@techcorp.com',
        password: hashedPassword,
        firstName: 'Demo',
        lastName: 'Admin',
        role: 'COMPANY_ADMIN',
        isActive: true,
        companyId: demoCompany.id,
        profile: {
          notifications: { email: true, push: true },
          preferences: { theme: 'light', language: 'en' }
        }
      }
    });

    // Create Manager User
    console.log('Creating manager user...');
    const managerPassword = await bcrypt.hash('Manager123!', 10);
    
    const managerUser = await prisma.user.upsert({
      where: { 
        companyId_email: {
          companyId: demoCompany.id,
          email: 'manager@techcorp.com'
        }
      },
      update: {},
      create: {
        email: 'manager@techcorp.com',
        password: managerPassword,
        firstName: 'Sarah',
        lastName: 'Manager',
        role: 'REGIONAL_MANAGER',
        isActive: true,
        companyId: demoCompany.id,
        profile: {
          notifications: { email: true, push: true },
          preferences: { theme: 'light', language: 'en' }
        }
      }
    });

    // Create Field Agent
    console.log('Creating field agent...');
    const agentPassword = await bcrypt.hash('Agent123!', 10);
    
    const agentUser = await prisma.user.upsert({
      where: { 
        companyId_email: {
          companyId: demoCompany.id,
          email: 'agent1@techcorp.com'
        }
      },
      update: {},
      create: {
        email: 'agent1@techcorp.com',
        password: agentPassword,
        firstName: 'John',
        lastName: 'Agent',
        role: 'AGENT',
        isActive: true,
        companyId: demoCompany.id,
        profile: {
          notifications: { email: true, push: true },
          preferences: { theme: 'light', language: 'en' }
        }
      }
    });

    // Create some demo products
    console.log('Creating demo products...');
    const products = [
      {
        name: 'Smartphone Pro X1',
        description: 'Latest flagship smartphone with advanced features',
        sku: 'PHONE-X1-001',
        unitPrice: 12999.00,
        category: 'Electronics',
        isActive: true
      },
      {
        name: 'Wireless Earbuds Elite',
        description: 'Premium wireless earbuds with noise cancellation',
        sku: 'AUDIO-WE-002',
        unitPrice: 2999.00,
        category: 'Audio',
        isActive: true
      },
      {
        name: 'Smart Watch Series 5',
        description: 'Advanced smartwatch with health monitoring',
        sku: 'WATCH-S5-003',
        unitPrice: 8999.00,
        category: 'Wearables',
        isActive: true
      },
      {
        name: 'Tablet Pro 12"',
        description: 'Professional tablet for productivity',
        sku: 'TABLET-P12-004',
        unitPrice: 15999.00,
        category: 'Tablets',
        isActive: true
      },
      {
        name: 'Bluetooth Speaker Max',
        description: 'Portable speaker with premium sound quality',
        sku: 'SPEAKER-MAX-005',
        unitPrice: 4999.00,
        category: 'Audio',
        isActive: true
      }
    ];

    const createdProducts = [];
    for (const productData of products) {
      const product = await prisma.product.upsert({
        where: { sku: productData.sku },
        update: {},
        create: {
          ...productData,
          companyId: demoCompany.id
        }
      });
      createdProducts.push(product);
    }

    // Create demo customers
    console.log('Creating demo customers...');
    const customers = [
      {
        name: 'TechZone Sandton',
        email: 'orders@techzone-sandton.co.za',
        phone: '+27 11 234 5678',
        address: '123 Rivonia Road, Sandton, Johannesburg',
        type: 'RETAILER'
      },
      {
        name: 'Digital World Cape Town',
        email: 'sales@digitalworld-ct.co.za',
        phone: '+27 21 345 6789',
        address: '456 Long Street, Cape Town',
        type: 'RETAILER'
      },
      {
        name: 'Gadget Hub Durban',
        email: 'info@gadgethub-dbn.co.za',
        phone: '+27 31 456 7890',
        address: '789 Florida Road, Durban',
        type: 'RETAILER'
      }
    ];

    const createdCustomers = [];
    for (const customerData of customers) {
      const customer = await prisma.customer.upsert({
        where: { email: customerData.email },
        update: {},
        create: {
          ...customerData,
          companyId: demoCompany.id,
          isActive: true
        }
      });
      createdCustomers.push(customer);
    }

    // Create a demo sale
    console.log('Creating demo sale...');
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}-001`;
    
    const sale = await prisma.sale.create({
      data: {
        companyId: demoCompany.id,
        agentId: agentUser.id,
        customerId: createdCustomers[0].id,
        invoiceNumber: invoiceNumber,
        totalAmount: 15998.00,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID'
      }
    });

    // Create sale items
    await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId: createdProducts[0].id, // Smartphone
        quantity: 1,
        unitPrice: 12999.00,
        total: 12999.00
      }
    });

    await prisma.saleItem.create({
      data: {
        saleId: sale.id,
        productId: createdProducts[1].id, // Earbuds
        quantity: 1,
        unitPrice: 2999.00,
        total: 2999.00
      }
    });

    console.log('✅ Simple demo data created successfully!');
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('  👤 Admin:   demo@techcorp.com / Demo123!');
    console.log('  👨‍💼 Manager: manager@techcorp.com / Manager123!');
    console.log('  🚶 Agent:   agent1@techcorp.com / Agent123!');
    console.log('');
    console.log('📊 Created:');
    console.log(`  • 1 Company: ${demoCompany.name}`);
    console.log(`  • 3 Users: Admin, Manager, Agent`);
    console.log(`  • ${createdProducts.length} Products`);
    console.log(`  • ${createdCustomers.length} Customers`);
    console.log(`  • 1 Sale with 2 items`);

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });