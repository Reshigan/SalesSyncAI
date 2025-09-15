# SalesSync AI - Demo Credentials & Test Data

## Overview
This document contains the demo login credentials and test data for production demonstrations of SalesSync AI.

## Demo Company
**Company Name:** TechCorp Solutions  
**Industry:** Technology & Electronics  
**Subscription Tier:** Professional  

## Login Credentials

### 🔑 Admin Account (Full Access)
- **Email:** `demo@techcorp.com`
- **Password:** `Demo123!`
- **Role:** Company Admin
- **Permissions:** Full system access, user management, settings, reports
- **Use Case:** Demonstrate admin features, user management, system configuration

### 🔑 Manager Account (Management Access)
- **Email:** `manager@techcorp.com`
- **Password:** `Manager123!`
- **Role:** Area Manager
- **Permissions:** Team management, reports, campaign management, order approval
- **Use Case:** Demonstrate management dashboards, team oversight, reporting features

### 🔑 Field Agent Accounts (Field Access)

#### Agent 1 - John Agent
- **Email:** `agent1@techcorp.com`
- **Password:** `Agent123!`
- **Role:** Field Sales Agent
- **Territory:** Sandton, Randburg, Fourways
- **Use Case:** Demonstrate field sales features, visit management, customer interactions

#### Agent 2 - Lisa Sales
- **Email:** `agent2@techcorp.com`
- **Password:** `Agent123!`
- **Role:** Field Sales Agent
- **Territory:** Roodepoort, Soweto, Lenasia
- **Use Case:** Demonstrate mobile app features, offline capabilities

#### Agent 3 - Mike Field
- **Email:** `agent3@techcorp.com`
- **Password:** `Agent123!`
- **Role:** Field Sales Agent
- **Territory:** Cape Town CBD, Bellville, Parow
- **Use Case:** Demonstrate regional operations, territory management

## Demo Data Summary

### 📦 Products (16 items)
- **Laptops:** TechBook Pro 15", TechBook Air 13", TechBook Gaming 17", TechBook Student 14"
- **Smartphones:** TechPhone Pro Max, TechPhone Standard, TechPhone Lite
- **Accessories:** Wireless Earbuds Pro, Fast Charger 65W, Laptop Stand, Bluetooth Mouse
- **Software:** Office Suite Pro, Antivirus Premium, Design Software License

### 🏢 Customers (8 companies)
- **Corporate:** ABC Corporation, XYZ Holdings, Tech Innovations Ltd
- **Retail:** TechZone Sandton, Digital World Rosebank, Gadget Galaxy Cape Town
- **Educational:** University of Johannesburg, Wits Business School

### 📊 Sample Data
- **25 Visits** - Mix of completed, in-progress, and planned visits
- **15 Sales Orders** - Recent orders with various products and customers
- **1 Active Campaign** - Q4 Tech Promotion 2024

## Demo Scenarios

### 🎯 Scenario 1: Admin Dashboard Demo
1. Login as `demo@techcorp.com`
2. Show company overview and KPI dashboard
3. Demonstrate user management features
4. Review sales reports and analytics
5. Configure system settings

### 🎯 Scenario 2: Manager Operations Demo
1. Login as `manager@techcorp.com`
2. Review team performance dashboard
3. Analyze territory performance
4. Approve pending orders
5. Monitor field agent activities

### 🎯 Scenario 3: Field Agent Mobile Demo
1. Login as `agent1@techcorp.com`
2. View assigned customers and territories
3. Plan and execute customer visits
4. Create sales orders
5. Update customer information
6. Sync data and view reports

### 🎯 Scenario 4: Sales Process Demo
1. Start as field agent planning visits
2. Execute customer visit with photos/notes
3. Create sales order during visit
4. Show manager approval workflow
5. Demonstrate reporting and analytics

## Setting Up Demo Data

### Method 1: Using Docker (Recommended)
```bash
# Access the backend container
docker exec -it salessync-backend-prod bash

# Run the demo seed script
node seed-production-demo.js
```

### Method 2: Direct Database Seeding
```bash
# Navigate to backend directory
cd backend

# Install dependencies if needed
npm install

# Generate Prisma client
npx prisma generate

# Run the demo seed
npx tsx prisma/seed-demo-production.ts
```

### Method 3: Using Package Script
```bash
# Add to package.json scripts:
"seed:demo": "tsx prisma/seed-demo-production.ts"

# Then run:
npm run seed:demo
```

## Demo Tips

### 🎨 Visual Demo Points
- **Dashboard Analytics:** Show real-time KPIs and charts
- **Mobile Responsiveness:** Demonstrate on different screen sizes
- **Offline Capabilities:** Show field agent offline functionality
- **Real-time Sync:** Demonstrate data synchronization
- **Role-based Access:** Switch between different user roles

### 📱 Mobile App Demo
- Use agent credentials on mobile device
- Show GPS tracking during visits
- Demonstrate photo capture for visits
- Show offline order creation
- Display sync status and data updates

### 🔄 Data Refresh
To refresh demo data:
```bash
# Clear existing demo data
npx prisma db push --force-reset

# Re-run migrations
npx prisma migrate deploy

# Seed fresh demo data
node seed-production-demo.js
```

## Security Notes

### ⚠️ Production Considerations
- These are **DEMO CREDENTIALS ONLY**
- Change all passwords before actual production use
- Remove demo data before real customer deployment
- Use strong, unique passwords for production accounts
- Enable two-factor authentication for admin accounts

### 🔒 Password Policy
Demo passwords follow the pattern:
- Minimum 8 characters
- Contains uppercase and lowercase letters
- Contains numbers
- Contains special characters
- Easy to remember for demonstrations

## Troubleshooting

### Common Issues
1. **Database Connection Error**
   - Check DATABASE_URL environment variable
   - Ensure PostgreSQL is running
   - Verify database credentials

2. **Prisma Client Error**
   - Run `npx prisma generate`
   - Check Prisma schema is up to date
   - Verify database migrations are applied

3. **Seeding Fails**
   - Check for existing data conflicts
   - Verify all required fields are provided
   - Check database permissions

### Support Commands
```bash
# Check database status
npx prisma db pull

# View current data
npx prisma studio

# Reset database (CAUTION: Deletes all data)
npx prisma db push --force-reset

# Apply migrations
npx prisma migrate deploy
```

---

## Quick Reference Card

**🏢 Company:** TechCorp Solutions  
**🔑 Admin:** demo@techcorp.com / Demo123!  
**👨‍💼 Manager:** manager@techcorp.com / Manager123!  
**👨‍💻 Agent:** agent1@techcorp.com / Agent123!  

**📊 Demo includes:** 16 products, 8 customers, 25 visits, 15 sales orders  
**🎯 Perfect for:** Sales demos, feature showcases, client presentations  

---
*Last updated: 2025-09-15*  
*Version: 1.0*