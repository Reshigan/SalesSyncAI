import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import activationsRouter from './activations';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Promotions
 *   description: Campaign activation management and execution
 */

// Promotions routes - accessible by promoters and managers
router.use(requireRole(['PROMOTER', 'SENIOR_AGENT', 'TEAM_LEADER', 'AREA_MANAGER', 'REGIONAL_MANAGER', 'COMPANY_ADMIN']));

// Mount promotions sub-routes
router.use('/activations', activationsRouter);

export default router;