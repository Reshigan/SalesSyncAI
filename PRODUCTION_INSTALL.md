# 🚀 SalesSync AI - Production Installation

## ⚡ Quick Installation

```bash
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI
chmod +x install-production.sh
./install-production.sh
```

## 🔐 Demo Login Credentials

- **Admin**: demo@techcorp.com / Demo123!
- **Manager**: manager@techcorp.com / Manager123!
- **Agent**: agent1@techcorp.com / Agent123!

## 📋 Prerequisites

- Ubuntu 20.04+ or CentOS 8+
- 4GB RAM, 20GB Storage
- Ports 80, 443, 3000, 3001 available

## 🛠️ Manual Installation

### 1. Install Docker & Docker Compose
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Deploy Application
```bash
# Clone repository
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI

# Stop conflicting services
sudo systemctl stop nginx apache2 2>/dev/null || true

# Deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Seed database
sleep 60
docker-compose -f docker-compose.prod.yml exec backend node seed-production-demo.js
```

## 🔧 Management Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Update application
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🔍 Troubleshooting

### Port Conflicts
```bash
# Check port usage
sudo lsof -i :80
sudo lsof -i :3001

# Stop conflicting services
sudo systemctl stop nginx apache2
```

### Database Issues
```bash
# Reset database
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
sleep 60
docker-compose -f docker-compose.prod.yml exec backend node seed-production-demo.js
```

### View Container Logs
```bash
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend
```

## ✅ Success Indicators

- ✅ Frontend: http://your-server-ip
- ✅ Backend API: http://your-server-ip:3001/api/health
- ✅ Demo login works with provided credentials
- ✅ All containers running: `docker-compose -f docker-compose.prod.yml ps`