import { Router } from 'express';
import imageAnalysis from './image-analysis';
import predictiveAnalytics from './predictive-analytics';
import brandRecognition from './brand-recognition';

const router = Router();

// Mount sub-routes
router.use('/image-analysis', imageAnalysis);
router.use('/predictive-analytics', predictiveAnalytics);
router.use('/brand-recognition', brandRecognition);

export default router;