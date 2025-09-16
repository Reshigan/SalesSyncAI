# 🚀 Production Deployment Commands

## ✅ GitHub Status: MERGED
Pull Request #13 has been successfully merged into main branch.

## 🔧 SSH into Production Server
```bash
ssh ubuntu@13.246.34.207
```

## 📋 Complete Deployment Commands

Copy and paste these commands one by one on the production server:

### Step 1: Navigate to Project Directory
```bash
cd /home/ubuntu/SalesSyncAI
```

### Step 2: Pull Latest Changes
```bash
git fetch origin
git checkout main
git pull origin main
```

### Step 3: Backup Current Configuration
```bash
cp backend/prisma/schema.prisma backend/prisma/schema-backup-$(date +%Y%m%d-%H%M%S).prisma
cp backend/src/api/auth/controller.ts backend/src/api/auth/controller-backup-$(date +%Y%m%d-%H%M%S).ts
```

### Step 4: Deploy Simple Schema
```bash
cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma
echo "✅ Schema updated to simple version"
```

### Step 5: Deploy Simplified Auth Controller
```bash
cp backend/src/api/auth/controller-simple.ts backend/src/api/auth/controller.ts
echo "✅ Auth controller updated"
```

### Step 6: Install Backend Dependencies
```bash
cd backend
npm install
echo "✅ Backend dependencies installed"
```

### Step 7: Generate Prisma Client
```bash
npx prisma generate
echo "✅ Prisma client generated"
```

### Step 8: Reset Database with New Schema
```bash
npx prisma db push --force-reset --accept-data-loss
echo "✅ Database reset with new schema"
```

### Step 9: Seed Database with Demo Users
```bash
npx prisma db seed
echo "✅ Database seeded with demo users"
```

### Step 10: Build Frontend with New UI
```bash
cd ../frontend
npm install
npm run build
echo "✅ Frontend built with new edgy UI"
```

### Step 11: Restart Backend Service
```bash
cd ..
pm2 stop backend
pm2 start ecosystem.config.js --only backend
echo "✅ Backend service restarted"
```

### Step 12: Restart Nginx
```bash
sudo systemctl reload nginx
echo "✅ Nginx reloaded"
```

### Step 13: Test the Deployment
```bash
echo "Testing backend health..."
curl -s http://localhost:3001/health

echo "Testing API health..."
curl -s http://localhost:3001/api/health

echo "Testing login endpoint..."
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@salessync.com", "password": "admin123"}'
```

### Step 14: Check Service Status
```bash
pm2 status
pm2 logs backend --lines 10
sudo systemctl status nginx
```

## 🔑 Demo Users Available After Seeding

| Email | Password | Role |
|-------|----------|------|
| admin@salessync.com | admin123 | ADMIN |
| manager@salessync.com | manager123 | MANAGER |
| sales@salessync.com | sales123 | SALES_REP |
| field@salessync.com | field123 | FIELD_REP |

## 🎯 Expected Results

After running all commands:
- ✅ **Login endpoint fully functional**
- ✅ **All demo users can authenticate**
- ✅ **JWT tokens generated correctly**
- ✅ **Modern edgy UI with dark orange theme**
- ✅ **Production website fully operational at https://ss.gonxt.tech**

## 🚀 One-Liner Deployment (Alternative)

If you prefer to run everything at once:

```bash
cd /home/ubuntu/SalesSyncAI && \
git pull origin main && \
cp backend/prisma/schema-simple.prisma backend/prisma/schema.prisma && \
cp backend/src/api/auth/controller-simple.ts backend/src/api/auth/controller.ts && \
cd backend && npm install && npx prisma generate && \
npx prisma db push --force-reset --accept-data-loss && \
npx prisma db seed && \
cd ../frontend && npm install && npm run build && \
cd .. && pm2 restart backend && \
sudo systemctl reload nginx && \
echo "🎉 DEPLOYMENT COMPLETED!"
```

## 🔍 Troubleshooting

If any issues occur:

### Check Backend Logs
```bash
pm2 logs backend
```

### Check Database Connection
```bash
psql -h localhost -U salessync -d salessync -c "SELECT email, role FROM users;"
```

### Check Service Status
```bash
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
```

### Restart Services if Needed
```bash
pm2 restart backend
sudo systemctl restart nginx
sudo systemctl restart postgresql
```

## 📊 Verification Commands

Test all endpoints:
```bash
# Health check
curl https://ss.gonxt.tech/health

# API health
curl https://ss.gonxt.tech/api/health

# Login test
curl -X POST https://ss.gonxt.tech/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@salessync.com", "password": "admin123"}'
```

## 🎉 Success Indicators

You'll know the deployment is successful when:
1. All curl commands return successful responses
2. PM2 shows backend service as "online"
3. Nginx status shows "active (running)"
4. Website loads at https://ss.gonxt.tech
5. Login works with demo credentials

---

**🚨 IMPORTANT**: The database will be reset during this deployment, removing any existing data. The seeding process will create fresh demo data including users, customers, leads, visits, and sales records.