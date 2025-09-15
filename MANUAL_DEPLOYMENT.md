# 🛠️ Manual Deployment Guide for IP Access

If Docker builds are failing, you can deploy the application manually. This guide provides step-by-step instructions for manual deployment on the server with IP `13.247.192.46`.

## 🚨 When to Use Manual Deployment

Use this guide when:
- Docker builds fail due to package installation issues
- You need to quickly get the application running
- You want more control over the deployment process
- Docker resources are limited

## 📋 Prerequisites

Ensure the following are installed on your server:
- Node.js 18+ (`node --version`)
- npm (`npm --version`)
- PostgreSQL 15+ (`psql --version`)
- Redis (`redis-cli --version`)

## 🗄️ Step 1: Set Up Database Services

### Option A: Using Docker for Database Only
```bash
# Start only PostgreSQL and Redis with Docker
docker run -d --name salessync-postgres \
  -e POSTGRES_DB=salessync \
  -e POSTGRES_USER=salessync \
  -e POSTGRES_PASSWORD=salessync123 \
  -p 5432:5432 \
  postgres:15-alpine

docker run -d --name salessync-redis \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass redis123
```

### Option B: Native Installation
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-15 redis-server

# CentOS/RHEL
sudo yum install postgresql15-server redis

# Configure PostgreSQL
sudo -u postgres createuser salessync
sudo -u postgres createdb salessync -O salessync
sudo -u postgres psql -c "ALTER USER salessync PASSWORD 'salessync123';"

# Start services
sudo systemctl start postgresql redis
sudo systemctl enable postgresql redis
```

## 🔧 Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```bash
cd /path/to/SalesSyncAI
cat > .env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://salessync:salessync123@localhost:5432/salessync
POSTGRES_DB=salessync
POSTGRES_USER=salessync
POSTGRES_PASSWORD=salessync123

# Redis Configuration
REDIS_URL=redis://:redis123@localhost:6379
REDIS_PASSWORD=redis123

# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
FRONTEND_URL=http://13.247.192.46
CORS_ORIGIN=http://13.247.192.46

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-$(date +%s)
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production-$(date +%s)
ENCRYPTION_KEY=your-32-character-encryption-key-$(date +%s | cut -c1-8)
EOF
```

## 🚀 Step 3: Deploy Backend

```bash
cd backend

# Install dependencies
npm install --legacy-peer-deps --no-optional

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed the database (optional)
node seed-demo-simple.js

# Start the backend server
NODE_ENV=production PORT=3001 HOST=0.0.0.0 node src/index.js
```

### Run Backend as Service (Optional)
Create a systemd service for the backend:

```bash
sudo tee /etc/systemd/system/salessync-backend.service > /dev/null << 'EOF'
[Unit]
Description=SalesSync Backend API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/SalesSyncAI/backend
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOST=0.0.0.0
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable salessync-backend
sudo systemctl start salessync-backend
```

## 🎨 Step 4: Deploy Frontend

### Option A: Development Server (Quick)
```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Create environment file
echo "REACT_APP_API_URL=http://13.247.192.46/api" > .env.local

# Start development server
REACT_APP_API_URL=http://13.247.192.46/api npm start -- --host 0.0.0.0 --port 3000
```

### Option B: Production Build (Recommended)
```bash
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Build for production
REACT_APP_API_URL=http://13.247.192.46/api npm run build

# Serve with a simple HTTP server
npx serve -s build -l 3000 --host 0.0.0.0
```

### Option C: Nginx Static Files
```bash
# Build the frontend
cd frontend
REACT_APP_API_URL=http://13.247.192.46/api npm run build

# Copy to nginx directory
sudo cp -r build/* /var/www/html/

# Configure nginx
sudo tee /etc/nginx/sites-available/salessync > /dev/null << 'EOF'
server {
    listen 80;
    server_name 13.247.192.46 _;
    root /var/www/html;
    index index.html;

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/salessync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔍 Step 5: Verify Deployment

### Test Backend
```bash
# Health check
curl http://localhost:3001/health

# API test
curl http://localhost:3001/api/health

# From external
curl http://13.247.192.46:3001/health
```

### Test Frontend
```bash
# Local test
curl http://localhost:3000

# External test
curl http://13.247.192.46:3000
curl http://13.247.192.46  # if using nginx
```

### Test Database Connection
```bash
# PostgreSQL
psql -h localhost -U salessync -d salessync -c "SELECT version();"

# Redis
redis-cli -h localhost -p 6379 -a redis123 ping
```

## 🔧 Step 6: Configure Firewall

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --add-port=80/tcp --permanent
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --add-port=3001/tcp --permanent
sudo firewall-cmd --reload
```

## 🛠️ Troubleshooting

### Backend Issues

**Issue**: `Cannot connect to database`
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"

# Check connection
psql -h localhost -U salessync -d salessync -c "SELECT 1;"
```

**Issue**: `Redis connection failed`
```bash
# Check Redis status
sudo systemctl status redis
redis-cli ping

# Test with password
redis-cli -a redis123 ping
```

**Issue**: `Port already in use`
```bash
# Find process using port 3001
sudo lsof -i :3001
sudo netstat -tulpn | grep :3001

# Kill process if needed
sudo kill -9 <PID>
```

### Frontend Issues

**Issue**: `API calls failing`
- Check CORS configuration in backend
- Verify API URL in frontend environment
- Test backend endpoints directly

**Issue**: `Build fails`
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Network Issues

**Issue**: `Cannot access from external IP`
```bash
# Check if services bind to all interfaces
netstat -tulpn | grep -E ":(80|3000|3001)"

# Should show 0.0.0.0:PORT, not 127.0.0.1:PORT
```

**Issue**: `Firewall blocking connections`
```bash
# Check firewall status
sudo ufw status  # Ubuntu
sudo firewall-cmd --list-all  # CentOS

# Temporarily disable for testing
sudo ufw disable  # Ubuntu
sudo systemctl stop firewalld  # CentOS
```

## 📊 Monitoring

### Process Monitoring
```bash
# Check running processes
ps aux | grep -E "(node|nginx|postgres|redis)"

# Monitor logs
tail -f /var/log/nginx/access.log
journalctl -u salessync-backend -f
```

### Resource Monitoring
```bash
# System resources
htop
df -h
free -h

# Network connections
netstat -tulpn
ss -tulpn
```

## 🔄 Service Management

### Start Services
```bash
# Database services
sudo systemctl start postgresql redis

# Application services
sudo systemctl start salessync-backend nginx

# Or manually
cd backend && node src/index.js &
cd frontend && npx serve -s build -l 3000 &
```

### Stop Services
```bash
# System services
sudo systemctl stop salessync-backend nginx

# Manual processes
pkill -f "node src/index.js"
pkill -f "serve -s build"
```

### Restart Services
```bash
sudo systemctl restart salessync-backend nginx postgresql redis
```

## 🎉 Success Indicators

Your manual deployment is successful when:

- ✅ Backend responds: `curl http://13.247.192.46:3001/health`
- ✅ Frontend loads: `curl http://13.247.192.46:3000` or `http://13.247.192.46`
- ✅ API accessible: `curl http://13.247.192.46/api/health`
- ✅ Database connected: No connection errors in backend logs
- ✅ External access works: Can access from browser outside the server

## 📞 Quick Commands Reference

```bash
# Check all services
sudo systemctl status postgresql redis nginx salessync-backend

# View logs
journalctl -u salessync-backend -f
tail -f /var/log/nginx/error.log

# Test connectivity
curl http://13.247.192.46/health
curl http://13.247.192.46/api/health
curl http://13.247.192.46:3001/health

# Restart everything
sudo systemctl restart postgresql redis salessync-backend nginx
```

This manual deployment approach gives you full control and should work even when Docker builds fail!