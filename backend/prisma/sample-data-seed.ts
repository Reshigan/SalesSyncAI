import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Adding sample data...');

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

  const marketingAgent = await prisma.user.findFirst({
    where: { 
      companyId: testCompany.id,
      email: 'marketing@testcompany.com'
    }
  });

  if (!fieldAgent || !marketingAgent) {
    console.error('Agents not found!');
    return;
  }

  // Create warehouses
  const warehouse1 = await prisma.warehouse.create({
    data: {
      companyId: testCompany.id,
      name: 'Cape Town Central Warehouse',
      address: '123 Main Street, Cape Town, 8001',
      location: {
        type: 'Point',
        coordinates: [-33.9249, 18.4241] // Cape Town coordinates
      },
      managerName: 'John Smith',
      contactPhone: '+27123456789',
      isActive: true
    }
  });

  const warehouse2 = await prisma.warehouse.create({
    data: {
      companyId: testCompany.id,
      name: 'Johannesburg North Warehouse',
      address: '456 Industrial Road, Johannesburg, 2001',
      location: {
        type: 'Point',
        coordinates: [-26.2041, 28.0473] // Johannesburg coordinates
      },
      managerName: 'Sarah Johnson',
      contactPhone: '+27123456790',
      isActive: true
    }
  });

  // Create product categories
  const beverageCategory = await prisma.productCategory.create({
    data: {
      companyId: testCompany.id,
      name: 'Beverages',
      description: 'Soft drinks, juices, and energy drinks',
      isActive: true
    }
  });

  const snackCategory = await prisma.productCategory.create({
    data: {
      companyId: testCompany.id,
      name: 'Snacks',
      description: 'Chips, crackers, and confectionery',
      isActive: true
    }
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        companyId: testCompany.id,
        categoryId: beverageCategory.id,
        name: 'Coca-Cola 330ml',
        description: 'Classic Coca-Cola in 330ml can',
        sku: 'COKE-330',
        barcode: '1234567890123',
        unitPrice: 12.50,
        costPrice: 8.00,
        isActive: true,
        specifications: {
          volume: '330ml',
          packaging: 'Can',
          shelfLife: '12 months'
        }
      }
    }),
    prisma.product.create({
      data: {
        companyId: testCompany.id,
        categoryId: beverageCategory.id,
        name: 'Fanta Orange 330ml',
        description: 'Orange flavored soft drink in 330ml can',
        sku: 'FANTA-330',
        barcode: '1234567890124',
        unitPrice: 12.50,
        costPrice: 8.00,
        isActive: true,
        specifications: {
          volume: '330ml',
          packaging: 'Can',
          shelfLife: '12 months'
        }
      }
    }),
    prisma.product.create({
      data: {
        companyId: testCompany.id,
        categoryId: snackCategory.id,
        name: 'Lays Chips Original 120g',
        description: 'Original flavored potato chips',
        sku: 'LAYS-120',
        barcode: '1234567890125',
        unitPrice: 18.99,
        costPrice: 12.00,
        isActive: true,
        specifications: {
          weight: '120g',
          packaging: 'Bag',
          shelfLife: '6 months'
        }
      }
    }),
    prisma.product.create({
      data: {
        companyId: testCompany.id,
        categoryId: snackCategory.id,
        name: 'KitKat 4-Finger 45g',
        description: 'Milk chocolate wafer bar',
        sku: 'KITKAT-45',
        barcode: '1234567890126',
        unitPrice: 15.99,
        costPrice: 10.00,
        isActive: true,
        specifications: {
          weight: '45g',
          packaging: 'Wrapper',
          shelfLife: '12 months'
        }
      }
    })
  ]);

  // Create inventory for warehouses
  for (const product of products) {
    await prisma.inventory.create({
      data: {
        companyId: testCompany.id,
        warehouseId: warehouse1.id,
        productId: product.id,
        quantity: Math.floor(Math.random() * 500) + 100, // 100-600 units
        reservedQuantity: 0,
        reorderLevel: 50,
        maxLevel: 1000
      }
    });

    await prisma.inventory.create({
      data: {
        companyId: testCompany.id,
        warehouseId: warehouse2.id,
        productId: product.id,
        quantity: Math.floor(Math.random() * 500) + 100, // 100-600 units
        reservedQuantity: 0,
        reorderLevel: 50,
        maxLevel: 1000
      }
    });
  }

  // Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Spar Supermarket - Sea Point',
        type: 'RETAIL',
        contactPerson: 'Mike Wilson',
        email: 'mike@spar-seapoint.co.za',
        phone: '+27214567890',
        address: '78 Main Road, Sea Point, Cape Town, 8005',
        location: {
          type: 'Point',
          coordinates: [-33.9304, 18.3894]
        },
        creditLimit: 50000.00,
        paymentTerms: 30,
        isActive: true,
        profile: {
          storeSize: 'Medium',
          customerSince: '2022-01-15',
          preferredDeliveryDay: 'Tuesday'
        }
      }
    }),
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Pick n Pay - Claremont',
        type: 'RETAIL',
        contactPerson: 'Lisa Brown',
        email: 'lisa@pnp-claremont.co.za',
        phone: '+27214567891',
        address: '45 Rosmead Avenue, Claremont, Cape Town, 7708',
        location: {
          type: 'Point',
          coordinates: [-33.9857, 18.4647]
        },
        creditLimit: 75000.00,
        paymentTerms: 30,
        isActive: true,
        profile: {
          storeSize: 'Large',
          customerSince: '2021-08-20',
          preferredDeliveryDay: 'Wednesday'
        }
      }
    }),
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Checkers - Rondebosch',
        type: 'RETAIL',
        contactPerson: 'David Lee',
        email: 'david@checkers-rondebosch.co.za',
        phone: '+27214567892',
        address: '12 Belmont Road, Rondebosch, Cape Town, 7700',
        location: {
          type: 'Point',
          coordinates: [-33.9579, 18.4738]
        },
        creditLimit: 60000.00,
        paymentTerms: 30,
        isActive: true,
        profile: {
          storeSize: 'Medium',
          customerSince: '2022-03-10',
          preferredDeliveryDay: 'Thursday'
        }
      }
    }),
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Woolworths - V&A Waterfront',
        type: 'RETAIL',
        contactPerson: 'Emma Davis',
        email: 'emma@woolworths-vna.co.za',
        phone: '+27214567893',
        address: 'V&A Waterfront, Cape Town, 8001',
        location: {
          type: 'Point',
          coordinates: [-33.9067, 18.4219]
        },
        creditLimit: 100000.00,
        paymentTerms: 30,
        isActive: true,
        profile: {
          storeSize: 'Large',
          customerSince: '2021-05-01',
          preferredDeliveryDay: 'Monday'
        }
      }
    }),
    prisma.customer.create({
      data: {
        companyId: testCompany.id,
        name: 'Café Ubuntu - Observatory',
        type: 'HOSPITALITY',
        contactPerson: 'Thabo Mthembu',
        email: 'thabo@ubuntu-cafe.co.za',
        phone: '+27214567894',
        address: '23 Lower Main Road, Observatory, Cape Town, 7925',
        location: {
          type: 'Point',
          coordinates: [-33.9352, 18.4734]
        },
        creditLimit: 15000.00,
        paymentTerms: 14,
        isActive: true,
        profile: {
          storeSize: 'Small',
          customerSince: '2023-01-15',
          preferredDeliveryDay: 'Friday'
        }
      }
    })
  ]);

  // Create some visits for the past month
  const today = new Date();
  const oneMonthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 20; i++) {
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
        location: customer.location,
        visitData: {
          purpose: 'Sales visit',
          notes: `Regular sales visit to ${customer.name}`,
          photosCount: Math.floor(Math.random() * 5) + 1,
          surveysCompleted: Math.floor(Math.random() * 3),
          issuesReported: Math.random() > 0.8 ? ['Stock shortage'] : []
        }
      }
    });

    // Create some sales for this visit
    if (Math.random() > 0.3) { // 70% chance of sales
      const numProducts = Math.floor(Math.random() * 3) + 1;
      const selectedProducts = products.sort(() => 0.5 - Math.random()).slice(0, numProducts);
      
      for (const product of selectedProducts) {
        const quantity = Math.floor(Math.random() * 20) + 1;
        const unitPrice = product.unitPrice;
        const totalAmount = quantity * unitPrice;

        await prisma.sale.create({
          data: {
            companyId: testCompany.id,
            agentId: fieldAgent.id,
            customerId: customer.id,
            visitId: visit.id,
            productId: product.id,
            quantity,
            unitPrice,
            totalAmount,
            paymentMethod: Math.random() > 0.5 ? 'CASH' : 'CREDIT',
            status: 'COMPLETED',
            saleDate: visitDate
          }
        });
      }
    }
  }

  // Create some brands for marketing campaigns
  const brands = await Promise.all([
    prisma.brand.create({
      data: {
        companyId: testCompany.id,
        name: 'Coca-Cola',
        description: 'The world\'s favorite soft drink brand',
        isActive: true,
        brandGuidelines: {
          primaryColor: '#FF0000',
          secondaryColor: '#FFFFFF',
          logoUsage: 'Always maintain clear space around logo',
          messaging: 'Open Happiness'
        }
      }
    }),
    prisma.brand.create({
      data: {
        companyId: testCompany.id,
        name: 'Lays',
        description: 'Premium potato chips brand',
        isActive: true,
        brandGuidelines: {
          primaryColor: '#FFD700',
          secondaryColor: '#FF0000',
          logoUsage: 'Logo should be prominently displayed',
          messaging: 'Betcha Can\'t Eat Just One'
        }
      }
    })
  ]);

  // Create a marketing campaign
  const campaign = await prisma.campaign.create({
    data: {
      companyId: testCompany.id,
      name: 'Summer Refresh Campaign 2024',
      description: 'Promote Coca-Cola products during summer season',
      type: 'BRAND_AWARENESS',
      status: 'ACTIVE',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2025-03-31'),
      budget: 50000.00,
      targetMetrics: {
        visits: 100,
        surveys: 200,
        photos: 300,
        sales: 25000.00
      },
      settings: {
        requirePhotos: true,
        mandatorySurvey: true,
        incentivePerVisit: 50.00
      }
    }
  });

  // Link brands to campaign
  await prisma.campaignBrand.create({
    data: {
      campaignId: campaign.id,
      brandId: brands[0].id // Coca-Cola
    }
  });

  // Link products to campaign
  await prisma.campaignProduct.create({
    data: {
      campaignId: campaign.id,
      productId: products[0].id // Coca-Cola 330ml
    }
  });

  await prisma.campaignProduct.create({
    data: {
      campaignId: campaign.id,
      productId: products[1].id // Fanta Orange 330ml
    }
  });

  console.log('✅ Sample data created successfully!');
  console.log(`📊 Created:`);
  console.log(`   - 2 warehouses`);
  console.log(`   - 2 product categories`);
  console.log(`   - 4 products`);
  console.log(`   - 8 inventory records`);
  console.log(`   - 5 customers`);
  console.log(`   - 20 visits with sales`);
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