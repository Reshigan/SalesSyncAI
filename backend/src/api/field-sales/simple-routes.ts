import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get agent's dashboard data
router.get('/dashboard', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's visits
    const todayVisits = await prisma.visit.findMany({
      where: {
        agentId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        customer: {
          select: {
            name: true,
            address: true
          }
        }
      }
    });

    // Get recent sales
    const recentSales = await prisma.sale.findMany({
      where: {
        agentId,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        customer: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // Calculate totals
    const totalSales = recentSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
    const visitCount = todayVisits.length;

    res.json({
      success: true,
      data: {
        todayVisits: visitCount,
        recentSales: recentSales.length,
        totalSalesValue: totalSales,
        visits: todayVisits,
        sales: recentSales
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard data'
    });
  }
});

// Get warehouses
router.get('/warehouses', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;

    const warehouses = await prisma.warehouse.findMany({
      where: {
        companyId
      }
    });

    res.json({
      success: true,
      data: warehouses
    });
  } catch (error) {
    console.error('Warehouses error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load warehouses'
    });
  }
});

// Get visits
router.get('/visits', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const { status, limit = 20 } = req.query;

    const where: any = { agentId };
    if (status) {
      where.status = status;
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        customer: {
          select: {
            name: true,
            address: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Number(limit)
    });

    res.json({
      success: true,
      data: visits
    });
  } catch (error) {
    console.error('Visits error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load visits'
    });
  }
});

// Create a new visit
router.post('/visits', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const { customerId, notes, location } = req.body;

    const visit = await prisma.visit.create({
      data: {
        companyId: req.user!.companyId,
        agentId,
        customerId,
        visitDate: new Date(),
        notes: notes || '',
        status: 'PLANNED'
      },
      include: {
        customer: {
          select: {
            name: true,
            address: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: visit
    });
  } catch (error) {
    console.error('Create visit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create visit'
    });
  }
});

// Start a visit
router.put('/visits/:id/start', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { location } = req.body;
    const agentId = req.user!.id;

    const visit = await prisma.visit.findFirst({
      where: { id, agentId }
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualStartTime: new Date()
      },
      include: {
        customer: {
          select: {
            name: true,
            address: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedVisit
    });
  } catch (error) {
    console.error('Start visit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start visit'
    });
  }
});

// Complete a visit
router.put('/visits/:id/complete', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { notes, location } = req.body;
    const agentId = req.user!.id;

    const visit = await prisma.visit.findFirst({
      where: { id, agentId }
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        notes: notes || visit.notes
      },
      include: {
        customer: {
          select: {
            name: true,
            address: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedVisit
    });
  } catch (error) {
    console.error('Complete visit error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete visit'
    });
  }
});

// Get customers
router.get('/customers', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const companyId = req.user!.companyId;
    const { search, limit = 50 } = req.query;

    const where: any = { companyId };
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } }
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: {
        name: 'asc'
      },
      take: Number(limit)
    });

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error('Customers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load customers'
    });
  }
});

// Get sales
router.get('/sales', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const { limit = 20 } = req.query;

    const sales = await prisma.sale.findMany({
      where: { agentId },
      include: {
        customer: {
          select: {
            name: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Number(limit)
    });

    res.json({
      success: true,
      data: sales
    });
  } catch (error) {
    console.error('Sales error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load sales'
    });
  }
});

// Create a sale
router.post('/sales', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const agentId = req.user!.id;
    const { customerId, visitId, items, paymentMethod, totalAmount } = req.body;

    // Create the sale
    const sale = await prisma.sale.create({
      data: {
        companyId: req.user!.companyId,
        agentId,
        customerId,
        visitId: visitId || null,
        invoiceNumber: `INV-${Date.now()}`,
        totalAmount: Number(totalAmount),
        paymentMethod: paymentMethod || 'CASH',
        paymentStatus: 'PAID'
      }
    });

    // Create sale items
    if (items && items.length > 0) {
      await prisma.saleItem.createMany({
        data: items.map((item: any) => ({
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          total: Number(item.quantity * item.unitPrice),
          discount: Number(item.discount || 0)
        }))
      });
    }

    // Get the complete sale with items
    const completeSale = await prisma.sale.findFirst({
      where: { id: sale.id },
      include: {
        customer: {
          select: {
            name: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: completeSale
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sale'
    });
  }
});

export default router;