import express from 'express';
import { requireRole } from '../../middleware/auth';

const router = express.Router();

// Field marketing routes - accessible by field marketing agents and managers
router.use(requireRole(['FIELD_MARKETING_AGENT', 'SENIOR_AGENT', 'TEAM_LEADER', 'AREA_MANAGER', 'REGIONAL_MANAGER', 'COMPANY_ADMIN']));

/**
 * @swagger
 * /api/field-marketing/campaigns:
 *   get:
 *     summary: Get active marketing campaigns
 *     tags: [Field Marketing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaigns retrieved successfully
 */
router.get('/campaigns', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Field Marketing routes - Coming soon'
  });
});

/**
 * @swagger
 * /api/field-marketing/surveys:
 *   post:
 *     summary: Submit survey response
 *     tags: [Field Marketing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Survey response submitted
 */
router.post('/surveys', (req, res) => {
  res.json({
    success: true,
    message: 'Field Marketing routes - Coming soon'
  });
});

/**
 * @swagger
 * /api/field-marketing/customer-acquisition:
 *   post:
 *     summary: Register new customer
 *     tags: [Field Marketing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Customer registered successfully
 */
router.post('/customer-acquisition', (req, res) => {
  res.json({
    success: true,
    message: 'Field Marketing routes - Coming soon'
  });
});

export default router;