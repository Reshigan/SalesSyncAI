# Quick Fix Commands for Production Seeding Error

## Problem
Production server shows: `❌ Seed error: PrismaClientValidationError: Unknown argument 'description'`

## Root Cause
Server is trying to use Company model that doesn't exist in current simple schema.

## One-Line Fix (Copy & Paste)

SSH to your production server and run these commands:

```bash
# SSH to production server
ssh ubuntu@13.246.34.207

# Navigate to backend directory and fix schema
cd /home/ubuntu/SalesSyncAI/backend && \
cp prisma/schema-simple.prisma prisma/schema.prisma && \
npx prisma generate && \
npx ts-node prisma/seed-production-simple.ts

# Verify fix worked
psql -h localhost -U salessync -d salessync -c "SELECT COUNT(*) as users FROM users;"
```

## Alternative: Step by Step

```bash
# 1. SSH to server
ssh ubuntu@13.246.34.207

# 2. Go to backend directory
cd /home/ubuntu/SalesSyncAI/backend

# 3. Check current schema (should show simple models only)
grep "^model " prisma/schema.prisma

# 4. If you see Company model, switch to simple schema
cp prisma/schema-simple.prisma prisma/schema.prisma

# 5. Regenerate Prisma client
npx prisma generate

# 6. Run seeding with simple schema
npx ts-node prisma/seed-production-simple.ts

# 7. Verify users were created
psql -h localhost -U salessync -d salessync -c "SELECT email, role FROM users LIMIT 5;"
```

## Expected Success Output

```
🌱 Starting production database seeding (simple schema)...
✅ Users created successfully
✅ Customers created successfully  
✅ Leads created successfully
✅ Visits created successfully
✅ Sales created successfully
🎉 Production database seeding completed successfully!
```

## Login Credentials After Fix

- **Super Admin**: admin@salessync.com / admin123
- **Company Admin**: admin@premiumbeverages.com / admin123  
- **Area Manager**: manager@premiumbeverages.com / manager123
- **Field Agent**: agent@premiumbeverages.com / agent123

## If Fix Doesn't Work

1. Check if schema-simple.prisma exists: `ls -la prisma/schema*.prisma`
2. Check current database schema: `npx prisma db pull --print`
3. Check for running processes: `ps aux | grep node`
4. Check backend logs: `tail -20 logs/backend.log`

The fix ensures the production server uses the correct simple schema that matches your current codebase.