import { Router } from 'express';
import campaignsRouter from './campaigns';
import surveysRouter from './surveys';
import streetMarketingRouter from './street-marketing';

const router = Router();

// Mount field marketing routes
router.use('/campaigns', campaignsRouter);
router.use('/surveys', surveysRouter);
router.use('/street-marketing', streetMarketingRouter);

export default router;