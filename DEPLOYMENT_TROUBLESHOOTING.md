# 🔧 SalesSync Deployment Troubleshooting Guide

## Quick Fix for Current Issues

If you're experiencing the errors mentioned (nexus_user, missing build script), run this command:

```bash
./deploy-fix.sh
```

This script fixes all common deployment issues automatically.

## Common Issues and Solutions

### 1. PostgreSQL Role "nexus_user" Does Not Exist

**Error:**
```
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL: role "nexus_user" does not exist
```

**Cause:** Configuration mismatch between different deployment scripts or cached configurations.

**Solution:**
```bash
# Stop all containers
docker-compose down -v
docker container prune -f

# Use the fixed deployment
./deploy-fix.sh
```

### 2. Frontend Build Script Missing

**Error:**
```
npm error Missing script: "build"
```

**Cause:** Docker trying to run build in wrong directory or using wrong package.json.

**Solution:**
The `deploy-fix.sh` script creates proper Dockerfiles that:
- Use the correct working directory
- Copy package.json properly
- Run build commands in the right context

### 3. Docker Build Failures

**Error:**
```
ERROR: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1
```

**Solutions:**
1. **Use the fixed deployment script:** `./deploy-fix.sh`
2. **Manual fix:** Check Dockerfile paths and build context
3. **Clean rebuild:** Remove all containers and images, then rebuild

### 4. Database Connection Issues

**Symptoms:**
- Services can't connect to database
- Migration failures
- Seeding errors

**Solutions:**
```bash
# Check database status
docker-compose -f docker-compose.fixed.yml ps

# View database logs
docker-compose -f docker-compose.fixed.yml logs postgres

# Reset database
docker-compose -f docker-compose.fixed.yml down -v
docker-compose -f docker-compose.fixed.yml up -d postgres
```

### 5. Port Conflicts

**Error:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:5432: bind: address already in use
```

**Solution:**
```bash
# Check what's using the port
sudo lsof -i :5432
sudo lsof -i :3000
sudo lsof -i :80

# Stop conflicting services
sudo systemctl stop postgresql
sudo systemctl stop apache2
sudo systemctl stop nginx

# Or use different ports (already configured in deploy-fix.sh)
# PostgreSQL: 5433 instead of 5432
# Redis: 6380 instead of 6379
# Frontend: 8081 instead of 80
```

## Step-by-Step Manual Deployment

If the automated script doesn't work, follow these steps:

### 1. Clean Environment
```bash
# Stop all containers
docker-compose down -v
docker container prune -f
docker volume prune -f

# Remove old images (optional)
docker image prune -a
```

### 2. Check Dependencies
```bash
# Verify Docker
docker --version
docker-compose --version

# Verify Node.js (if building locally)
node --version
npm --version
```

### 3. Environment Configuration
```bash
# Create .env file
cat > .env << EOF
POSTGRES_DB=salessync_prod
POSTGRES_USER=salessync_user
POSTGRES_PASSWORD=SalesSync2024!Prod
REDIS_PASSWORD=SalesSync2024!Redis
JWT_SECRET=SalesSync2024!JWT!Secret!Key!Production
JWT_REFRESH_SECRET=SalesSync2024!JWT!Refresh!Secret!Key!Production
REACT_APP_API_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:8081
NODE_ENV=production
EOF
```

### 4. Deploy Services
```bash
# Use the fixed docker-compose file
docker-compose -f docker-compose.fixed.yml up -d --build

# Wait for services
sleep 30

# Check status
docker-compose -f docker-compose.fixed.yml ps
```

### 5. Database Setup
```bash
# Run migrations
docker-compose -f docker-compose.fixed.yml exec backend npx prisma migrate deploy

# Seed database
docker-compose -f docker-compose.fixed.yml exec backend npm run seed:demo:simple
```

## Verification Steps

### 1. Check Service Status
```bash
docker-compose -f docker-compose.fixed.yml ps
```

All services should show "Up" status.

### 2. Test Endpoints
```bash
# Backend health
curl http://localhost:3001/health

# Frontend
curl http://localhost:8081/health

# API endpoint
curl http://localhost:3001/api/health
```

### 3. Check Logs
```bash
# All services
docker-compose -f docker-compose.fixed.yml logs

# Specific service
docker-compose -f docker-compose.fixed.yml logs backend
docker-compose -f docker-compose.fixed.yml logs frontend
docker-compose -f docker-compose.fixed.yml logs postgres
```

## Access Information

After successful deployment:

- **Frontend:** http://localhost:8081
- **Backend API:** http://localhost:3001
- **Health Check:** http://localhost:3001/health

**Default Login:**
- Email: admin@testcompany.com
- Password: Admin123!

## Getting Help

If you continue to experience issues:

1. **Check logs:** `docker-compose -f docker-compose.fixed.yml logs`
2. **Verify ports:** Make sure ports 3001, 8081, 5433, 6380 are available
3. **System resources:** Ensure you have enough RAM (4GB+) and disk space (10GB+)
4. **Docker permissions:** Make sure your user can run Docker commands

## Advanced Troubleshooting

### Reset Everything
```bash
# Nuclear option - removes everything
docker system prune -a --volumes
docker-compose -f docker-compose.fixed.yml up -d --build
```

### Manual Database Reset
```bash
# Connect to database
docker-compose -f docker-compose.fixed.yml exec postgres psql -U salessync_user -d salessync_prod

# Drop and recreate database
DROP DATABASE IF EXISTS salessync_prod;
CREATE DATABASE salessync_prod;
\q
```

### Check Container Resources
```bash
# Monitor resource usage
docker stats

# Check container details
docker inspect salessync-backend-prod
docker inspect salessync-frontend-prod
docker inspect salessync-postgres-prod
```