import express from 'express';
import { requireRole } from '../../middleware/auth';

const router = express.Router();

// Field sales routes - accessible by field sales agents and managers
router.use(requireRole(['FIELD_SALES_AGENT', 'SENIOR_AGENT', 'TEAM_LEADER', 'AREA_MANAGER', 'REGIONAL_MANAGER', 'COMPANY_ADMIN']));

/**
 * @swagger
 * /api/field-sales/visits:
 *   get:
 *     summary: Get agent visits
 *     tags: [Field Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Visits retrieved successfully
 */
router.get('/visits', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Field Sales routes - Coming soon'
  });
});

/**
 * @swagger
 * /api/field-sales/stock-draw:
 *   post:
 *     summary: Create stock draw request
 *     tags: [Field Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Stock draw request created
 */
router.post('/stock-draw', (req, res) => {
  res.json({
    success: true,
    message: 'Field Sales routes - Coming soon'
  });
});

/**
 * @swagger
 * /api/field-sales/cash-reconciliation:
 *   post:
 *     summary: Submit daily cash reconciliation
 *     tags: [Field Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Cash reconciliation submitted
 */
router.post('/cash-reconciliation', (req, res) => {
  res.json({
    success: true,
    message: 'Field Sales routes - Coming soon'
  });
});

export default router;