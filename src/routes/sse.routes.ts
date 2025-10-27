import { Router } from 'express';
import { randomUUID } from 'crypto';
import { sseService } from '../services/sse.service';

const router = Router();

/**
 * @swagger
 * /api/sse/live-scores:
 *   get:
 *     summary: Subscribe to live score updates via Server-Sent Events
 *     tags: [SSE]
 *     description: Establishes an SSE connection to receive real-time score updates
 *     parameters:
 *       - in: query
 *         name: matchIds
 *         schema:
 *           type: string
 *         description: Comma-separated list of match IDs to subscribe to (optional, if empty subscribes to all matches)
 *         example: "1,2,3"
 *     responses:
 *       200:
 *         description: SSE connection established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *             examples:
 *               connected:
 *                 value: |
 *                   event: connected
 *                   data: {"message":"Connected to live scores","timestamp":"2025-10-27T10:00:00.000Z"}
 *
 *               score-update:
 *                 value: |
 *                   event: score-update
 *                   data: {"matchId":1,"homeScore":2,"awayScore":1,"homeTeam":"Team A","awayTeam":"Team B","timestamp":"2025-10-27T10:05:00.000Z"}
 *
 *               match-status:
 *                 value: |
 *                   event: match-status
 *                   data: {"matchId":1,"status":"live","timestamp":"2025-10-27T10:00:00.000Z"}
 *
 *               heartbeat:
 *                 value: |
 *                   event: heartbeat
 *                   data: {"timestamp":"2025-10-27T10:00:30.000Z"}
 */
router.get('/live-scores', (req, res) => {
  const clientId = randomUUID();
  const matchIdsParam = req.query.matchIds as string;

  let matchIds: number[] | undefined;
  if (matchIdsParam) {
    matchIds = matchIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  }

  sseService.addClient(clientId, res, matchIds);

  console.log(`New SSE client connected: ${clientId}, subscribed to matches: ${matchIds ? matchIds.join(',') : 'all'}`);
});

/**
 * @swagger
 * /api/sse/status:
 *   get:
 *     summary: Get SSE service status
 *     tags: [SSE]
 *     responses:
 *       200:
 *         description: SSE service status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      activeClients: sseService.getActiveClientsCount(),
      status: 'running',
    },
  });
});

export default router;
