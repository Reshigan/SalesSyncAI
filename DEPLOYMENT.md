# 🚀 SalesSyncAI Production Deployment

## Quick Start

### Option 1: Docker Deployment (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deploy-docker-production.sh -o deploy.sh
chmod +x deploy.sh && ./deploy.sh
```

### Option 2: Native Deployment
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/deploy-production-fixed.sh -o deploy.sh
chmod +x deploy.sh && ./deploy.sh
```

### Fix Port Conflicts
If you encounter port conflicts during deployment:
```bash
curl -fsSL https://raw.githubusercontent.com/Reshigan/SalesSyncAI/main/quick-fix-ports.sh -o fix-ports.sh
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