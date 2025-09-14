# SalesSync - Production Deployment Guide

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI
```

### 2. Environment Setup
```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Update environment variables as needed
```

### 3. One-Command Deployment
```bash
# Start all services
docker-compose up -d

# Initialize database
cd backend && npm run db:migrate && npm run db:seed
```

### 4. Access System
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Admin Panel**: http://localhost:3000/admin

## Production Deployment

### AWS EC2 Deployment
```bash
# Run the automated deployment script
./deployment/deploy-production.sh

# Or use Docker Compose for production
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables
```bash
# Backend (.env)
DATABASE_URL="postgresql://user:password@localhost:5432/salessync"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_S3_BUCKET="your-s3-bucket"

# Frontend (.env)
REACT_APP_API_URL="https://api.yourdomain.com"
REACT_APP_ENVIRONMENT="production"
```

## User Accounts

### Super Admin Access
- **Email**: superadmin@salessync.com
- **Password**: SuperAdmin123!
- **Role**: Platform administrator with full system access

### Test Company Demo Accounts
- **Company Admin**: admin@testcompany.com / TestAdmin123!
- **Field Agent**: agent1@testcompany.com / Agent123!
- **Manager**: manager@testcompany.com / Manager123!
- **Promoter**: promoter@testcompany.com / Promoter123!

## API Documentation

### Authentication
```bash
# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

# Response
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "user": { ... }
  }
}
```

### Field Sales Endpoints
```bash
GET /api/field-sales/visits          # Get visits
GET /api/field-sales/customers       # Get customers
GET /api/field-sales/warehouse       # Get warehouse data
POST /api/field-sales/visits         # Create visit
```

### Field Marketing Endpoints
```bash
GET /api/field-marketing/campaigns   # Get campaigns
GET /api/field-marketing/surveys     # Get surveys
POST /api/field-marketing/campaigns  # Create campaign
```

### Promotions Endpoints
```bash
GET /api/promotions/activations      # Get activations
GET /api/promotions/campaigns        # Get promotion campaigns
POST /api/promotions/activations     # Create activation
```

### Reporting Endpoints
```bash
GET /api/reporting/dashboard         # Dashboard metrics
GET /api/reporting/sales            # Sales reports
GET /api/reporting/visits           # Visits reports
GET /api/reporting/agents           # Agent performance
```

## Database Schema

### Key Tables
- **companies**: Multi-tenant company data
- **users**: All system users with roles
- **customers**: Customer information
- **products**: Product catalog
- **visits**: Field visit records
- **sales**: Sales transactions
- **campaigns**: Marketing campaigns
- **activations**: Promotional activations

### Sample Data
The system includes comprehensive sample data:
- 2 Companies (SalesSync + TestCompany)
- 5 Users across all roles
- 10 Sample customers
- 5 Products in catalog
- Historical visits and sales data

## Mobile App

### React Native Setup
```bash
cd mobile-app
npm install

# iOS
cd ios && pod install
npx react-native run-ios

# Android
npx react-native run-android
```

### Key Features
- Offline-first architecture
- GPS tracking and validation
- Camera integration for photos
- Survey completion system
- Real-time sync with backend

## Monitoring & Maintenance

### Health Checks
```bash
# Backend health
curl http://localhost:5000/health

# Database connection
curl http://localhost:5000/api/health/db

# Redis connection
curl http://localhost:5000/api/health/redis
```

### Logs
```bash
# View application logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres
```

### Backup
```bash
# Database backup
docker exec postgres pg_dump -U salessync salessync > backup.sql

# Restore database
docker exec -i postgres psql -U salessync salessync < backup.sql
```

## Security Configuration

### SSL/TLS Setup
```bash
# Generate SSL certificates
./deployment/generate-ssl.sh

# Configure Nginx with SSL
cp deployment/nginx-ssl.conf /etc/nginx/sites-available/salessync
```

### Firewall Rules
```bash
# Allow HTTP/HTTPS
ufw allow 80
ufw allow 443

# Allow SSH
ufw allow 22

# Database (internal only)
ufw allow from 10.0.0.0/8 to any port 5432
```

## Performance Optimization

### Database Optimization
```sql
-- Create indexes for performance
CREATE INDEX idx_visits_agent_date ON visits(agent_id, created_at);
CREATE INDEX idx_sales_company_date ON sales(company_id, created_at);
CREATE INDEX idx_users_company_role ON users(company_id, role);
```

### Caching Strategy
- Redis for session storage
- API response caching
- Static asset caching with CDN
- Database query result caching

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   docker-compose ps postgres
   
   # Restart database
   docker-compose restart postgres
   ```

2. **Redis Connection Failed**
   ```bash
   # Check Redis status
   docker-compose ps redis
   
   # Clear Redis cache
   docker exec redis redis-cli FLUSHALL
   ```

3. **JWT Token Issues**
   ```bash
   # Verify JWT_SECRET is set
   echo $JWT_SECRET
   
   # Regenerate tokens
   npm run auth:refresh-tokens
   ```

4. **File Upload Issues**
   ```bash
   # Check S3 configuration
   aws s3 ls s3://your-bucket-name
   
   # Test file upload
   curl -X POST -F "file=@test.jpg" http://localhost:5000/api/upload
   ```

## Support & Documentation

### Additional Resources
- **API Documentation**: `/docs/api.md`
- **Database Schema**: `/docs/database.md`
- **Mobile App Guide**: `/mobile-app/README.md`
- **Deployment Scripts**: `/deployment/`

### Contact Information
- **Repository**: https://github.com/Reshigan/SalesSyncAI
- **Issues**: https://github.com/Reshigan/SalesSyncAI/issues
- **Documentation**: https://github.com/Reshigan/SalesSyncAI/wiki

---

**System Status**: ✅ PRODUCTION READY  
**Last Updated**: 2025-09-13  
**Version**: 1.0.0