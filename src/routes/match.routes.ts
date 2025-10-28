import { Router } from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { PredictionService } from '../services/prediction.service';
import { MatchService } from '../services/match.service';

const router = Router();
const predictionService = new PredictionService();
const matchService = new MatchService();

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: Get all matches
 *     tags: [Matches]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, live, finished, postponed, cancelled]
 *       - in: query
 *         name: competitionId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of matches
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, competitionId, page, limit } = req.query;
    const pageNumber = page ? parseInt(page as string) : 1;
    const limitNumber = limit ? parseInt(limit as string) : 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where: any = {};
    if (status) where.status = status;
    if (competitionId) where.competitionId = parseInt(competitionId as string);

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { scheduledDate: 'asc' },
        skip,
        take: limitNumber,
      }),
      prisma.match.count({ where }),
    ]);

    const meta = {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    };

    sendSuccess(res, matches, 'Matches retrieved successfully', 200, meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/matches/upcoming:
 *   get:
 *     summary: Get upcoming matches
 *     tags: [Matches]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of upcoming matches
 */
router.get('/upcoming', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const pageNumber = page ? parseInt(page as string) : 1;
    const limitNumber = limit ? parseInt(limit as string) : 50;
    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      status: 'scheduled',
      scheduledDate: {
        gt: new Date(),
      },
    };

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true,
        },
        orderBy: { scheduledDate: 'asc' },
        skip,
        take: limitNumber,
      }),
      prisma.match.count({ where }),
    ]);

    const meta = {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    };

    sendSuccess(res, matches, 'Upcoming matches retrieved successfully', 200, meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/matches/live:
 *   get:
 *     summary: Get live matches
 *     tags: [Matches]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of live matches
 */
router.get('/live', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const pageNumber = page ? parseInt(page as string) : 1;
    const limitNumber = limit ? parseInt(limit as string) : 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      status: 'live',
    };

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true,
        },
        orderBy: { scheduledDate: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.match.count({ where }),
    ]);

    const meta = {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    };

    sendSuccess(res, matches, 'Live matches retrieved successfully', 200, meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/matches/{id}:
 *   get:
 *     summary: Get match details
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Match details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
    });

    if (!match) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Match not found',
        },
      });
      return;
    }

    sendSuccess(res, match);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/matches/{matchId}/groups/{groupId}/predictions:
 *   get:
 *     summary: Get predictions for a match in a group
 *     tags: [Matches]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of predictions
 */
router.get('/:matchId/groups/:groupId/predictions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const predictions = await predictionService.getMatchPredictions(
      parseInt(req.params.matchId),
      parseInt(req.params.groupId),
      req.user!.userId
    );

    sendSuccess(res, predictions);
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const match = await matchService.createMatch(req.body);
    sendSuccess(res, match, 'Match created successfully', 201);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const match = await matchService.updateMatch(parseInt(req.params.id), req.body);
    sendSuccess(res, match, 'Match updated successfully');
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await matchService.deleteMatch(parseInt(req.params.id));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/score', authenticate, async (req, res, next) => {
  try {
    const { homeScore, awayScore } = req.body;
    const match = await matchService.updateScore(
      parseInt(req.params.id),
      homeScore,
      awayScore
    );
    sendSuccess(res, match, 'Score updated and points calculated');
  } catch (error) {
    next(error);
  }
});

router.get('/finished', async (req, res, next) => {
  try {
    const matches = await matchService.getFinishedMatches();
    sendSuccess(res, matches);
  } catch (error) {
    next(error);
  }
});

export default router;
