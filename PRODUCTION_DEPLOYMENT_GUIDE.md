# SalesSyncAI Production Deployment Guide

This guide provides comprehensive instructions for deploying and managing SalesSyncAI in a production environment.

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (local or remote)
- Node.js 18+ (for development)
- Git access to the repository

### Initial Deployment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Reshigan/SalesSyncAI.git
   cd SalesSyncAI
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.production.template backend/.env.production
   # Edit backend/.env.production with your production settings
   ```

3. **Deploy:**
   ```bash
   ./deploy-production.sh
   ```

## 📋 Environment Configuration

### Required Environment Variables

Create `backend/.env.production` with the following variables:

```env
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/salessyncai_prod"

# JWT Configuration
JWT_SECRET="your-super-secure-jwt-secret-key-change-this-in-production"
JWT_EXPIRES_IN="24h"

# CORS Configuration
CORS_ORIGIN="https://your-frontend-domain.com"

# API Configuration
API_VERSION="v1"

# Logging
LOG_LEVEL="info"

# Security
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Session Configuration
SESSION_SECRET="your-super-secure-session-secret-change-this-in-production"
```

### Security Considerations

1. **Change default secrets:** Always update JWT_SECRET and SESSION_SECRET
2. **Database security:** Use strong passwords and restrict database access
3. **CORS configuration:** Set CORS_ORIGIN to your actual frontend domain
4. **Rate limiting:** Adjust rate limits based on your expected traffic
5. **HTTPS:** Always use HTTPS in production (configure reverse proxy)

## 🐳 Docker Deployment

### Production Dockerfile

The production deployment uses `Dockerfile.production` which:
- Uses multi-stage builds for optimization
- Runs as non-root user for security
- Includes health checks
- Optimizes for production performance

### Container Management

**Start production container:**
```bash
./deploy-production.sh
```

**Update production deployment:**
```bash
git pull origin main
./update-production.sh
```

**View logs:**
```bash
docker logs -f salessyncai-prod
```

**Monitor container:**
```bash
docker stats salessyncai-prod
```

**Stop container:**
```bash
docker stop salessyncai-prod
```

## 🔄 Update Process

### Automated Updates

Use the provided update script for zero-downtime updates:

```bash
./update-production.sh
```

This script:
1. Creates a backup of the current container
2. Builds a new image with latest code
3. Runs database migrations
4. Starts the new container
5. Performs health checks
6. Rolls back automatically if deployment fails

### Manual Updates

If you prefer manual control:

```bash
# 1. Pull latest code
git pull origin main

# 2. Stop current container
docker stop salessyncai-prod
docker rename salessyncai-prod salessyncai-prod-backup

# 3. Build new image
docker build -f Dockerfile.production -t salessyncai:latest .

# 4. Run migrations
docker run --rm --network host -v $(pwd)/backend:/app/backend -w /app/backend node:18-alpine sh -c "npm install && npx prisma migrate deploy"

# 5. Start new container
docker run -d --name salessyncai-prod --network host --env-file backend/.env.production --restart unless-stopped salessyncai:latest

# 6. Verify deployment
curl -f http://localhost:3000/health

# 7. Remove backup (if successful)
docker rm salessyncai-prod-backup
```

## 🗄️ Database Management

### PostgreSQL Setup

**Using Docker:**
```bash
docker run -d \
  --name salessyncai-postgres \
  --network host \
  -e POSTGRES_DB=salessyncai_prod \
  -e POSTGRES_USER=salessyncai \
  -e POSTGRES_PASSWORD=secure_password_change_this \
  -v salessyncai_postgres_data:/var/lib/postgresql/data \
  postgres:13
```

**Using existing PostgreSQL:**
Update `DATABASE_URL` in `.env.production` to point to your database.

### Database Migrations

**Run migrations:**
```bash
cd backend
npx prisma migrate deploy
```

**Seed database:**
```bash
cd backend
npx prisma db seed
```

### Backup and Restore

**Create backup:**
```bash
docker exec salessyncai-postgres pg_dump -U salessyncai salessyncai_prod > backup.sql
```

**Restore backup:**
```bash
docker exec -i salessyncai-postgres psql -U salessyncai salessyncai_prod < backup.sql
```

## 🔍 Monitoring and Logging

### Health Checks

The application provides several health check endpoints:

- `GET /health` - Basic health check
- `GET /api/auth/me` - Authentication check (requires token)

### Logging

Logs are stored in the `/app/logs` directory inside the container and mounted to `./logs` on the host.

**View real-time logs:**
```bash
docker logs -f salessyncai-prod
```

**View application logs:**
```bash
tail -f logs/application.log
```

### Monitoring

**Container stats:**
```bash
docker stats salessyncai-prod
```

**Database monitoring:**
```bash
docker exec salessyncai-postgres psql -U salessyncai -d salessyncai_prod -c "SELECT * FROM pg_stat_activity;"
```

## 🔧 Troubleshooting

### Common Issues

**Container won't start:**
1. Check environment variables in `.env.production`
2. Verify database connectivity
3. Check Docker logs: `docker logs salessyncai-prod`

**Database connection errors:**
1. Verify DATABASE_URL format
2. Check PostgreSQL is running
3. Verify network connectivity

**Health check failures:**
1. Check if application is binding to correct port
2. Verify no port conflicts
3. Check application logs for errors

**Performance issues:**
1. Monitor container resources: `docker stats`
2. Check database performance
3. Review application logs for slow queries

### Debug Mode

To run in debug mode:

```bash
docker run -it --rm \
  --network host \
  --env-file backend/.env.production \
  -e LOG_LEVEL=debug \
  salessyncai:latest
```

## 🔐 Security Best Practices

1. **Use HTTPS:** Configure a reverse proxy (nginx/Apache) with SSL
2. **Firewall:** Restrict access to necessary ports only
3. **Regular updates:** Keep Docker images and dependencies updated
4. **Secrets management:** Use Docker secrets or external secret management
5. **Database security:** Use connection pooling and prepared statements
6. **Monitoring:** Set up log monitoring and alerting

## 📊 Performance Optimization

### Production Optimizations

1. **Database indexing:** Ensure proper indexes on frequently queried columns
2. **Connection pooling:** Configure Prisma connection pool
3. **Caching:** Implement Redis for session and data caching
4. **CDN:** Use CDN for static assets
5. **Load balancing:** Use multiple container instances behind a load balancer

### Scaling

**Horizontal scaling:**
```bash
# Run multiple instances
docker run -d --name salessyncai-prod-1 -p 3001:3000 --env-file backend/.env.production salessyncai:latest
docker run -d --name salessyncai-prod-2 -p 3002:3000 --env-file backend/.env.production salessyncai:latest
```

**Database scaling:**
- Use read replicas for read-heavy workloads
- Implement database sharding for large datasets
- Consider managed database services (AWS RDS, Google Cloud SQL)

## 🚨 Disaster Recovery

### Backup Strategy

1. **Database backups:** Daily automated backups
2. **Application data:** Backup uploaded files and logs
3. **Configuration:** Version control all configuration files

### Recovery Procedures

1. **Application recovery:** Use update script to rollback to previous version
2. **Database recovery:** Restore from latest backup
3. **Full system recovery:** Redeploy from scratch using this guide

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review application logs
3. Check GitHub issues
4. Contact the development team

---

## 🎯 Production Checklist

Before going live, ensure:

- [ ] Environment variables configured
- [ ] Database properly set up and migrated
- [ ] SSL/HTTPS configured
- [ ] Firewall rules in place
- [ ] Monitoring and alerting set up
- [ ] Backup procedures tested
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Documentation updated
- [ ] Team trained on deployment procedures