# 🌐 IP Access Configuration Guide

## Problem Solved
The server was configured for domain-based access (`ssai.gonxt.tech`) but needed to be accessible via public IP `13.247.192.46`.

## Solution Overview
Created IP-specific configuration files and deployment scripts to make the application accessible via the public IP address.

## 🔧 Files Created/Modified

### New Configuration Files
- `nginx/conf.d/ip-access.conf` - Nginx configuration for IP-based access
- `docker-compose.ip.yml` - Docker Compose configuration for IP deployment
- `deploy-ip-access.sh` - Automated deployment script for IP access

### Modified Files
- `backend/src/index.ts` - Updated CORS configuration to allow IP access

## 🚀 Quick Deployment

### Option 1: Automated Deployment (Recommended)
```bash
# Run the automated deployment script
./deploy-ip-access.sh
```

### Option 2: Manual Deployment
```bash
# Stop existing services
docker-compose down

# Deploy with IP configuration
docker-compose -f docker-compose.ip.yml up -d --build

# Wait for services to start
sleep 60

# Run migrations
docker-compose -f docker-compose.ip.yml exec backend npx prisma migrate deploy

# Seed database
docker-compose -f docker-compose.ip.yml exec backend node seed-demo-simple.js
```

## 🔍 Key Configuration Changes

### 1. Nginx Configuration (`nginx/conf.d/ip-access.conf`)
- Configured to accept requests for IP `13.247.192.46`
- Removed SSL/HTTPS requirements (HTTP only for IP access)
- Updated Content Security Policy for IP-based access
- Added direct backend health check endpoint

### 2. Docker Compose (`docker-compose.ip.yml`)
- All services bind to `0.0.0.0` (all interfaces)
- Frontend built with IP-based API URL
- Environment variables configured for IP access
- Removed SSL certificate dependencies

### 3. Backend CORS (`backend/src/index.ts`)
- Added `http://13.247.192.46` to allowed origins
- Added support for environment-based CORS configuration
- Maintained backward compatibility with existing domains

## 🌐 Access URLs

After deployment, the application will be accessible at:

- **Frontend**: http://13.247.192.46
- **Backend API**: http://13.247.192.46/api
- **Health Check**: http://13.247.192.46/health
- **API Health**: http://13.247.192.46/api/health

## 🔧 Service Management

### Check Status
```bash
docker-compose -f docker-compose.ip.yml ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.ip.yml logs -f

# Specific service
docker-compose -f docker-compose.ip.yml logs -f backend
docker-compose -f docker-compose.ip.yml logs -f frontend
docker-compose -f docker-compose.ip.yml logs -f nginx
```

### Restart Services
```bash
# Restart all
docker-compose -f docker-compose.ip.yml restart

# Restart specific service
docker-compose -f docker-compose.ip.yml restart backend
```

### Stop Services
```bash
docker-compose -f docker-compose.ip.yml down
```

## 🛠️ Troubleshooting

### Issue: Cannot Access via IP
**Symptoms**: Browser shows "This site can't be reached" or connection timeout

**Solutions**:
1. Check if services are running:
   ```bash
   docker-compose -f docker-compose.ip.yml ps
   ```

2. Verify port bindings:
   ```bash
   docker ps | grep salessync
   ```

3. Test local connectivity:
   ```bash
   curl http://localhost/health
   curl http://13.247.192.46/health
   ```

4. Check firewall settings:
   ```bash
   # Ubuntu/Debian
   sudo ufw status
   sudo ufw allow 80
   
   # CentOS/RHEL
   sudo firewall-cmd --list-all
   sudo firewall-cmd --add-port=80/tcp --permanent
   sudo firewall-cmd --reload
   ```

### Issue: CORS Errors
**Symptoms**: Browser console shows CORS policy errors

**Solutions**:
1. Verify CORS configuration in backend logs:
   ```bash
   docker-compose -f docker-compose.ip.yml logs backend | grep -i cors
   ```

2. Check environment variables:
   ```bash
   docker-compose -f docker-compose.ip.yml exec backend env | grep -E "(FRONTEND_URL|CORS_ORIGIN)"
   ```

3. Restart backend service:
   ```bash
   docker-compose -f docker-compose.ip.yml restart backend
   ```

### Issue: Database Connection Errors
**Symptoms**: Backend logs show database connection failures

**Solutions**:
1. Check database status:
   ```bash
   docker-compose -f docker-compose.ip.yml exec postgres pg_isready
   ```

2. Verify database credentials:
   ```bash
   docker-compose -f docker-compose.ip.yml exec backend env | grep DATABASE_URL
   ```

3. Run migrations manually:
   ```bash
   docker-compose -f docker-compose.ip.yml exec backend npx prisma migrate deploy
   ```

### Issue: Frontend Shows API Errors
**Symptoms**: Frontend loads but API calls fail

**Solutions**:
1. Check backend health:
   ```bash
   curl http://13.247.192.46/api/health
   ```

2. Verify nginx proxy configuration:
   ```bash
   docker-compose -f docker-compose.ip.yml exec nginx nginx -t
   ```

3. Check nginx logs:
   ```bash
   docker-compose -f docker-compose.ip.yml logs nginx
   ```

## 🔐 Security Considerations

### Current Configuration
- **HTTP Only**: No SSL/TLS encryption (suitable for development/testing)
- **Open Ports**: Database and Redis ports exposed (5432, 6379)
- **Default Passwords**: Using default credentials

### Production Recommendations
1. **Enable HTTPS**: Set up SSL certificates for encrypted communication
2. **Restrict Database Access**: Bind database ports to localhost only
3. **Change Default Passwords**: Update all default credentials
4. **Configure Firewall**: Restrict access to necessary ports only
5. **Enable Authentication**: Ensure proper user authentication is configured

### Firewall Configuration
```bash
# Allow HTTP traffic
sudo ufw allow 80

# Allow HTTPS traffic (if SSL is configured)
sudo ufw allow 443

# Restrict database access (optional)
sudo ufw deny 5432
sudo ufw deny 6379
```

## 📊 Monitoring

### Health Checks
```bash
# Quick health check
curl -s http://13.247.192.46/health && echo " - Nginx OK"
curl -s http://13.247.192.46/api/health && echo " - Backend OK"
```

### Service Status
```bash
# Detailed status
docker-compose -f docker-compose.ip.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

### Resource Usage
```bash
# Container resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

## 🔄 Switching Between Configurations

### Switch to IP Access
```bash
docker-compose down
docker-compose -f docker-compose.ip.yml up -d
```

### Switch Back to Domain Access
```bash
docker-compose -f docker-compose.ip.yml down
docker-compose up -d
```

## 📞 Support

If you encounter issues:

1. **Check Logs**: Always start by checking service logs
2. **Verify Configuration**: Ensure all configuration files are correct
3. **Test Connectivity**: Use curl to test endpoints
4. **Check Resources**: Ensure sufficient disk space and memory
5. **Review Firewall**: Verify firewall rules allow necessary traffic

---

## 🎉 Success Indicators

Your deployment is successful when:
- ✅ All services show "Up" status
- ✅ Health endpoints return 200 OK
- ✅ Frontend loads at http://13.247.192.46
- ✅ API endpoints respond correctly
- ✅ Database connections work
- ✅ No CORS errors in browser console

The application should now be fully accessible via the public IP address 13.247.192.46!