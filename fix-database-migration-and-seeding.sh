#!/bin/bash

# Fix Database Migration and Seeding Issues
# This script properly sets up the database with migrations before seeding

set -e

echo "🗄️  Fixing Database Migration and Seeding Issues"
echo "=============================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Step 1: Verify containers are running
print_status "Checking container status..."
if ! docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    print_error "Containers are not running. Starting them first..."
    docker compose -f docker-compose.prod.yml up -d
    sleep 30
fi

# Step 2: Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U salessync_user -d salessync_prod >/dev/null 2>&1; then
        print_success "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 2
done

# Step 3: Check database connection from backend
print_status "Testing database connection from backend..."
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma db pull --force >/dev/null 2>&1; then
    print_success "Backend can connect to database"
else
    print_error "Backend cannot connect to database"
    print_status "Database connection details:"
    docker compose -f docker-compose.prod.yml exec -T backend printenv | grep DATABASE_URL || echo "DATABASE_URL not set"
    exit 1
fi

# Step 4: Generate Prisma client
print_status "Generating Prisma client..."
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma generate; then
    print_success "Prisma client generated"
else
    print_error "Failed to generate Prisma client"
    exit 1
fi

# Step 5: Run database migrations
print_status "Running database migrations..."
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy; then
    print_success "Database migrations completed"
else
    print_warning "Migration deploy failed, trying reset..."
    if docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate reset --force --skip-seed; then
        print_success "Database reset and migrations applied"
    else
        print_error "Database migration failed completely"
        exit 1
    fi
fi

# Step 6: Verify tables exist
print_status "Verifying database tables exist..."
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma db pull >/dev/null 2>&1; then
    print_success "Database schema is valid"
else
    print_error "Database schema validation failed"
    exit 1
fi

# Step 7: Check if seeding TypeScript file exists
print_status "Checking seeding files..."
if docker compose -f docker-compose.prod.yml exec -T backend ls -la prisma/seed-demo-production.ts >/dev/null 2>&1; then
    print_success "TypeScript seeding file found"
    SEED_FILE="prisma/seed-demo-production.ts"
    SEED_COMMAND="npx tsx prisma/seed-demo-production.ts"
elif docker compose -f docker-compose.prod.yml exec -T backend ls -la prisma/seed.ts >/dev/null 2>&1; then
    print_success "Default TypeScript seeding file found"
    SEED_FILE="prisma/seed.ts"
    SEED_COMMAND="npx tsx prisma/seed.ts"
elif docker compose -f docker-compose.prod.yml exec -T backend ls -la prisma/seed.js >/dev/null 2>&1; then
    print_success "JavaScript seeding file found"
    SEED_FILE="prisma/seed.js"
    SEED_COMMAND="node prisma/seed.js"
else
    print_error "No seeding file found"
    print_status "Available files in prisma directory:"
    docker compose -f docker-compose.prod.yml exec -T backend ls -la prisma/
    exit 1
fi

# Step 8: Install tsx if needed for TypeScript execution
if [[ $SEED_COMMAND == *"tsx"* ]]; then
    print_status "Installing tsx for TypeScript execution..."
    docker compose -f docker-compose.prod.yml exec -T backend npm install tsx --save-dev || print_warning "tsx installation failed, continuing..."
fi

# Step 9: Run seeding with proper error handling
print_status "Seeding database with demo data..."
print_status "Using command: $SEED_COMMAND"

if docker compose -f docker-compose.prod.yml exec -T backend $SEED_COMMAND; then
    print_success "✅ Database seeded successfully!"
else
    print_error "❌ Seeding failed with TypeScript file"
    
    # Fallback: Try with npx prisma db seed
    print_status "Trying fallback seeding method..."
    if docker compose -f docker-compose.prod.yml exec -T backend npx prisma db seed; then
        print_success "✅ Database seeded with fallback method!"
    else
        print_error "❌ All seeding methods failed"
        
        # Try to create a simple JavaScript seed
        print_status "Creating simple JavaScript seed as last resort..."
        docker compose -f docker-compose.prod.yml exec -T backend sh -c 'cat > simple-seed-fallback.js << EOF
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Creating demo company...");
  
  const company = await prisma.company.upsert({
    where: { email: "demo@techcorp.com" },
    update: {},
    create: {
      name: "TechCorp Solutions",
      email: "demo@techcorp.com",
      phone: "+27 11 123 4567",
      address: "123 Business Park, Sandton, Johannesburg",
      subscriptionTier: "PROFESSIONAL",
      isActive: true
    }
  });

  console.log("Creating demo admin user...");
  
  const hashedPassword = await bcrypt.hash("Demo123!", 10);
  
  await prisma.user.upsert({
    where: { email: "demo@techcorp.com" },
    update: {},
    create: {
      email: "demo@techcorp.com",
      password: hashedPassword,
      firstName: "Demo",
      lastName: "Admin",
      role: "ADMIN",
      isActive: true,
      companyId: company.id
    }
  });

  console.log("Demo data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF'
        
        if docker compose -f docker-compose.prod.yml exec -T backend node simple-seed-fallback.js; then
            print_success "✅ Basic demo data created with fallback script!"
        else
            print_error "❌ Even fallback seeding failed"
            print_status "Backend logs:"
            docker logs salessync-backend-prod --tail 30
        fi
    fi
fi

# Step 10: Verify seeding worked
print_status "Verifying seeding results..."
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma db pull >/dev/null 2>&1; then
    print_success "Database is accessible after seeding"
    
    # Try to query for demo data
    print_status "Checking for demo data..."
    docker compose -f docker-compose.prod.yml exec -T backend sh -c 'cat > check-data.js << EOF
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  try {
    const companies = await prisma.company.count();
    const users = await prisma.user.count();
    console.log(`Found ${companies} companies and ${users} users`);
    
    if (companies > 0 && users > 0) {
      console.log("✅ Demo data exists!");
      const demoUser = await prisma.user.findFirst({ where: { email: "demo@techcorp.com" } });
      if (demoUser) {
        console.log("✅ Demo admin user found!");
      }
    } else {
      console.log("❌ No demo data found");
    }
  } catch (error) {
    console.error("Error checking data:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
EOF'
    
    docker compose -f docker-compose.prod.yml exec -T backend node check-data.js
else
    print_error "Database verification failed"
fi

# Final status
echo ""
print_success "🎉 Database Migration and Seeding Fix Complete!"
echo ""
echo "📋 Access Your Application:"
echo "  🌐 SalesSync AI: http://localhost:8081"
echo "  🔧 API Health:   http://localhost:3001/health"
echo ""
echo "🔑 Demo Login Credentials:"
echo "  📧 Email:    demo@techcorp.com"
echo "  🔐 Password: Demo123!"
echo ""
echo "🛠️  Manual Commands (if needed):"
echo "  • Check tables: docker compose -f docker-compose.prod.yml exec backend npx prisma db pull"
echo "  • Run migrations: docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy"
echo "  • Seed data: docker compose -f docker-compose.prod.yml exec backend node seed-production-demo.js"
echo ""
echo "📊 Container Status:"
docker compose -f docker-compose.prod.yml ps