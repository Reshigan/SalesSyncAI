# SalesSyncAI Production Deployment Guide

## AWS t4g.medium Server Deployment (13.247.192.46)

This guide provides step-by-step instructions for deploying SalesSyncAI to a production AWS t4g.medium instance running Ubuntu 22.04 LTS ARM64.

## Prerequisites

- AWS t4g.medium instance (13.247.192.46) running Ubuntu 22.04 LTS
- SSH access to the server with sudo privileges
- Domain name pointed to the server IP (optional, for SSL)

## Quick Deployment

### Option 1: Automated Production Deployment

```bash
# SSH into your AWS server
ssh ubuntu@13.247.192.46

# Download and run the production deployment script
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/production-deploy.sh | sudo bash
```

### Option 2: Manual Step-by-Step Deployment

If you prefer to deploy manually or need to customize the deployment:

#### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

#### 2. Install Node.js 18 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs
```

#### 3. Install PostgreSQL 15

```bash
sudo apt install -y postgresql postgresql-contrib postgresql-client
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 4. Install Redis

```bash
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### 5. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 6. Install PM2

```bash
sudo npm install -g pm2
```

#### 7. Clone and Setup Application

```bash
# Create application directory
sudo mkdir -p /opt/salessync
cd /opt/salessync

# Clone repository
sudo git clone https://github.com/Reshigan/SalesSyncAI.git .

# Setup backend
cd backend
sudo npm ci --only=production

# Create production environment file
sudo tee .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://salessync_prod:YOUR_DB_PASSWORD@localhost:5432/salessync_prod?schema=public"
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD="YOUR_REDIS_PASSWORD"
JWT_SECRET="YOUR_JWT_SECRET"
JWT_EXPIRES_IN="7d"
CORS_ORIGIN="http://13.247.192.46,https://13.247.192.46"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL="info"
EOF

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy
npm run seed

# Build backend
npm run build

# Setup frontend
cd ../frontend
sudo npm ci --only=production
npm run build
```

#### 8. Configure Database

```bash
# Create production database and user
sudo -u postgres psql << EOF
CREATE DATABASE salessync_prod;
CREATE USER salessync_prod WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE salessync_prod TO salessync_prod;
ALTER USER salessync_prod CREATEDB;
\q
EOF
```

#### 9. Configure Nginx

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/salessync << EOF
server {
    listen 80;
    server_name 13.247.192.46;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Frontend static files
    location / {
        root /opt/salessync/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    client_max_body_size 10M;
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

#### 10. Setup PM2 Process Management

```bash
# Create PM2 ecosystem file
sudo tee /opt/salessync/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'salessync-backend',
    script: './backend/dist/index.js',
    cwd: '/opt/salessync',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/salessync/logs/backend-error.log',
    out_file: '/opt/salessync/logs/backend-out.log',
    log_file: '/opt/salessync/logs/backend-combined.log',
    time: true,
    max_memory_restart: '500M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF

# Create logs directory
sudo mkdir -p /opt/salessync/logs

# Start application with PM2
cd /opt/salessync
sudo pm2 start ecosystem.config.js
sudo pm2 save
sudo pm2 startup systemd -u root --hp /root
```

#### 11. Configure Firewall

```bash
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Post-Deployment Configuration

### SSL Certificate Setup (Recommended)

If you have a domain name pointed to your server:

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is set up automatically
```

### Monitoring and Maintenance

#### Check Service Status

```bash
# Check PM2 status
sudo pm2 status

# Check system services
sudo systemctl status nginx postgresql redis-server

# View application logs
sudo pm2 logs salessync-backend

# View Nginx logs
sudo tail -f /var/log/nginx/salessync_access.log
sudo tail -f /var/log/nginx/salessync_error.log
```

#### Performance Monitoring

```bash
# View system metrics
curl http://13.247.192.46/metrics

# Check application health
curl http://13.247.192.46/health

# Detailed system health
curl http://13.247.192.46/api/system/health
```

#### Backup Database

```bash
# Create database backup
sudo -u postgres pg_dump salessync_prod > /opt/salessync/backups/salessync_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
sudo -u postgres psql salessync_prod < /opt/salessync/backups/salessync_backup.sql
```

## Demo Data and Login Credentials

The deployment script automatically seeds the database with comprehensive demo data:

### Super Admin (Platform Management)
- **Email:** superadmin@salessync.com
- **Password:** SuperAdmin123!
- **Role:** Super Admin
- **Access:** Full platform administration

### Premium Beverages Ltd (Main Demo Company)
- **Company Admin:** admin@premiumbeverages.com / DemoAdmin123!
- **Sales Manager:** manager@premiumbeverages.com / Manager123!
- **Field Agents:** Agent123! (password for all agents)
  - james.wilson@premiumbeverages.com (Johannesburg North)
  - lisa.martinez@premiumbeverages.com (Johannesburg South)
  - david.brown@premiumbeverages.com (Cape Town)
  - emma.davis@premiumbeverages.com (Durban)
  - robert.garcia@premiumbeverages.com (Pretoria)

### Test Company (Development)
- **Test Admin:** admin@testcompany.com / TestAdmin123!

## Demo Data Features

The production seed includes:

- **3 Companies** with different subscription tiers
- **8 Users** with various roles and permissions
- **Comprehensive Product Catalog** (20+ products in 4 categories)
- **Realistic Customer Database** (11 customers across different business types)
- **50 Sales Visits** with various statuses and realistic data
- **25 Sales Orders** linked to completed visits
- **3 Marketing Campaigns** with budgets and objectives
- **3 Active Promotions** with different discount types
- **Multi-territory Coverage** (Johannesburg, Cape Town, Durban, Pretoria)
- **Complete Sales Workflow** demonstration

## Application URLs

After successful deployment:

- **Main Application:** http://13.247.192.46
- **API Documentation:** http://13.247.192.46/api/docs
- **Health Check:** http://13.247.192.46/health
- **System Metrics:** http://13.247.192.46/metrics

## Troubleshooting

### Common Issues

1. **Application not starting:**
   ```bash
   sudo pm2 logs salessync-backend
   sudo systemctl status postgresql redis-server
   ```

2. **Database connection issues:**
   ```bash
   sudo -u postgres psql -c "\l"  # List databases
   sudo systemctl restart postgresql
   ```

3. **Nginx configuration errors:**
   ```bash
   sudo nginx -t  # Test configuration
   sudo systemctl restart nginx
   ```

4. **Permission issues:**
   ```bash
   sudo chown -R root:root /opt/salessync
   sudo chmod -R 755 /opt/salessync
   ```

### Performance Optimization

1. **Database optimization:**
   ```bash
   # Analyze database performance
   sudo -u postgres psql salessync_prod -c "ANALYZE;"
   
   # Update PostgreSQL configuration for production
   sudo nano /etc/postgresql/15/main/postgresql.conf
   ```

2. **Redis optimization:**
   ```bash
   # Monitor Redis performance
   redis-cli info memory
   redis-cli info stats
   ```

3. **Application monitoring:**
   ```bash
   # Monitor application performance
   sudo pm2 monit
   
   # View detailed metrics
   curl http://13.247.192.46/api/system/health
   ```

## Security Considerations

1. **Change default passwords** for database and Redis
2. **Configure firewall** to restrict access
3. **Set up SSL certificates** for HTTPS
4. **Regular security updates**
5. **Monitor application logs** for suspicious activity
6. **Backup database regularly**
7. **Use environment variables** for sensitive configuration

## Support and Maintenance

For ongoing support and maintenance:

1. **Monitor system resources** (CPU, memory, disk space)
2. **Regular database backups**
3. **Keep system packages updated**
4. **Monitor application logs**
5. **Performance optimization based on usage patterns**

## Scaling Considerations

For high-traffic scenarios:

1. **Load balancer** with multiple application instances
2. **Database read replicas**
3. **Redis cluster** for caching
4. **CDN** for static assets
5. **Monitoring and alerting** system

---

**Deployment completed successfully!** 🎉

Your SalesSyncAI application is now running in production with comprehensive demo data for testing and demonstration purposes.