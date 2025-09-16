# SalesSync Production Deployment Guide

## 🚀 Quick Start

### First-Time Deployment (Full Setup with SSL)

```bash
# On your Ubuntu server (t3g.medium or similar)
sudo wget https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/update-production-with-ssl.sh
sudo chmod +x update-production-with-ssl.sh
sudo ./update-production-with-ssl.sh
```

### Quick Updates (Existing Deployment)

```bash
# For code updates only
sudo wget https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/quick-update-production.sh
sudo chmod +x quick-update-production.sh
sudo ./quick-update-production.sh
```

## 📋 What the Scripts Do

### Full Deployment Script (`update-production-with-ssl.sh`)

1. **System Setup**
   - Installs Node.js 18.x, PostgreSQL, Nginx, PM2
   - Installs SSL certificate tools (certbot)
   - Configures firewall (UFW)

2. **Database Setup**
   - Creates PostgreSQL database: `salessync_production`
   - Creates database user: `salessync`
   - Runs Prisma migrations
   - Seeds database with demo data (fixed seeding issues)

3. **Application Deployment**
   - Clones/updates code from GitHub
   - Installs dependencies
   - Builds application
   - Configures PM2 for process management

4. **SSL & Security**
   - Installs Let's Encrypt SSL certificate for `SalesSync.gonxt.tech`
   - Configures Nginx with HTTPS redirect
   - Sets up security headers and gzip compression
   - Configures firewall rules

5. **Health Checks**
   - Verifies all services are running
   - Tests application endpoints
   - Checks SSL certificate status

### Quick Update Script (`quick-update-production.sh`)

1. Stops the application
2. Pulls latest code from GitHub
3. Updates dependencies
4. Runs database migrations
5. Rebuilds application
6. Restarts services

## 🌐 Access Information

- **Website**: https://SalesSync.gonxt.tech
- **Default Login**: 
  - Email: `admin@demo.com`
  - Password: `admin123`

## 🔧 Server Management Commands

### Application Management
```bash
# Check application status
sudo pm2 status

# View application logs
sudo pm2 logs salessync

# Restart application
sudo pm2 restart salessync

# Stop application
sudo pm2 stop salessync

# Start application
sudo pm2 start salessync
```

### Service Management
```bash
# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### SSL Certificate Management
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Test certificate renewal
sudo certbot renew --dry-run
```

### Database Management
```bash
# Connect to database
sudo -u postgres psql salessync_production

# Create database backup
sudo -u postgres pg_dump salessync_production > backup.sql

# Restore database backup
sudo -u postgres psql salessync_production < backup.sql
```

## 📁 File Locations

- **Application**: `/opt/salessync/`
- **Nginx Config**: `/etc/nginx/sites-available/salessync`
- **SSL Certificates**: `/etc/letsencrypt/live/SalesSync.gonxt.tech/`
- **Backups**: `/opt/salessync-backups/`
- **Logs**: `sudo pm2 logs salessync`

## 🔒 Security Features

- **SSL/TLS**: Automatic HTTPS with Let's Encrypt
- **Firewall**: UFW configured (SSH, HTTP, HTTPS only)
- **Security Headers**: HSTS, XSS protection, content type sniffing protection
- **Database**: Local PostgreSQL with restricted access
- **Process Management**: PM2 with auto-restart

## 🐛 Troubleshooting

### Application Won't Start
```bash
# Check logs
sudo pm2 logs salessync --lines 50

# Check if port 3000 is in use
sudo netstat -tlnp | grep :3000

# Restart from scratch
sudo pm2 delete salessync
cd /opt/salessync/backend
sudo pm2 start ecosystem.config.js
```

### SSL Issues
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew --nginx

# Check Nginx config
sudo nginx -t
```

### Database Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connection
sudo -u postgres psql -c "SELECT version();"

# Reset database (CAUTION: This will delete all data)
sudo -u postgres dropdb salessync_production
sudo -u postgres createdb salessync_production
cd /opt/salessync/backend
DATABASE_URL="postgresql://salessync:salessync_secure_password_2024@localhost:5432/salessync_production" npx prisma migrate deploy
DATABASE_URL="postgresql://salessync:salessync_secure_password_2024@localhost:5432/salessync_production" node seed-simple.js
```

## 🔄 Update Process

1. **Test Updates Locally First**
2. **Create Backup** (automatic in scripts)
3. **Run Quick Update Script**
4. **Verify Application Works**
5. **Monitor Logs for Issues**

## 📞 Support

If you encounter issues:

1. Check the logs: `sudo pm2 logs salessync`
2. Verify services: `sudo systemctl status nginx postgresql`
3. Check firewall: `sudo ufw status`
4. Test SSL: `curl -I https://SalesSync.gonxt.tech`

## ⚠️ Important Notes

- **Change Default Passwords** after first deployment
- **Configure Environment Variables** for production
- **Set up Monitoring** (consider adding monitoring tools)
- **Regular Backups** are created automatically but verify them
- **SSL Certificates** auto-renew via cron job

### Legacy Deployment Options

If you need the old deployment methods:
chmod +x fix-ports.sh && ./fix-ports.sh
```

## What's Fixed ✅

- **100+ TypeScript compilation errors resolved**
- **Complete Prisma schema with all missing models**
- **Production-ready deployment scripts**
- **Port conflict resolution**
- **AWS t4g.medium Ubuntu 22.04 optimized**

## Access Your Application

After deployment:
- **Frontend**: `http://your-server-ip/` (or `:8080` if using alternative ports)
- **API**: `http://your-server-ip/api` (or `:3001/api` if using alternative ports)
- **Health Check**: `http://your-server-ip/api/health`

## Management Commands

### Docker Deployment
```bash
# View status
docker compose -f docker-compose.production.yml ps

# View logs
docker compose -f docker-compose.production.yml logs -f

# Restart services
docker compose -f docker-compose.production.yml restart
```

### Native Deployment
```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart application
pm2 restart all
```

For detailed instructions, see [DEPLOYMENT_GUIDE_FIXED.md](./DEPLOYMENT_GUIDE_FIXED.md).