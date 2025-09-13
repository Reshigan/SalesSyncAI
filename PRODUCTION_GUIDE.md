# SalesSync Production Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ (for development)
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)

### One-Click Production Deployment
```bash
# Clone the repository
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI

# Deploy to production
./scripts/deploy-production.sh --seed
```

## 🔐 Default Login Credentials

### Super Admin (Platform Owner)
- **Email**: `superadmin@salessync.com`
- **Password**: `SuperAdmin123!`
- **Access**: Full platform management, all companies

### Test Company Admin
- **Email**: `admin@testcompany.com`
- **Password**: `TestAdmin123!`
- **Company**: TestCompany
- **Access**: Full company management

### Field Agents
- **Agent 1**: `agent1@testcompany.com` / `Agent123!`
- **Agent 2**: `agent2@testcompany.com` / `Agent123!`
- **Manager**: `manager@testcompany.com` / `Manager123!`

## 🌐 Access URLs

### Development Environment
- **Frontend**: https://work-2-necpxcrvufxzrged.prod-runtime.all-hands.dev (port 12001)
- **Backend API**: https://work-1-necpxcrvufxzrged.prod-runtime.all-hands.dev (port 12000)
- **API Documentation**: https://work-1-necpxcrvufxzrged.prod-runtime.all-hands.dev/api/docs

### Production Environment (after deployment)
- **Frontend**: http://localhost (port 80)
- **Backend API**: http://localhost:3000
- **Database**: localhost:5432
- **Redis**: localhost:6379

## 📊 Sample Data Overview

The system comes pre-loaded with comprehensive sample data:

### Companies & Users
- **1 Super Admin** with platform-wide access
- **1 Test Company** with full organizational structure
- **5 User Roles**: Super Admin, Company Admin, Regional Manager, Team Leader, Field Agent

### Field Sales Data
- **50+ Customers** with complete profiles and visit history
- **100+ Products** across multiple categories
- **200+ Visits** with GPS locations, photos, and surveys
- **150+ Sales Transactions** with payment records
- **Warehouse inventory** and stock movements

### Marketing Campaigns
- **10+ Active Campaigns** with materials and assignments
- **Brand questionnaires** and survey templates
- **Street marketing** activities and customer acquisitions
- **SIM distribution** campaigns with tracking

### Analytics Data
- **Performance metrics** for all agents
- **Sales trends** and forecasting data
- **Customer behavior** analysis
- **Territory optimization** insights

## 🏗️ Architecture Overview

### Backend Services
- **Node.js/Express** API server with TypeScript
- **PostgreSQL** database with Prisma ORM
- **Redis** for caching and sessions
- **JWT** authentication with role-based access
- **AI Analytics** with mock implementations

### Frontend Applications
- **React.js** web admin interface
- **React Native** mobile app foundation
- **Responsive design** optimized for mobile

### Infrastructure
- **Docker containerization** for easy deployment
- **Multi-tenant architecture** with data isolation
- **RESTful APIs** with comprehensive documentation
- **Real-time notifications** via WebSocket

## 🔧 Configuration

### Environment Variables
Key configuration options in `.env.production`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_PASSWORD=your-secure-password

# Authentication
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# External Services
GOOGLE_MAPS_API_KEY=your-maps-key
OPENAI_API_KEY=your-openai-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-email-password
```

### Security Configuration
- **HTTPS/SSL** certificates for production
- **CORS** configuration for allowed origins
- **Rate limiting** to prevent abuse
- **Input validation** and sanitization
- **SQL injection** protection via Prisma

## 📱 Mobile App

### React Native Foundation
The mobile app foundation is included with:
- **Authentication** screens and flows
- **Offline synchronization** capabilities
- **GPS tracking** and location services
- **Camera integration** for photo capture
- **Modular architecture** for easy extension

### Building Mobile App
```bash
cd mobile-app

# Install dependencies
npm install

# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

## 🔄 Auto-Publishing

### Automatic Git Publishing
Use the auto-publish script for continuous deployment:

```bash
# Auto-commit and push all changes
./scripts/auto-publish.sh

# With custom commit message
./scripts/auto-publish.sh "Feature: Added new analytics dashboard"
```

### GitHub Integration
- **Repository**: https://github.com/Reshigan/SalesSyncAI
- **Auto-publishing** to main branch
- **Commit tracking** with co-authorship
- **Change detection** and smart commits

## 🧪 Testing

### API Testing
```bash
# Test authentication
curl -X POST http://localhost:12000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@testcompany.com","password":"TestAdmin123!"}'

# Test protected endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:12000/api/field-sales/visits
```

### Frontend Testing
- Navigate to https://work-2-necpxcrvufxzrged.prod-runtime.all-hands.dev
- Login with any of the provided credentials
- Explore the dashboard and features

## 📈 Performance Optimization

### Database Optimization
- **Indexed queries** for fast lookups
- **Connection pooling** for scalability
- **Query optimization** with Prisma
- **Caching strategy** with Redis

### Application Performance
- **Code splitting** for faster loading
- **Image optimization** and compression
- **API response caching**
- **Lazy loading** for large datasets

## 🔍 Monitoring & Logging

### Application Monitoring
- **Health check endpoints** for all services
- **Performance metrics** collection
- **Error tracking** and alerting
- **Resource usage** monitoring

### Logging Strategy
- **Structured logging** with timestamps
- **Log levels** (error, warn, info, debug)
- **Request/response** logging
- **Security event** logging

## 🛡️ Security Features

### Authentication & Authorization
- **Multi-factor authentication** support
- **Role-based access control** (RBAC)
- **JWT token** management
- **Session security** and timeout

### Data Protection
- **Encryption at rest** and in transit
- **PII data** protection
- **GDPR compliance** features
- **Audit trail** for all actions

### Fraud Detection
- **GPS location** verification
- **Photo authenticity** checking
- **Behavioral pattern** analysis
- **Real-time monitoring** and alerts

## 🚀 Scaling & Deployment

### Horizontal Scaling
- **Load balancer** configuration
- **Database replication** setup
- **Redis clustering** for cache
- **Container orchestration** with Docker Swarm/Kubernetes

### Production Deployment
```bash
# Production deployment with SSL
./scripts/deploy-production.sh

# Scale specific services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Monitor deployment
docker-compose -f docker-compose.prod.yml logs -f
```

## 📞 Support & Maintenance

### Backup Strategy
- **Automated database backups** daily
- **File storage backups** to S3
- **Configuration backups**
- **Disaster recovery** procedures

### Update Procedures
- **Rolling updates** with zero downtime
- **Database migrations** with rollback
- **Feature flags** for gradual rollout
- **Health checks** during updates

## 🎯 Next Steps

### Immediate Actions
1. **Change default passwords** in production
2. **Configure SSL certificates** for HTTPS
3. **Set up monitoring** and alerting
4. **Configure backup** procedures
5. **Test disaster recovery** plans

### Feature Enhancements
1. **Complete mobile app** development
2. **Advanced AI analytics** with TensorFlow
3. **Real-time collaboration** features
4. **Advanced reporting** and dashboards
5. **Third-party integrations** (ERP, CRM)

### Production Readiness
1. **Load testing** and optimization
2. **Security audit** and penetration testing
3. **Compliance certification** (SOC2, ISO27001)
4. **Documentation** and training materials
5. **Support processes** and procedures

---

## 📋 Quick Reference

### Useful Commands
```bash
# View logs
docker-compose logs -f [service]

# Restart service
docker-compose restart [service]

# Database backup
docker exec postgres pg_dump -U user db > backup.sql

# Database restore
docker exec -i postgres psql -U user db < backup.sql

# Check service health
curl http://localhost:3000/health
```

### API Endpoints
- `POST /api/auth/login` - User authentication
- `GET /api/field-sales/visits` - Get visits
- `GET /api/field-marketing/campaigns` - Get campaigns
- `GET /api/promotions/activations` - Get activations
- `GET /api/ai-analytics/insights` - Get AI insights

### Database Schema
- **Companies** - Multi-tenant organization data
- **Users** - Authentication and role management
- **Customers** - Customer profiles and information
- **Products** - Product catalog and inventory
- **Visits** - Field visit records and activities
- **Campaigns** - Marketing campaign management
- **Analytics** - Performance and insights data

---

**SalesSync** - Sync Your Success in the Field 🚀