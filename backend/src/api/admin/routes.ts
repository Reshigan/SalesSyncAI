import express from 'express';
import { requireRole } from '../../middleware/auth';

const router = express.Router();

// Super admin only routes
router.use(requireRole(['SUPER_ADMIN']));

/**
 * @swagger
 * /api/admin/companies:
 *   get:
 *     summary: Get all companies (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Companies retrieved successfully
 */
router.get('/companies', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Admin routes - Coming soon'
  });
});

/**
 * @swagger
 * /api/admin/companies:
 *   post:
 *     summary: Create new company (Super Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Company created successfully
 */
router.post('/companies', (req, res) => {
  res.json({
    success: true,
    message: 'Admin routes - Coming soon'
  });
});

export default router;