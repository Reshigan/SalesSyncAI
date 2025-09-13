# SalesSync Platform - Login Credentials

## 🚀 Platform Access

**Backend API**: https://work-1-necpxcrvufxzrged.prod-runtime.all-hands.dev (Port 12000)
**Frontend Web**: https://work-2-necpxcrvufxzrged.prod-runtime.all-hands.dev (Port 12001)

## 👤 User Accounts

### Super Admin (Platform Owner)
- **Email**: `superadmin@salessync.com`
- **Password**: `SuperAdmin123!`
- **Role**: SUPER_ADMIN
- **Permissions**: All platform permissions
- **Company**: SalesSync Platform
- **Description**: Full platform access, can manage all tenants

### TestCompany Ltd - Demo Company

#### Company Admin
- **Email**: `admin@testcompany.com`
- **Password**: `TestAdmin123!`
- **Role**: COMPANY_ADMIN
- **Permissions**: MANAGE_USERS, MANAGE_CAMPAIGNS, VIEW_REPORTS, MANAGE_SETTINGS
- **Company**: TestCompany Ltd
- **Description**: Full company management access

#### Regional Manager
- **Email**: `manager@testcompany.com`
- **Password**: `Manager123!`
- **Role**: REGIONAL_MANAGER
- **Permissions**: MANAGE_TEAM, VIEW_REPORTS, APPROVE_REQUESTS
- **Company**: TestCompany Ltd
- **Description**: Regional team management

#### Field Sales Agent
- **Email**: `sales.agent@testcompany.com`
- **Password**: `Agent123!`
- **Role**: AGENT
- **Permissions**: FIELD_SALES, CUSTOMER_VISITS, STOCK_MANAGEMENT
- **Company**: TestCompany Ltd
- **Description**: Field sales operations, DSD, customer visits

#### Field Marketing Agent
- **Email**: `marketing.agent@testcompany.com`
- **Password**: `Agent123!`
- **Role**: AGENT
- **Permissions**: FIELD_MARKETING, BRAND_CAMPAIGNS, SURVEYS
- **Company**: TestCompany Ltd
- **Description**: Brand campaigns, customer surveys, street marketing

#### Promoter
- **Email**: `promoter@testcompany.com`
- **Password**: `Agent123!`
- **Role**: AGENT
- **Permissions**: PROMOTIONS, ACTIVATIONS, EVENT_MANAGEMENT
- **Company**: TestCompany Ltd
- **Description**: Campaign activations, event management

## 🔧 API Testing

### Login Example
```bash
curl -X POST http://localhost:12000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@salessync.com","password":"SuperAdmin123!"}'
```

### Health Check
```bash
curl http://localhost:12000/health
```

## 📊 Sample Data

The database is pre-populated with:
- ✅ 2 Companies (SalesSync Platform + TestCompany Ltd)
- ✅ 6 Users with different roles
- ✅ 50+ Customers with realistic data
- ✅ 100+ Products across categories
- ✅ 200+ Customer visits with GPS data
- ✅ 150+ Sales transactions
- ✅ 10+ Marketing campaigns
- ✅ 20+ Brand activations
- ✅ Survey responses and analytics data
- ✅ Cash reconciliation records
- ✅ Stock movements and inventory data

## 🎯 Key Features Implemented

### ✅ Core Infrastructure
- Multi-tenant authentication with JWT
- Role-based access control (RBAC)
- PostgreSQL database with Prisma ORM
- Redis caching layer
- Docker containerization

### ✅ Field Sales Module
- Customer visit management with GPS tracking
- Stock management and warehouse operations
- Cash reconciliation and payment processing
- Route optimization and planning
- Survey execution and data collection

### ✅ Field Marketing Module
- Brand campaign management
- Customer interaction tracking
- Survey system with conditional logic
- Material placement monitoring
- Street marketing and lead generation

### ✅ Promotions & Activations
- Campaign activation scheduling
- GPS-based location verification
- Performance tracking and analytics
- Commission calculation
- Event management workflows

### ✅ AI Analytics (Partially Implemented)
- Image analysis for brand recognition
- Share-of-voice calculations
- Performance insights generation
- Predictive analytics framework
- *Note: TensorFlow.js integration temporarily disabled due to startup issues*

### ✅ Web Admin Interface
- React.js frontend with modern UI
- Authentication and authorization
- Dashboard with key metrics
- User management interface
- Campaign management tools

### ✅ Mobile App Foundation
- React Native cross-platform app
- Offline-first architecture
- GPS tracking and location services
- Camera integration for photo capture
- Sync management for offline data

## 🔒 Security Features

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Role-based permission system
- Multi-tenant data isolation
- API rate limiting and validation
- Comprehensive audit logging

## 📱 Mobile App Access

The React Native mobile app is set up in `/mobile-app` directory with:
- Authentication screens
- Field sales workflows
- Marketing campaign execution
- Offline data synchronization
- GPS tracking and photo capture

To run the mobile app:
```bash
cd mobile-app
npm install
npx react-native run-android  # or run-ios
```

## 🚀 Deployment Status

- ✅ Backend API running on port 12000
- ✅ Frontend web app running on port 12001
- ✅ Database migrations applied
- ✅ Sample data seeded
- ✅ All authentication working
- ✅ Core API endpoints functional
- ✅ GitHub repository published

## 📝 Next Steps

1. **Resolve TensorFlow.js Integration**: Fix AI analytics module startup issues
2. **Complete Fraud Detection**: Implement comprehensive fraud monitoring
3. **Enhanced Reporting**: Build advanced analytics dashboards
4. **Mobile App Testing**: Complete mobile app development and testing
5. **Production Deployment**: Set up CI/CD and production infrastructure

---

**Repository**: https://github.com/Reshigan/SalesSyncAI
**Status**: ✅ Fully Functional Demo Platform
**Last Updated**: 2025-09-13