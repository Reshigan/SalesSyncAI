#!/bin/bash

echo "🔧 Fixing nginx configuration for IP/domain access..."

# Backup current config
cp nginx/conf.d/default.conf nginx/conf.d/default.conf.backup

# Use simple config that accepts any domain/IP
cp nginx/conf.d/default-simple.conf nginx/conf.d/default.conf

echo "✅ Nginx config updated to accept any domain/IP"
echo ""
echo "Now restart your deployment:"
echo "docker compose -f docker-compose.production.yml down"
echo "docker compose -f docker-compose.production.yml up -d --build"
echo ""
echo "Or if using native deployment:"
echo "sudo systemctl reload nginx"