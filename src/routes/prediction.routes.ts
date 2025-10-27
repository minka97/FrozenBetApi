import { Router } from 'express';
import { PredictionService } from '../services/prediction.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { createPredictionSchema, updatePredictionSchema } from '../validators/prediction.validator';

const router = Router();
const predictionService = new PredictionService();

/**
 * @swagger
 * /api/predictions:
 *   get:
 *     summary: Get user's predictions
 *     tags: [Predictions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: matchId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of predictions
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { groupId, matchId } = req.query;
    const predictions = await predictionService.getUserPredictions(
      req.user!.userId,
      {
        groupId: groupId ? parseInt(groupId as string) : undefined,
        matchId: matchId ? parseInt(matchId as string) : undefined,
      }
    );
    sendSuccess(res, predictions);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/predictions:
 *   post:
 *     summary: Create a new prediction
 *     tags: [Predictions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - matchId
 *               - groupId
 *               - homeScorePrediction
 *               - awayScorePrediction
 *             properties:
 *               matchId:
 *                 type: integer
 *               groupId:
 *                 type: integer
 *               homeScorePrediction:
 *                 type: integer
 *               awayScorePrediction:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Prediction created
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = createPredictionSchema.parse(req.body);
    const prediction = await predictionService.createPrediction(req.user!.userId, data);
    sendSuccess(res, prediction, 'Prediction created successfully', 201);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/predictions/{id}:
 *   get:
 *     summary: Get a specific prediction
 *     tags: [Predictions]
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
 *         description: Prediction details
 */
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const prediction = await predictionService.getPredictionById(
      parseInt(req.params.id),
      req.user!.userId
    );
    sendSuccess(res, prediction);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/predictions/{id}:
 *   put:
 *     summary: Update a prediction
 *     tags: [Predictions]
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
 *             required:
 *               - homeScorePrediction
 *               - awayScorePrediction
 *             properties:
 *               homeScorePrediction:
 *                 type: integer
 *               awayScorePrediction:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Prediction updated
 */
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = updatePredictionSchema.parse(req.body);
    const prediction = await predictionService.updatePrediction(
      parseInt(req.params.id),
      req.user!.userId,
      data
    );
    sendSuccess(res, prediction, 'Prediction updated successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/predictions/{id}:
 *   delete:
 *     summary: Delete a prediction
 *     tags: [Predictions]
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
 *         description: Prediction deleted
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await predictionService.deletePrediction(
      parseInt(req.params.id),
      req.user!.userId
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
