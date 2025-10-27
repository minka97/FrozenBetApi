import { Router } from 'express';
import { GroupService } from '../services/group.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendSuccess } from '../utils/response';
import { createGroupSchema, updateGroupSchema } from '../validators/group.validator';

const router = Router();
const groupService = new GroupService();

/**
 * @swagger
 * /api/groups:
 *   get:
 *     summary: List all public groups
 *     tags: [Groups]
 *     parameters:
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [private, public]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: List of groups
 */
router.get('/', async (req, res, next) => {
  try {
    const { visibility, search, page, limit } = req.query;
    const result = await groupService.getGroups({
      visibility: visibility as string,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    sendSuccess(res, result.groups, 'Groups retrieved successfully', 200, result.meta);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups:
 *   post:
 *     summary: Create a new group
 *     tags: [Groups]
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
 *               description:
 *                 type: string
 *               competitionId:
 *                 type: integer
 *               visibility:
 *                 type: string
 *                 enum: [private, public]
 *     responses:
 *       201:
 *         description: Group created successfully
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = createGroupSchema.parse(req.body);
    const group = await groupService.createGroup(req.user!.userId, data);
    sendSuccess(res, group, 'Group created successfully', 201);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups/{id}:
 *   get:
 *     summary: Get group details
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Group details
 */
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const group = await groupService.getGroupById(
      parseInt(req.params.id),
      req.user?.userId
    );
    sendSuccess(res, group);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups/{id}:
 *   put:
 *     summary: Update group
 *     tags: [Groups]
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
 *     responses:
 *       200:
 *         description: Group updated
 */
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = updateGroupSchema.parse(req.body);
    const group = await groupService.updateGroup(
      parseInt(req.params.id),
      req.user!.userId,
      data
    );
    sendSuccess(res, group, 'Group updated successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups/{id}:
 *   delete:
 *     summary: Delete group
 *     tags: [Groups]
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
 *         description: Group deleted
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await groupService.deleteGroup(
      parseInt(req.params.id),
      req.user!.userId
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups/{id}/join:
 *   post:
 *     summary: Join a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inviteCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Joined group successfully
 */
router.post('/:id/join', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const member = await groupService.joinGroup(
      parseInt(req.params.id),
      req.user!.userId,
      req.body.inviteCode
    );
    sendSuccess(res, member, 'Joined group successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups/{id}/leave:
 *   post:
 *     summary: Leave a group
 *     tags: [Groups]
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
 *         description: Left group successfully
 */
router.post('/:id/leave', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await groupService.leaveGroup(
      parseInt(req.params.id),
      req.user!.userId
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups/{id}/members:
 *   get:
 *     summary: Get group members
 *     tags: [Groups]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of members
 */
router.get('/:id/members', async (req, res, next) => {
  try {
    const members = await groupService.getMembers(parseInt(req.params.id));
    sendSuccess(res, members);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/groups/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member from group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Member removed
 */
router.delete('/:id/members/:userId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await groupService.removeMember(
      parseInt(req.params.id),
      req.user!.userId,
      parseInt(req.params.userId)
    );
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
