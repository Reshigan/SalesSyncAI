const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 12000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'https://work-2-jefwwapjhrurlgsf.prod-runtime.all-hands.dev'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Basic auth endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user - need to search by email first since we don't know companyId
    const user = await prisma.user.findFirst({
      where: { email },
      include: { company: true }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Compare password with hash
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company
      },
      token: 'demo-token-' + user.id
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { company: true },
      take: 10
    });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get customers
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      take: 10
    });
    res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Customers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get visits
app.get('/api/visits', async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      include: {
        agent: true,
        customer: true
      },
      take: 10
    });
    res.json({ success: true, data: visits });
  } catch (error) {
    console.error('Visits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sales
app.get('/api/sales', async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        agent: true,
        customer: true,
        product: true
      },
      take: 10
    });
    res.json({ success: true, data: sales });
  } catch (error) {
    console.error('Sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [userCount, customerCount, visitCount, saleCount] = await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.visit.count(),
      prisma.sale.count()
    ]);
    
    res.json({
      success: true,
      data: {
        users: userCount,
        customers: customerCount,
        visits: visitCount,
        sales: saleCount
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 SalesSync Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`📈 Dashboard: http://localhost:${PORT}/api/dashboard/stats`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});