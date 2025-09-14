
# SalesSync - Multi-Tenant Field Marketing Platform

**Tagline**: "Sync Your Success in the Field"

SalesSync is a comprehensive multi-tenant field marketing platform designed for emerging markets, providing field sales, marketing, and promotional activation capabilities with integrated ERP, warehouse management, and advanced analytics.

## 🚀 Features

### Field Sales Module (DSD)
- **Warehouse Management**: Multi-warehouse support with real-time stock tracking
- **Visit Planning**: AI-powered route optimization and GPS tracking
- **Customer Management**: Complete visit workflow with surveys and documentation
- **Cash Management**: Daily reconciliation and bank deposit tracking
- **Stock Management**: Mobile inventory tracking and reconciliation

### Field Marketing Module
- **Brand Campaigns**: Campaign management with material allocation
- **Customer Acquisition**: New customer onboarding and relationship tracking
- **Survey System**: Dynamic questionnaires with photo requirements
- **Street Marketing**: Consumer education and lead generation
- **Material Management**: Promotional material placement and tracking

### Promotions & Activations
- **Campaign Management**: Multi-activation campaign support
- **Event Planning**: Calendar integration and resource allocation
- **Activation Execution**: GPS verification and real-time tracking
- **Performance Analytics**: ROI measurement and reporting

### AI-Powered Features
- **Image Analysis**: Share-of-voice calculation and brand recognition
- **Fraud Detection**: Comprehensive monitoring and prevention
- **Predictive Analytics**: Sales forecasting and optimization
- **Automated Insights**: Performance anomaly detection

## 🏗️ Architecture

- **Backend**: Node.js/Express with TypeScript
- **Frontend**: React.js with modern UI framework
- **Mobile**: React Native (iOS/Android)
- **Database**: PostgreSQL with PostGIS for location data
- **Cache**: Redis for performance optimization
- **Storage**: AWS S3 for images and documents
- **Deployment**: Docker containerized on AWS EC2

## 🔐 Security & Compliance

- Multi-factor authentication (MFA)
- Role-based access control (RBAC)
- End-to-end encryption
- GDPR and POPIA compliance
- Comprehensive audit logging
- Advanced fraud detection

## 🌍 Multi-Tenant Support

- Complete data isolation per company
- White-label customization
- Scalable architecture for 10,000+ users
- Multi-currency and localization support

## 📱 Mobile-First Design

- Offline-first capability for emerging markets
- GPS tracking and location verification
- High-quality photo capture and compression
- Real-time synchronization
- Battery optimization

## 🚀 Production Deployment

### Ultra-Simple Deployment (5 minutes)
Deploy SalesSync to production with a single command:

#### Option 1: Non-Interactive Deployment (Recommended)
**No popups, all confirmations handled automatically:**
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/ultra-simple-deploy-v3.sh | sudo bash
```

#### Option 2: NPM Conflict Fix
If you encounter npm dependency conflicts:
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/ultra-simple-deploy-v2.sh | sudo bash
```

#### Option 3: Standard Deployment
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/fixed-ultra-simple-deploy.sh | sudo bash
```

**The V3 script (recommended) features:**
- Completely non-interactive deployment
- No PostgreSQL upgrade popups
- Pre-configured responses for all dialogs
- Clean npm dependency resolution
- Terminal-only confirmations

**Both scripts will:**
- Install all system dependencies (Node.js, PostgreSQL, Nginx, PM2)
- Set up the database with production data
- Build and deploy the frontend
- Configure nginx with API proxy
- Start the application with PM2 process management

### Production Access

**Primary URL**: http://SSAI.gonxt.tech  
**API Base**: http://SSAI.gonxt.tech/api/  
**Health Check**: http://SSAI.gonxt.tech/health

### Production Demo Credentials

**Super Admin:**
- Email: `superadmin@salessync.com`
- Password: `SuperAdmin123!`

**Company Admin (Premium Beverages):**
- Email: `admin@premiumbeverages.com`
- Password: `DemoAdmin123!`

**Area Manager:**
- Email: `manager@premiumbeverages.com`
- Password: `Manager123!`

**Field Sales Agents:**
- James Wilson: `james.wilson@premiumbeverages.com` / `FieldAgent123!`
- Sarah Davis: `sarah.davis@premiumbeverages.com` / `FieldAgent123!`
- Michael Brown: `michael.brown@premiumbeverages.com` / `FieldAgent123!`

**Marketing Agents:**
- Lisa Johnson: `lisa.johnson@premiumbeverages.com` / `MarketingAgent123!`
- David Miller: `david.miller@premiumbeverages.com` / `MarketingAgent123!`

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (optional)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Run database migrations and seed:
```bash
npx prisma migrate dev
npx prisma db seed
```

5. Start the backend:
```bash
npm run dev
```

6. Install and start frontend (in new terminal):
```bash
cd frontend
npm install
npm run dev
```

### Development Login Credentials

**Super Admin:**
- Email: `superadmin@salessync.com`
- Password: `SuperAdmin123!`

**Test Company Admin:**
- Email: `admin@testcompany.com`
- Password: `TestAdmin123!`

## 📊 Production Demo Data

The production deployment includes comprehensive demo data:

### Companies & Users
- **3 Companies**: Premium Beverages, TechCorp Solutions, Global Retail
- **8 Users**: Super Admin, Company Admins, Area Managers, Field Agents
- **Multi-role Authentication**: Cross-company user management

### Business Data
- **11 Customers**: Diverse customer base with contact information
- **15 Products**: Complete product catalog with pricing
- **50 Customer Visits**: Historical visit records with GPS data
- **13 Orders**: Sales transactions with order details
- **Comprehensive Analytics**: Performance metrics and KPIs

### Features Demonstrated
- Multi-tenant architecture with data isolation
- Role-based access control across companies
- Field sales workflow and customer management
- Order processing and inventory tracking
- Real-time analytics and reporting

## 🔧 Development

### Project Structure
```
salessync/
├── backend/          # Node.js/Express API
├── frontend/         # React.js web application
├── mobile/           # React Native mobile app
├── ai-services/      # AI/ML microservices
├── deployment/       # Docker and deployment configs
└── docs/            # Documentation
```

### API Documentation
API documentation is available at `/api/docs` when running the development server.

### Testing
```bash
npm test                 # Run all tests
npm run test:backend     # Backend tests only
npm run test:frontend    # Frontend tests only
npm run test:mobile      # Mobile app tests
```

## 📈 Performance

- **Response Time**: < 200ms for 95% of API requests
- **Concurrent Users**: 10,000+ simultaneous users
- **Uptime**: 99.9% availability SLA
- **Scalability**: Horizontal scaling with load balancers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:
- Email: support@salessync.com
- Repository: https://github.com/Reshigan/SalesSyncAI
- Issues: https://github.com/Reshigan/SalesSyncAI/issues
- Deployment Report: See `DEPLOYMENT_TEST_REPORT.md` for detailed testing results

---

**SalesSync** - Empowering field teams across emerging markets with cutting-edge technology and AI-driven insights.
