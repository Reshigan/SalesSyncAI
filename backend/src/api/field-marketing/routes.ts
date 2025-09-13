import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import campaignsRouter from './campaigns';
import surveysRouter from './surveys';
import streetMarketingRouter from './street-marketing';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Field Marketing
 *   description: Field marketing campaign management and execution
 */

// Field marketing routes - accessible by field marketing agents and managers
router.use(requireRole(['FIELD_MARKETING_AGENT', 'SENIOR_AGENT', 'TEAM_LEADER', 'AREA_MANAGER', 'REGIONAL_MANAGER', 'COMPANY_ADMIN']));

// Mount field marketing sub-routes
router.use('/campaigns', campaignsRouter);
router.use('/surveys', surveysRouter);
router.use('/street-marketing', streetMarketingRouter);

export default router;