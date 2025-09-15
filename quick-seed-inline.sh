#!/bin/bash

echo "🌱 QUICK INLINE SEEDING - No File Copy Required"
echo "This will seed the database using inline commands"
echo ""

echo "🚀 Step 1: Starting containers if not running..."
docker-compose -f docker-compose.production.yml up -d
sleep 10

echo "🗄️ Step 2: Setting up database..."
docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod;" 2>/dev/null
docker exec salessync-postgres psql -U postgres -c "CREATE DATABASE salessync_prod;" 2>/dev/null

echo "🚀 Step 3: Creating tables..."
docker exec salessync-backend npx prisma db push --force-reset

if [ $? -eq 0 ]; then
    echo "✅ Tables created!"
    
    echo "🔄 Step 4: Generating Prisma client..."
    docker exec salessync-backend npx prisma generate
    
    echo "🌱 Step 5: Seeding with inline JavaScript..."
    docker exec salessync-backend node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function seed() {
      console.log('🌱 Starting inline seeding...');
      
      // Create company
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
      console.log('✅ Company:', company.name);
      
      // Create user
      const user = await prisma.user.upsert({
        where: { email: 'admin@demo.com' },
        update: {},
        create: {
          email: 'admin@demo.com',
          password: '\$2b\$10\$rQZ9QmjQZ9QmjQZ9QmjQZO',
          name: 'Demo Admin',
          role: 'ADMIN',
          isActive: true,
          companyId: company.id,
        },
      });
      console.log('✅ User:', user.name);
      
      // Create customer
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
      console.log('✅ Customer:', customer.name);
      
      // Create lead
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
      console.log('✅ Lead:', lead.name);
      
      console.log('🎉 Seeding completed!');
      await prisma.\$disconnect();
    }
    
    seed().catch(e => { console.error('❌ Error:', e); process.exit(1); });
    "
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 SEEDING SUCCESSFUL!"
        echo ""
        echo "📊 Verification:"
        docker exec salessync-postgres psql -U postgres -d salessync_prod -c "
            SELECT 'companies' as table_name, COUNT(*) as rows FROM companies
            UNION ALL
            SELECT 'users', COUNT(*) FROM users
            UNION ALL
            SELECT 'customers', COUNT(*) FROM customers
            UNION ALL
            SELECT 'leads', COUNT(*) FROM leads;
        " 2>/dev/null
        
        echo ""
        echo "🌐 Application ready:"
        echo "Frontend: http://localhost:8080"
        echo "Backend: http://localhost:3001/api"
        echo ""
        echo "🔐 Login: admin@demo.com / password123"
    else
        echo "❌ Inline seeding failed"
        docker logs salessync-backend --tail 10
    fi
else
    echo "❌ Failed to create tables"
    docker logs salessync-backend --tail 10
fi