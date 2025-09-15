#!/bin/bash

echo "🔍 Checking SalesSyncAI deployment status..."
echo ""

echo "📋 Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(salessync|nginx)" || echo "No SalesSyncAI containers found"
echo ""

echo "🌐 Nginx status:"
if command -v systemctl &> /dev/null; then
    sudo systemctl status nginx --no-pager -l || echo "Nginx service not found"
else
    echo "systemctl not available"
fi
echo ""

echo "🔌 Port usage:"
echo "Port 80 (HTTP):"
sudo netstat -tlnp | grep :80 || echo "Port 80 not in use"
echo ""
echo "Port 443 (HTTPS):"
sudo netstat -tlnp | grep :443 || echo "Port 443 not in use"
echo ""
echo "Port 3001 (Backend API):"
sudo netstat -tlnp | grep :3001 || echo "Port 3001 not in use"
echo ""

echo "🏥 Health checks:"
echo "Testing localhost:80..."
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:80/health || echo "Failed to connect to port 80"
echo ""
echo "Testing localhost:3001..."
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3001/health || echo "Failed to connect to port 3001"