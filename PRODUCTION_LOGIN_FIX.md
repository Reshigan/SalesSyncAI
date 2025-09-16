# 🚨 URGENT: Production Login Fix Guide

## Problem Identified
The production login is failing because:
1. **Schema Mismatch**: Backend code expects complex schema with Company relationships, but production database uses simple schema
2. **No Users**: Database likely has no seeded users
3. **Wrong Auth Controller**: Current auth controller tries to access `user.company` which doesn't exist in simple schema

## ✅ Complete Solution

### Step 1: Connect to Production Server
```bash
ssh ubuntu@13.246.34.207
cd /home/ubuntu/SalesSyncAI
```

### Step 2: Backup Current State
```bash
# Backup current schema
cp backend/prisma/schema.prisma backend/prisma/schema-backup-$(date +%Y%m%d-%H%M%S).prisma

# Backup current auth controller
cp backend/src/api/auth/controller.ts backend/src/api/auth/controller-backup.ts
```

### Step 3: Deploy Simple Schema
```bash
# Copy the working simple schema
cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma
```

### Step 4: Deploy Simple Auth Controller
```bash
# Replace the auth controller with the simple version
cp backend/src/api/auth/controller-simple.ts backend/src/api/auth/controller.ts
```

### Step 5: Update Dependencies and Generate Prisma Client
```bash
cd backend
npm install
npx prisma generate
```

### Step 6: Reset Database with New Schema
```bash
# This will reset the database and apply the simple schema
npx prisma db push --force-reset --accept-data-loss
```

### Step 7: Seed Database with Demo Users
```bash
# Run the seeding script
npx prisma db seed
```

### Step 8: Restart Backend Service
```bash
# Stop and restart the backend
pm2 stop backend
pm2 start ecosystem.config.js --only backend
```

### Step 9: Update Frontend (Optional)
```bash
cd ../frontend
npm run build
sudo systemctl restart nginx
```

### Step 10: Test the Fix
```bash
# Test login endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@salessync.com", "password": "admin123"}'

# Test from external
curl -X POST https://ss.gonxt.tech/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@salessync.com", "password": "admin123"}'
```

## 🔑 Demo Users Created
After seeding, these users will be available:

| Email | Password | Role |
|-------|----------|------|
| admin@salessync.com | admin123 | ADMIN |
| manager@salessync.com | manager123 | MANAGER |
| sales@salessync.com | sales123 | SALES_REP |
| field@salessync.com | field123 | FIELD_REP |

## 🔍 Troubleshooting

### If login still fails:
```bash
# Check backend logs
pm2 logs backend

# Check database users
psql -h localhost -U salessync -d salessync -c "SELECT email, role FROM users;"

# Check backend status
pm2 status

# Check nginx status
sudo systemctl status nginx
```

### If database connection fails:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
psql -h localhost -U salessync -d salessync -c "SELECT 1;"
```

### If Prisma client issues:
```bash
cd backend
rm -rf node_modules/.prisma
npx prisma generate
pm2 restart backend
```

## 📋 Files Changed
- `backend/prisma/schema.prisma` → Simple schema (6 tables)
- `backend/src/api/auth/controller.ts` → Simplified auth controller
- Database → Reset and seeded with demo users

## 🎯 Expected Result
After following this guide:
- ✅ Login endpoint works: `POST /api/auth/login`
- ✅ All 4 demo users can login successfully
- ✅ JWT tokens are generated correctly
- ✅ Frontend can authenticate users
- ✅ Website fully functional at https://ss.gonxt.tech

## 🚀 Quick One-Liner Fix
If you want to run all commands at once:
```bash
cd /home/ubuntu/SalesSyncAI && \
cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma && \
cp backend/src/api/auth/controller-simple.ts backend/src/api/auth/controller.ts && \
cd backend && \
npm install && \
npx prisma generate && \
npx prisma db push --force-reset --accept-data-loss && \
npx prisma db seed && \
pm2 restart backend && \
echo "✅ Production login fix completed!"
```

## 📞 Support
If issues persist, check:
1. PM2 logs: `pm2 logs backend`
2. Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*.log`