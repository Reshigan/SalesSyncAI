# 🚀 Deploy SalesSync to AWS - One Command Installation

## Quick Deployment

Deploy SalesSync to your AWS server with a single command:

### Option 1: Quick Install (Recommended)
```bash
# 1. SSH to your AWS server
ssh ubuntu@13.247.192.46

# 2. Download and run the quick installer
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/quick-install.sh -o quick-install.sh
sudo chmod +x quick-install.sh
sudo ./quick-install.sh
```

### Option 2: Full Featured Install
```bash
# 1. SSH to your AWS server
ssh ubuntu@13.247.192.46

# 2. Download and run the full installer
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deployment/install-from-github.sh -o install-salessync.sh
sudo chmod +x install-salessync.sh
sudo ./install-salessync.sh
```

**Difference**: Quick install uses simpler configuration and is more reliable. Full install has advanced security features and monitoring.

## What This Script Does

### 🔧 **System Setup**
- Updates Ubuntu 22.04 system packages
- Installs Node.js 18, PostgreSQL 15, Redis 7, Nginx
- Configures firewall and security settings
- Sets up SSL certificates with Let's Encrypt

### 📦 **Application Installation**
- Clones SalesSync from GitHub repository
- Installs all dependencies (backend and frontend)
- Builds production-ready applications
- Configures environment variables and secrets

### 🗄️ **Database Setup**
- Creates PostgreSQL database and user
- Runs all database migrations
- **Seeds TestCompany with complete sample data**:
  - 5 Users across all roles with realistic profiles
  - 10 South African customers with business data
  - 5 Products with pricing and specifications
  - 5 Completed visits with GPS coordinates and surveys
  - 3 Sales transactions with payment records
  - Sample marketing campaigns and activations

### 🔐 **Security Configuration**
- Configures UFW firewall (SSH, HTTP, HTTPS only)
- Sets up Fail2Ban for SSH protection
- Implements rate limiting in Nginx
- Generates secure passwords and JWT secrets
- Configures SSL/TLS with security headers

### 🚀 **Production Services**
- Configures PM2 for process management with clustering
- Sets up Nginx reverse proxy with load balancing
- Implements health monitoring every 5 minutes
- Configures automated daily backups
- Sets up log rotation and management

### 📊 **Monitoring & Backup**
- Real-time health monitoring with alerts
- Automated database and file backups
- Log rotation with 30-day retention
- Performance monitoring and metrics
- SSL certificate auto-renewal

## After Installation

### 🌐 **Access Your Application**
- **Frontend**: https://SSAI.gonxt.tech
- **Backend API**: https://SSAI.gonxt.tech/api
- **Health Check**: https://SSAI.gonxt.tech/health
- **API Documentation**: https://SSAI.gonxt.tech/api/docs

### 🔑 **Login Credentials**
```
Super Admin:    superadmin@salessync.com    / SuperAdmin123!
Company Admin:  admin@testcompany.com       / Admin123!
Manager:        manager@testcompany.com     / Manager123!
Field Agent:    agent@testcompany.com       / Agent123!
Marketing:      marketing@testcompany.com   / Marketing123!
```

### 📋 **Sample Data Included**
- **TestCompany Ltd** - Complete company setup
- **5 Users** - All roles with realistic South African profiles
- **10 Customers** - South African businesses with contact details
- **5 Products** - FMCG products with pricing and specifications
- **5 Visits** - Completed field visits with GPS data and photos
- **3 Sales** - Transactions with payment records and invoices
- **Campaigns** - Sample marketing campaigns and activations

## Management Commands

### 🔧 **Application Management**
```bash
# View application status
pm2 status

# View real-time logs
pm2 logs salessync-backend

# Restart application
pm2 restart salessync-backend

# Monitor performance
pm2 monit
```

### 🗄️ **Database Management**
```bash
# Connect to database
sudo -u postgres psql -d salessync_production

# View tables
\dt

# Check sample data
SELECT * FROM companies;
SELECT * FROM users;
SELECT * FROM customers;
```

### 🔍 **System Monitoring**
```bash
# View monitoring logs
sudo tail -f /var/log/salessync-monitor.log

# Check system resources
htop

# View backup logs
sudo tail -f /var/log/salessync-backup.log

# List backups
ls -la /opt/salessync/backups/
```

### 🌐 **Web Server Management**
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# View access logs
sudo tail -f /var/log/nginx/access.log
```

### 🔒 **SSL Certificate Management**
```bash
# Check certificate status
sudo certbot certificates

# Test renewal
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew
```

## Server Requirements

### 📋 **Minimum Specifications**
- **Instance Type**: t4g.medium or higher
- **Operating System**: Ubuntu 22.04 LTS
- **Memory**: 4GB RAM minimum
- **Storage**: 50GB SSD minimum
- **Network**: Public IP with domain pointing

### 🌐 **DNS Configuration**
Ensure your domain points to your server:
```
SSAI.gonxt.tech → 13.247.192.46
www.SSAI.gonxt.tech → 13.247.192.46
```

## Troubleshooting

### ❌ **Installation Fails**
```bash
# Check system requirements
df -h  # Disk space
free -h  # Memory
nproc  # CPU cores

# Check DNS resolution
dig SSAI.gonxt.tech

# Check server connectivity
curl -I https://github.com
```

### ❌ **Application Not Starting**
```bash
# Check PM2 logs
pm2 logs salessync-backend

# Check environment file
cat /opt/salessync/backend/.env

# Check database connection
sudo -u postgres psql -d salessync_production -c "SELECT 1;"

# Check Redis connection
redis-cli ping
```

### ❌ **SSL Certificate Issues**
```bash
# Check certificate status
sudo certbot certificates

# Check domain DNS
dig SSAI.gonxt.tech

# Test Nginx configuration
sudo nginx -t

# Check firewall
sudo ufw status
```

## Support

### 📞 **Contact Information**
- **Email**: support@gonxt.tech
- **Phone**: +27 11 123 4567
- **Documentation**: https://SSAI.gonxt.tech/docs
- **Repository**: https://github.com/Reshigan/SalesSyncAI

### 📚 **Additional Resources**
- **Installation Report**: `/opt/salessync/INSTALLATION_REPORT.md`
- **Application Logs**: `/var/log/pm2/salessync-*.log`
- **System Logs**: `/var/log/salessync-monitor.log`
- **Backup Logs**: `/var/log/salessync-backup.log`

---

## 🎉 **Ready for Production**

After running the installation script, SalesSync will be:
- ✅ **Fully deployed** with all components running
- ✅ **Secured** with SSL certificates and firewall
- ✅ **Monitored** with automated health checks
- ✅ **Backed up** with daily automated backups
- ✅ **Seeded** with TestCompany and sample data
- ✅ **Ready** for immediate production use

**Total installation time: 10-15 minutes**

*Deploy now and start syncing your success in the field!*