import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding simple sample data...');

  // Get the test company
  const testCompany = await prisma.company.findFirst({
    where: { slug: 'test-company' }
  });

  if (!testCompany) {
    console.error('Test company not found!');
    return;
  }

  // Get agents
  const fieldAgent = await prisma.user.findFirst({
    where: { 
      companyId: testCompany.id,
      email: 'agent@testcompany.com'
    }
  });

  if (!fieldAgent) {
    console.error('Field agent not found!');
    return;
  }

  // Create warehouses
  const warehouse1 = await prisma.warehouse.create({
    data: {
      companyId: testCompany.id,
      name: 'Cape Town Central Warehouse',
      address: '123 Main Street, Cape Town, 8001',
      coordinates: { lat: -33.9249, lng: 18.4241 },
      isActive: true
    }
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        companyId: testCompany.id,
        name: 'Coca-Cola 330ml',
        description: 'Classic Coca-Cola in 330ml can',
        sku: 'COKE-330',
        barcode: '1234567890123',
        category: 'Beverages',
        unitPrice: 12.50,
        isActive: true
      }
    }),
    prisma.product.create({
      data: {
        companyId: testCompany.id,
        name: 'Fanta Orange 330ml',
        description: 'Orange flavored soft drink in 330ml can',
        sku: 'FANTA-330',
        barcode: '1234567890124',
        category: 'Beverages',
        unitPrice: 12.50,
        isActive: true
      }
    }),
    prisma.product.create({
      data: {
        companyId: testCompany.id,
        name: 'Lays Chips Original 120g',
        description: 'Original flavored potato chips',
        sku: 'LAYS-120',
        barcode: '1234567890125',
        category: 'Snacks',
        unitPrice: 18.99,
        isActive: true
      }
    })
  ]);

  // Create stock levels for products
  for (const product of products) {
    await prisma.stockLevel.create({
      data: {
        warehouseId: warehouse1.id,
        productId: product.id,
        quantity: Math.floor(Math.random() * 500) + 100, // 100-600 units
        reservedQty: 0
      }
    });
  }

  // Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Spar Supermarket - Sea Point',
        contactPerson: 'Mike Wilson',
        email: 'mike@spar-seapoint.co.za',
        phone: '+27214567890',
        address: '78 Main Road, Sea Point, Cape Town, 8005',
        coordinates: { lat: -33.9304, lng: 18.3894 },
        category: 'Retail',
        creditLimit: 50000.00,
        isActive: true
      }
    }),
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Pick n Pay - Claremont',
        contactPerson: 'Lisa Brown',
        email: 'lisa@pnp-claremont.co.za',
        phone: '+27214567891',
        address: '45 Rosmead Avenue, Claremont, Cape Town, 7708',
        coordinates: { lat: -33.9857, lng: 18.4647 },
        category: 'Retail',
        creditLimit: 75000.00,
        isActive: true
      }
    }),
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Checkers - Rondebosch',
        contactPerson: 'David Lee',
        email: 'david@checkers-rondebosch.co.za',
        phone: '+27214567892',
        address: '12 Belmont Road, Rondebosch, Cape Town, 7700',
        coordinates: { lat: -33.9579, lng: 18.4738 },
        category: 'Retail',
        creditLimit: 60000.00,
        isActive: true
      }
    })
  ]);

  // Create some visits for the past month
  const today = new Date();
  const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 15; i++) {
    const visitDate = new Date(oneMonthAgo.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);
    const customer = customers[Math.floor(Math.random() * customers.length)];
    
    const visit = await prisma.visit.create({
      data: {
        companyId: testCompany.id,
        agentId: fieldAgent.id,
        customerId: customer.id,
        plannedStartTime: visitDate,
        actualStartTime: visitDate,
        actualEndTime: new Date(visitDate.getTime() + (Math.random() * 2 + 0.5) * 60 * 60 * 1000), // 30min - 2.5hr
        status: 'COMPLETED',
        gpsLocation: { arrival: customer.coordinates, departure: customer.coordinates },
        notes: `Regular sales visit to ${customer.name}`,
        photos: JSON.stringify([{ url: 'photo1.jpg', timestamp: visitDate }])
      }
    });

    // Create some sales for this visit
    if (Math.random() > 0.3) { // 70% chance of sales
      const numProducts = Math.floor(Math.random() * 2) + 1;
      const selectedProducts = products.sort(() => 0.5 - Math.random()).slice(0, numProducts);
      
      for (const product of selectedProducts) {
        const quantity = Math.floor(Math.random() * 20) + 1;
        const unitPrice = product.unitPrice;
        const totalAmount = quantity * Number(unitPrice);

        await prisma.sale.create({
          data: {
            companyId: testCompany.id,
            agentId: fieldAgent.id,
            customerId: customer.id,
            visitId: visit.id,
            invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            totalAmount,
            paymentMethod: Math.random() > 0.5 ? 'CASH' : 'CREDIT',
            items: {
              create: [{
                productId: product.id,
                quantity,
                unitPrice,
                total: totalAmount
              }]
            }
          }
        });
      }
    }
  }

  // Create some brands
  const brands = await Promise.all([
    prisma.brand.create({
      data: {
        companyId: testCompany.id,
        name: 'Coca-Cola',
        description: 'The world\'s favorite soft drink brand',
        isActive: true
      }
    }),
    prisma.brand.create({
      data: {
        companyId: testCompany.id,
        name: 'Lays',
        description: 'Premium potato chips brand',
        isActive: true
      }
    })
  ]);

  // Create a marketing campaign
  const campaign = await prisma.campaign.create({
    data: {
      companyId: testCompany.id,
      name: 'Summer Refresh Campaign 2024',
      description: 'Promote Coca-Cola products during summer season',
      type: 'FIELD_MARKETING',
      status: 'ACTIVE',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2025-03-31'),
      budget: 50000.00
    }
  });

  console.log('✅ Simple sample data created successfully!');
  console.log(`📊 Created:`);
  console.log(`   - 1 warehouse`);
  console.log(`   - 3 products with stock levels`);
  console.log(`   - 3 customers`);
  console.log(`   - 15 visits with sales`);
  console.log(`   - 2 brands`);
  console.log(`   - 1 marketing campaign`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });