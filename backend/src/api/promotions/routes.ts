import { Router } from 'express';
import simpleRoutes from './simple-routes';

const router = Router();

// Use simple routes for now
router.use('/', simpleRoutes);

export default router;