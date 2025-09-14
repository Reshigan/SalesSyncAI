# Docker Build Fixes for SalesSync AI

## 🐛 Issues Fixed

### 1. npm ci Error
**Problem**: Docker build was failing with:
```
npm error The `npm ci` command can only install with an existing package-lock.json
```

**Root Cause**: The project doesn't have `package-lock.json` files, but Dockerfiles were using `npm ci` which requires them.

**Solution**: Updated Dockerfiles to use `npm install` instead of `npm ci`:
- Backend: `npm install --omit=dev` (production dependencies only)
- Frontend: `npm install` (all dependencies for build)

### 2. Frontend Production Optimization
**Problem**: Frontend was using a simple serve setup which isn't production-ready.

**Solution**: Implemented multi-stage Docker build:
- **Build stage**: Compiles React app using Node.js
- **Production stage**: Serves static files using nginx
- Added proper nginx configuration with gzip, caching, and security headers

## 🚀 Deployment Scripts

### deploy-simple.sh
Comprehensive deployment script that:
- ✅ Fixes Docker build issues
- ✅ Handles Docker installation if missing
- ✅ Forces clean rebuild with `--no-cache`
- ✅ Provides detailed health checks
- ✅ Shows helpful troubleshooting information

### Usage
```bash
# On your server
git pull origin main
./deploy-simple.sh
```

## 🔧 Manual Deployment Steps

If you prefer manual deployment:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Copy production environment
cp .env.production .env

# 3. Stop existing services
docker-compose down --remove-orphans

# 4. Clean rebuild (important!)
docker-compose build --no-cache

# 5. Start services
docker-compose up -d

# 6. Check status
docker-compose ps
docker-compose logs -f
```

## 🏥 Health Checks

After deployment, verify services:

```bash
# Check all services
docker-compose ps

# Check individual service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs nginx
docker-compose logs postgres

# Test endpoints
curl http://ssai.gonxt.tech/health
curl http://ssai.gonxt.tech/api/health
```

## 🔍 Common Issues & Solutions

### Issue: Services keep restarting
**Check**: `docker-compose logs [service-name]`
**Common causes**:
- Database connection issues
- Missing environment variables
- Port conflicts

### Issue: Frontend shows blank page
**Check**: 
1. `docker-compose logs frontend`
2. `docker-compose logs nginx`
3. Browser developer console for errors

**Solutions**:
- Ensure frontend built successfully
- Check nginx configuration
- Verify API endpoints are accessible

### Issue: API not responding
**Check**: `docker-compose logs backend`
**Common causes**:
- Database not ready
- Environment variables incorrect
- Port 3001 not accessible

### Issue: SSL/HTTPS not working
**Solution**: Set up Let's Encrypt certificates:
```bash
sudo certbot --nginx -d ssai.gonxt.tech
```

## 📊 Service Architecture

```
Internet → Nginx (Port 80/443) → Frontend (Port 80) + Backend (Port 3001)
                                      ↓
                                 PostgreSQL (Port 5432)
                                      ↓
                                 Redis (Port 6379)
```

## 🔒 Security Features

- ✅ Non-root user in containers
- ✅ Security headers in nginx
- ✅ Rate limiting configured
- ✅ CORS properly configured
- ✅ SSL/TLS ready

## 📝 Environment Variables

Key variables in `.env.production`:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://salessync:your_password@postgres:5432/salessync
REDIS_URL=redis://redis:6379
CORS_ORIGIN=https://ssai.gonxt.tech
REACT_APP_API_URL=https://ssai.gonxt.tech/api
```

## 🎯 Next Steps

1. **Run deployment script**: `./deploy-simple.sh`
2. **Set up SSL**: `sudo certbot --nginx -d ssai.gonxt.tech`
3. **Monitor logs**: `docker-compose logs -f`
4. **Test application**: Visit `https://ssai.gonxt.tech`

## 📞 Support

If you encounter issues:
1. Check service logs: `docker-compose logs [service]`
2. Verify DNS points to your server
3. Ensure ports 80 and 443 are open
4. Check Docker daemon is running: `sudo systemctl status docker`