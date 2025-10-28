import { Router } from 'express';
import { UserService } from '../services/user.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/response';

const router = Router();
const userService = new UserService();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
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
 *         description: List of users
 */
router.get('/', async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;

    const result = await userService.getUsers(page, limit);
    sendSuccess(res, result.users, 'Users retrieved successfully', 200, result.meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const user = await userService.getUserById(parseInt(req.params.id));
    sendSuccess(res, user);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}/statistics:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User statistics
 */
router.get('/:id/statistics', async (req, res, next) => {
  try {
    const stats = await userService.getUserStatistics(parseInt(req.params.id));
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}/groups:
 *   get:
 *     summary: Get user's groups
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *         description: User's groups
 */
router.get('/:id/groups', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await userService.getUserGroups(
      parseInt(req.params.id),
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    sendSuccess(res, result.groups, 'Groups retrieved successfully', 200, result.meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/users/{id}/predictions:
 *   get:
 *     summary: Get user's predictions
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
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
 *         description: User's predictions
 */
router.get('/:id/predictions', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await userService.getUserPredictions(
      parseInt(req.params.id),
      page ? parseInt(page as string) : undefined,
      limit ? parseInt(limit as string) : undefined
    );
    sendSuccess(res, result.predictions, 'Predictions retrieved successfully', 200, result.meta);
  } catch (error) {
    next(error);
  }
});

export default router;
