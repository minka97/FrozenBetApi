import { Router } from 'express';
import { CompetitionService } from '../services/competition.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
const competitionService = new CompetitionService();

/**
 * @swagger
 * /api/competitions:
 *   get:
 *     summary: Get all competitions
 *     tags: [Competitions]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, active, finished]
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
 *         description: List of competitions
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await competitionService.getCompetitions({
      status: status as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    sendSuccess(res, result.competitions, 'Success', 200, result.meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/competitions:
 *   post:
 *     summary: Create a new competition
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - themeId
 *               - name
 *               - startDate
 *               - endDate
 *             properties:
 *               themeId:
 *                 type: integer
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               season:
 *                 type: string
 *     responses:
 *       201:
 *         description: Competition created successfully
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const competition = await competitionService.createCompetition(req.body);
    sendSuccess(res, competition, 'Competition created', 201);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/competitions/{id}:
 *   get:
 *     summary: Get competition by ID
 *     tags: [Competitions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Competition details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const competition = await competitionService.getCompetitionById(parseInt(req.params.id));
    sendSuccess(res, competition);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/competitions/{id}:
 *   put:
 *     summary: Update a competition
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               season:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [upcoming, active, finished]
 *     responses:
 *       200:
 *         description: Competition updated successfully
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const competition = await competitionService.updateCompetition(parseInt(req.params.id), req.body);
    sendSuccess(res, competition);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/competitions/{id}:
 *   delete:
 *     summary: Delete a competition
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Competition deleted successfully
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await competitionService.deleteCompetition(parseInt(req.params.id));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/competitions/{id}/matches:
 *   get:
 *     summary: Get all matches in a competition
 *     tags: [Competitions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of matches
 */
router.get('/:id/matches', async (req, res, next) => {
  try {
    const matches = await competitionService.getCompetitionMatches(parseInt(req.params.id));
    sendSuccess(res, matches);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/competitions/{id}/teams:
 *   get:
 *     summary: Get all teams in a competition
 *     tags: [Competitions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of teams
 */
router.get('/:id/teams', async (req, res, next) => {
  try {
    const teams = await competitionService.getCompetitionTeams(parseInt(req.params.id));
    sendSuccess(res, teams);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/competitions/{id}/standings:
 *   get:
 *     summary: Get competition standings
 *     tags: [Competitions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Competition standings
 */
router.get('/:id/standings', async (req, res, next) => {
  try {
    const standings = await competitionService.getCompetitionStandings(parseInt(req.params.id));
    sendSuccess(res, standings);
  } catch (error) {
    next(error);
  }
});

export default router;
