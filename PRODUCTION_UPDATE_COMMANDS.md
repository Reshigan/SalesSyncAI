# 🚀 SalesSync Production Update Commands

## 🔧 Fix Current Database Permission Issue

Run this command on your production server to fix the "permission denied for schema public" error:

```bash
sudo wget -O fix-db.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/fix-prisma-seeding-validation/fix-database-permissions.sh && sudo chmod +x fix-db.sh && sudo ./fix-db.sh
```

## 📥 Get Latest Deployment Scripts

```bash
wget -O get-scripts.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/fix-prisma-seeding-validation/get-production-scripts.sh && chmod +x get-scripts.sh && ./get-scripts.sh
```

## 🚀 Full Production Deployment (First Time)

```bash
sudo wget -O deploy.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/fix-prisma-seeding-validation/update-production-with-ssl.sh && sudo chmod +x deploy.sh && sudo ./deploy.sh
```

## 🔄 Quick Update (Existing Deployment)

```bash
sudo wget -O update.sh https://raw.githubusercontent.com/Reshigan/SalesSyncAI/fix-prisma-seeding-validation/quick-update-production.sh && sudo chmod +x update.sh && sudo ./update.sh
```

## 🌐 Your Site

After deployment, your site will be available at:
- **HTTPS**: https://SalesSync.gonxt.tech
- **Default Login**: admin@demo.com / admin123

## 🔍 Check Status

```bash
# Check application status
sudo pm2 status

# Check logs
sudo pm2 logs salessync

# Check services
sudo systemctl status nginx postgresql
```

## 🆘 Emergency Commands

### Restart Everything
```bash
sudo systemctl restart postgresql nginx
sudo pm2 restart salessync
```

### Check Database Connection
```bash
sudo -u postgres psql -d salessync_production -c "SELECT current_user, current_database();"
```

### Manual Migration (if needed)
```bash
cd /opt/salessync/backend
DATABASE_URL="postgresql://salessync:salessync_secure_password_2024@localhost:5432/salessync_production" npx prisma migrate deploy
```

---

## 📋 What's Fixed in This Update

✅ **Prisma Seeding Validation Errors**
- Removed invalid `description` field from Company model
- Fixed User model fields (firstName/lastName instead of name)
- Fixed User role values (COMPANY_ADMIN instead of ADMIN)
- Fixed unique constraints (companyId_email composite key)

✅ **Database Permission Issues**
- Added SUPERUSER privilege to database user
- Granted comprehensive schema permissions
- Set default privileges for future objects
- Added automatic permission retry logic

✅ **SSL & Security**
- Automatic Let's Encrypt SSL certificate for SalesSync.gonxt.tech
- HTTPS redirect and security headers
- Firewall configuration (UFW)
- PM2 process management with auto-restart

✅ **Production Ready**
- Nginx reverse proxy with gzip compression
- Database backup system
- Health checks and monitoring
- Comprehensive error handling