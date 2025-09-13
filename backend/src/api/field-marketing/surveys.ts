import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all surveys for a company
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveys = await prisma.survey.findMany({
      where: {
        companyId: req.user!.companyId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: surveys
    });
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch surveys'
    });
  }
});

// Get survey by ID
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const survey = await prisma.survey.findFirst({
      where: {
        id: req.params.id,
        companyId: req.user!.companyId
      }
    });

    if (!survey) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      data: survey
    });
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch survey'
    });
  }
});

// Create new survey
router.post('/', authenticateToken, requireRole(['COMPANY_ADMIN', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title,
      description,
      questions,
      isActive
    } = req.body;

    const survey = await prisma.survey.create({
      data: {
        companyId: req.user!.companyId,
        title,
        description,
        questions: questions || [],
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({
      success: true,
      data: survey
    });
  } catch (error) {
    console.error('Error creating survey:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create survey'
    });
  }
});

// Submit survey response
router.post('/:id/responses', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { responses, visitId } = req.body;

    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        surveyId: req.params.id,
        agentId: req.user!.id,
        visitId: visitId || null,
        responses: responses || {},
        completionTime: 0 // Will be calculated based on actual completion time
      }
    });

    res.status(201).json({
      success: true,
      data: surveyResponse
    });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit survey response'
    });
  }
});

export default router;