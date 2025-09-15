#!/bin/bash
echo "🚀 Installing SalesSyncAI on Ubuntu 22.04..."

# Remove conflicting packages
sudo apt remove -y docker docker-engine docker.io containerd runc containerd.io 2>/dev/null

# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt update

# Install Docker Engine
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Install docker-compose (standalone)
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clean up any existing installation
cd ~
sudo rm -rf SalesSyncAI

# Clone repository
git clone https://github.com/Reshigan/SalesSyncAI.git
cd SalesSyncAI

# Verify files exist
if [ ! -f "docker-compose.production.yml" ]; then
    echo "❌ docker-compose.production.yml not found!"
    ls -la
    exit 1
fi

# Clean Docker system
sudo docker system prune -af --volumes 2>/dev/null || true

# Start deployment
echo "🚀 Starting deployment..."
sudo docker-compose -f docker-compose.production.yml up -d

# Wait for containers
echo "⏳ Waiting for containers to start..."
sleep 30

# Check container status
echo "📊 Container status:"
sudo docker ps

# Setup database
echo "🗄️ Setting up database..."
sudo docker exec salessync-postgres psql -U postgres -c "DROP DATABASE IF EXISTS salessync_prod; CREATE DATABASE salessync_prod;" 2>/dev/null

# Create tables
echo "📋 Creating tables..."
sudo docker exec salessync-backend npx prisma db push --force-reset

if [ $? -eq 0 ]; then
    echo "✅ Tables created successfully!"
    
    # Generate Prisma client
    sudo docker exec salessync-backend npx prisma generate
    
    # Seed database
    echo "🌱 Seeding database..."
    sudo docker exec salessync-backend node -e "
    const{PrismaClient}=require('@prisma/client');
    const p=new PrismaClient();
    (async()=>{
        const c=await p.company.upsert({
            where:{slug:'demo'},
            update:{},
            create:{name:'Demo Company',slug:'demo',description:'Demo',isActive:true}
        });
        const u=await p.user.upsert({
            where:{email:'admin@demo.com'},
            update:{},
            create:{
                email:'admin@demo.com',
                password:'\$2b\$10\$rQZ9QmjQZ9QmjQZ9QmjQZO',
                name:'Admin',
                role:'ADMIN',
                isActive:true,
                companyId:c.id
            }
        });
        console.log('✅ Seeded:',c.name,u.name);
        await p.\$disconnect();
    })().catch(e=>{console.error('❌ Seed error:',e);process.exit(1)});
    "
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 INSTALLATION COMPLETE!"
        echo ""
        PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "localhost")
        echo "🌐 Access your application:"
        echo "Frontend: http://$PUBLIC_IP:8080"
        echo "Backend API: http://$PUBLIC_IP:3001/api"
        echo "Health Check: http://$PUBLIC_IP:3001/health"
        echo ""
        echo "🔐 Demo Login:"
        echo "Email: admin@demo.com"
        echo "Password: password123"
        echo ""
        echo "📊 Container Status:"
        sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "⚠️  Note: You may need to logout and login again for Docker permissions"
        echo "⚠️  Make sure ports 8080 and 3001 are open in your AWS Security Group"
    else
        echo "❌ Database seeding failed"
        echo "📋 Backend logs:"
        sudo docker logs salessync-backend --tail 20
    fi
else
    echo "❌ Failed to create database tables"
    echo "📋 Backend logs:"
    sudo docker logs salessync-backend --tail 20
    echo "📋 PostgreSQL logs:"
    sudo docker logs salessync-postgres --tail 10
fi