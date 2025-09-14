import { Router } from 'express';
import simpleRoutes from './simple-routes';
import advancedAnalyticsRouter from './advanced-analytics';
import realTimeDashboardRouter from './realtime-dashboard';

const router = Router();

// Use simple routes for basic functionality
router.use('/', simpleRoutes);

// Mount advanced analytics routes
router.use('/analytics', advancedAnalyticsRouter);

// Mount real-time dashboard routes
router.use('/realtime', realTimeDashboardRouter);

export default router;