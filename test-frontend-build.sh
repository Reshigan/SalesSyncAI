#!/bin/bash

# Test frontend build in Docker
cd /workspace/project/SalesSyncAI/frontend

echo "Testing frontend build..."

# Try to build just the frontend
docker build -f Dockerfile.prod -t salessync-frontend-test .

if [ $? -eq 0 ]; then
    echo "✅ Frontend build successful!"
else
    echo "❌ Frontend build failed!"
    exit 1
fi