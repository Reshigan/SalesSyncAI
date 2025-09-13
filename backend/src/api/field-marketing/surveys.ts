import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all surveys for a company
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveys = await prisma.brandQuestionnaire.findMany({
      where: {
        brand: {
          companyId: req.user!.companyId
        }
      },
      include: {
        brand: true,
        questions: {
          orderBy: {
            order: 'asc'
          }
        },
        responses: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            },
            customer: true,
            answers: true
          }
        }
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
    const survey = await prisma.brandQuestionnaire.findFirst({
      where: {
        id: req.params.id,
        brand: {
          companyId: req.user!.companyId
        }
      },
      include: {
        brand: true,
        questions: {
          orderBy: {
            order: 'asc'
          }
        },
        responses: {
          include: {
            agent: {
              select: {
                id: true,
                email: true,
                profile: true
              }
            },
            customer: true,
            answers: {
              include: {
                question: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
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
      brandId,
      estimatedDuration,
      incentivePerCompletion,
      questions
    } = req.body;

    // Verify brand belongs to company
    const brand = await prisma.brand.findFirst({
      where: {
        id: brandId,
        companyId: req.user!.companyId
      }
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }

    const survey = await prisma.brandQuestionnaire.create({
      data: {
        brandId,
        estimatedDuration: estimatedDuration || 5,
        incentivePerCompletion: incentivePerCompletion || 0,
        questions: {
          create: questions?.map((q: any, index: number) => ({
            questionText: q.questionText,
            type: q.type,
            required: q.required || false,
            options: q.options || [],
            photoRequirements: q.photoRequirements || {},
            validationRules: q.validationRules || {},
            order: index
          })) || []
        }
      },
      include: {
        brand: true,
        questions: {
          orderBy: {
            order: 'asc'
          }
        }
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
    const {
      customerId,
      location,
      answers,
      completionTime,
      qualityScore
    } = req.body;

    const surveyId = req.params.id;

    // Verify survey exists and belongs to company
    const survey = await prisma.brandQuestionnaire.findFirst({
      where: {
        id: surveyId,
        brand: {
          companyId: req.user!.companyId
        }
      },
      include: {
        questions: true
      }
    });

    if (!survey) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    // Create survey response
    const response = await prisma.surveyResponse.create({
      data: {
        questionnaireId: surveyId,
        agentId: req.user!.id,
        customerId,
        location: location || {},
        completionTime: completionTime || 0,
        qualityScore: qualityScore || 100,
        answers: {
          create: answers?.map((answer: any) => ({
            questionId: answer.questionId,
            answerText: answer.answerText,
            answerOptions: answer.answerOptions || [],
            answerNumber: answer.answerNumber,
            photoUrls: answer.photoUrls || [],
            metadata: answer.metadata || {}
          })) || []
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        },
        customer: true,
        answers: {
          include: {
            question: true
          }
        }
      }
    });

    // Calculate incentive if applicable
    if (survey.incentivePerCompletion > 0) {
      // Add incentive to agent's earnings (this would integrate with payroll system)
      console.log(`Agent ${req.user!.id} earned ${survey.incentivePerCompletion} for survey completion`);
    }

    res.status(201).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit survey response'
    });
  }
});

// Get survey responses for agent
router.get('/responses/my', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 20, surveyId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      agentId: req.user!.id
    };

    if (surveyId) {
      where.questionnaireId = surveyId;
    }

    const responses = await prisma.surveyResponse.findMany({
      where,
      include: {
        questionnaire: {
          include: {
            brand: true,
            questions: true
          }
        },
        customer: true,
        answers: {
          include: {
            question: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: Number(limit)
    });

    const total = await prisma.surveyResponse.count({ where });

    res.json({
      success: true,
      data: responses,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch survey responses'
    });
  }
});

// Get survey analytics
router.get('/:id/analytics', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const surveyId = req.params.id;

    // Verify survey belongs to company
    const survey = await prisma.brandQuestionnaire.findFirst({
      where: {
        id: surveyId,
        brand: {
          companyId: req.user!.companyId
        }
      },
      include: {
        questions: true
      }
    });

    if (!survey) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    // Get all responses for this survey
    const responses = await prisma.surveyResponse.findMany({
      where: {
        questionnaireId: surveyId
      },
      include: {
        agent: {
          select: {
            id: true,
            email: true,
            profile: true
          }
        },
        answers: {
          include: {
            question: true
          }
        }
      }
    });

    // Calculate analytics
    const totalResponses = responses.length;
    const averageCompletionTime = responses.length > 0 
      ? responses.reduce((sum, r) => sum + r.completionTime, 0) / responses.length 
      : 0;
    const averageQualityScore = responses.length > 0
      ? responses.reduce((sum, r) => sum + r.qualityScore, 0) / responses.length
      : 0;

    // Agent performance
    const agentStats = responses.reduce((acc, response) => {
      const agentId = response.agentId;
      if (!acc[agentId]) {
        acc[agentId] = {
          agent: response.agent,
          responseCount: 0,
          averageTime: 0,
          averageQuality: 0
        };
      }
      acc[agentId].responseCount++;
      acc[agentId].averageTime = (acc[agentId].averageTime + response.completionTime) / acc[agentId].responseCount;
      acc[agentId].averageQuality = (acc[agentId].averageQuality + response.qualityScore) / acc[agentId].responseCount;
      return acc;
    }, {} as any);

    // Question analytics
    const questionStats = survey.questions.map(question => {
      const questionAnswers = responses.flatMap(r => 
        r.answers.filter(a => a.questionId === question.id)
      );

      let analytics: any = {
        question: question.questionText,
        type: question.type,
        totalAnswers: questionAnswers.length,
        responseRate: totalResponses > 0 ? (questionAnswers.length / totalResponses) * 100 : 0
      };

      // Type-specific analytics
      if (question.type === 'MULTIPLE_CHOICE') {
        const optionCounts = questionAnswers.reduce((acc, answer) => {
          (answer.answerOptions || []).forEach(option => {
            acc[option] = (acc[option] || 0) + 1;
          });
          return acc;
        }, {} as any);
        analytics.optionDistribution = optionCounts;
      } else if (question.type === 'RATING') {
        const ratings = questionAnswers
          .map(a => a.answerNumber)
          .filter(n => n !== null && n !== undefined);
        analytics.averageRating = ratings.length > 0 
          ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
          : 0;
        analytics.ratingDistribution = ratings.reduce((acc, rating) => {
          acc[rating] = (acc[rating] || 0) + 1;
          return acc;
        }, {} as any);
      }

      return analytics;
    });

    // Daily response trends
    const dailyStats = responses.reduce((acc, response) => {
      const date = response.createdAt.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as any);

    const analytics = {
      totalResponses,
      averageCompletionTime: Math.round(averageCompletionTime * 100) / 100,
      averageQualityScore: Math.round(averageQualityScore * 100) / 100,
      agentPerformance: Object.values(agentStats),
      questionAnalytics: questionStats,
      dailyResponseTrends: dailyStats,
      completionRate: survey.questions.length > 0 
        ? (responses.length / survey.questions.length) * 100 
        : 0
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching survey analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch survey analytics'
    });
  }
});

export default router;