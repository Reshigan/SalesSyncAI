import express from 'express';
import { requireRole } from '../../middleware/auth';

const router = express.Router();

// Promotions routes - accessible by promoters and managers
router.use(requireRole(['PROMOTER', 'SENIOR_AGENT', 'TEAM_LEADER', 'AREA_MANAGER', 'REGIONAL_MANAGER', 'COMPANY_ADMIN']));

/**
 * @swagger
 * /api/promotions/activations:
 *   get:
 *     summary: Get assigned activations
 *     tags: [Promotions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Activations retrieved successfully
 */
router.get('/activations', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Promotions routes - Coming soon'
  });
});

/**
 * @swagger
 * /api/promotions/activations/{id}/start:
 *   post:
 *     summary: Start activation
 *     tags: [Promotions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activation started successfully
 */
router.post('/activations/:id/start', (req, res) => {
  res.json({
    success: true,
    message: 'Promotions routes - Coming soon'
  });
});

/**
 * @swagger
 * /api/promotions/activations/{id}/complete:
 *   post:
 *     summary: Complete activation
 *     tags: [Promotions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activation completed successfully
 */
router.post('/activations/:id/complete', (req, res) => {
  res.json({
    success: true,
    message: 'Promotions routes - Coming soon'
  });
});

export default router;