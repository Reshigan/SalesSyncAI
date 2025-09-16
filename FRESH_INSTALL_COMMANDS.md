# 🚀 SalesSync Fresh Production Installation

## 🎯 One-Line Installation Command

For a **clean Ubuntu server** (AWS t3.medium or similar), run this single command:

```bash
sudo wget -O install-salessync.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/fresh-production-install.sh && sudo chmod +x install-salessync.sh && sudo ./install-salessync.sh
```

## 📋 What This Script Does

### 🔧 System Setup
- ✅ Updates all system packages
- ✅ Installs essential build tools and utilities
- ✅ Configures UFW firewall (ports 22, 80, 443)
- ✅ Sets up log rotation

### 🟢 Node.js Environment
- ✅ Installs Node.js 18 (LTS)
- ✅ Updates npm to latest version
- ✅ Installs PM2 process manager globally
- ✅ Installs TypeScript globally

### 🐘 Database Setup
- ✅ Installs PostgreSQL 15
- ✅ Creates production database and user
- ✅ Configures proper permissions
- ✅ Tests database connectivity

### 🌐 Web Server
- ✅ Installs and configures Nginx
- ✅ Sets up reverse proxy to Node.js app
- ✅ Configures gzip compression
- ✅ Adds security headers

### 🔒 SSL Certificate
- ✅ Installs Certbot (Let's Encrypt)
- ✅ Obtains SSL certificate for your domain
- ✅ Configures automatic HTTPS redirect
- ✅ Sets up auto-renewal

### 📦 SalesSync Application
- ✅ Clones latest SalesSync code
- ✅ Installs all dependencies (including dev dependencies)
- ✅ Creates custom TypeScript declarations
- ✅ Generates Prisma client
- ✅ Runs database migrations
- ✅ Seeds database with demo data
- ✅ Builds TypeScript application
- ✅ Starts application with PM2

### 🔧 Maintenance Tools
- ✅ Creates backup script (`salessync-backup`)
- ✅ Creates restart script (`salessync-restart`)
- ✅ Creates status script (`salessync-status`)
- ✅ Sets up daily automated backups

## ⏱️ Installation Time

- **Total time**: 15-25 minutes
- **System updates**: 3-5 minutes
- **Package installations**: 5-8 minutes
- **SSL certificate**: 2-3 minutes
- **Application setup**: 5-10 minutes

## 🎯 After Installation

### 🌐 Access Your Application
- **URL**: `https://salessync.gonxt.tech`
- **Login Email**: `admin@demo.com`
- **Login Password**: `admin123`

### 🔧 Management Commands
```bash
# Check application status
salessync-status

# Restart application
salessync-restart

# Create backup
salessync-backup

# View application logs
pm2 logs salessync-backend

# Check PM2 processes
pm2 status

# Check system services
systemctl status nginx postgresql
```

### 📁 Important Directories
- **Application**: `/opt/salessync`
- **Logs**: `/var/log/salessync/`
- **Backups**: `/opt/backups/salessync/`
- **Nginx Config**: `/etc/nginx/sites-available/salessync`

## 🔍 Troubleshooting

### If Installation Fails
1. **Check the logs** - The script provides detailed logging
2. **Verify domain DNS** - Ensure your domain points to the server IP
3. **Check firewall** - Ensure ports 80 and 443 are open
4. **Run status check**: `salessync-status`

### Common Issues
- **SSL fails**: Check domain DNS settings
- **App won't start**: Check logs with `pm2 logs salessync-backend`
- **Database issues**: Check PostgreSQL status with `systemctl status postgresql`

### Manual Restart
If you need to restart everything manually:
```bash
sudo systemctl restart postgresql
sudo systemctl restart nginx
pm2 restart salessync-backend
```

## 🔄 Updates

To update SalesSync to the latest version:
```bash
cd /opt/salessync
git pull origin main
cd backend
npm install --include=dev
npx prisma generate
npx tsc --skipLibCheck
pm2 restart salessync-backend
```

## 🆘 Support

If you encounter issues:
1. Run `salessync-status` to check all services
2. Check logs: `pm2 logs salessync-backend`
3. Verify SSL: `curl -I https://salessync.gonxt.tech`
4. Test database: `sudo -u postgres psql -d salessync_production -c "SELECT 1;"`

---

**🎉 Your SalesSync production environment will be ready in under 30 minutes!**