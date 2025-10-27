import { Router } from 'express';
import { TeamService } from '../services/team.service';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
const teamService = new TeamService();

/**
 * @swagger
 * /api/teams:
 *   get:
 *     summary: Get all teams
 *     tags: [Teams]
 *     parameters:
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
 *         description: List of teams
 */
router.get('/', async (req, res, next) => {
  try {
    const { competitionId, page, limit } = req.query;
    const result = await teamService.getTeams({
      competitionId: competitionId ? parseInt(competitionId as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    sendSuccess(res, result.teams, 'Success', 200, result.meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - competitionId
 *             properties:
 *               name:
 *                 type: string
 *               competitionId:
 *                 type: integer
 *               logo:
 *                 type: string
 *               city:
 *                 type: string
 *     responses:
 *       201:
 *         description: Team created successfully
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const team = await teamService.createTeam(req.body);
    sendSuccess(res, team, 'Team created', 201);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   get:
 *     summary: Get team by ID
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Team details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const team = await teamService.getTeamById(parseInt(req.params.id));
    sendSuccess(res, team);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   put:
 *     summary: Update a team
 *     tags: [Teams]
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
 *               logo:
 *                 type: string
 *               city:
 *                 type: string
 *     responses:
 *       200:
 *         description: Team updated successfully
 */
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const team = await teamService.updateTeam(parseInt(req.params.id), req.body);
    sendSuccess(res, team);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/teams/{id}:
 *   delete:
 *     summary: Delete a team
 *     tags: [Teams]
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
 *         description: Team deleted successfully
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await teamService.deleteTeam(parseInt(req.params.id));
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/teams/{id}/matches:
 *   get:
 *     summary: Get all matches for a team
 *     tags: [Teams]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of matches for the team
 */
router.get('/:id/matches', async (req, res, next) => {
  try {
    const matches = await teamService.getTeamMatches(parseInt(req.params.id));
    sendSuccess(res, matches);
  } catch (error) {
    next(error);
  }
});

export default router;
