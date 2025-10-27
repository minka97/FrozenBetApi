import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateInviteCode, generateInvitationToken } from '../utils/inviteCode';

export class GroupService {
  async createGroup(userId: number, data: {
    name: string;
    description?: string;
    competitionId: number;
    visibility: string;
  }) {
    const competition = await prisma.competition.findUnique({
      where: { id: data.competitionId },
    });

    if (!competition) {
      throw new AppError(404, 'NOT_FOUND', 'Competition not found');
    }

    const inviteCode = data.visibility === 'private' ? generateInviteCode() : null;

    const group = await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: userId,
        competitionId: data.competitionId,
        visibility: data.visibility,
        inviteCode,
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        competition: true,
      },
    });

    // Add owner as admin member
    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId,
        role: 'owner',
      },
    });

    // Create default scoring rules
    await prisma.groupScoringRule.createMany({
      data: [
        { groupId: group.id, ruleDescription: 'Exact score', points: 5 },
        { groupId: group.id, ruleDescription: 'Correct winner', points: 3 },
        { groupId: group.id, ruleDescription: 'Correct draw', points: 3 },
      ],
    });

    return group;
  }

  async getGroups(params: { visibility?: string; search?: string; page?: number; limit?: number }) {
    const { visibility, search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (visibility) where.visibility = visibility;
    if (search) where.name = { contains: search };

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: {
            select: {
              id: true,
              username: true,
            },
          },
          competition: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.group.count({ where }),
    ]);

    return {
      groups,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getGroupById(groupId: number, userId?: number) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        competition: true,
        scoringRules: true,
        _count: {
          select: {
            members: true,
            predictions: true,
          },
        },
      },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Group not found');
    }

    // Hide invite code if user is not a member (for private groups)
    if (group.visibility === 'private' && userId) {
      const isMember = await prisma.groupMember.findFirst({
        where: { groupId, userId },
      });

      if (!isMember) {
        const { inviteCode, ...groupWithoutCode } = group;
        return groupWithoutCode;
      }
    }

    return group;
  }

  async updateGroup(groupId: number, userId: number, data: any) {
    await this.checkPermission(groupId, userId, ['owner', 'admin']);

    const group = await prisma.group.update({
      where: { id: groupId },
      data,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        competition: true,
      },
    });

    return group;
  }

  async deleteGroup(groupId: number, userId: number) {
    await this.checkPermission(groupId, userId, ['owner']);

    await prisma.group.delete({
      where: { id: groupId },
    });

    return { message: 'Group deleted successfully' };
  }

  async joinGroup(groupId: number, userId: number, inviteCode?: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Group not found');
    }

    if (group.visibility === 'private' && group.inviteCode !== inviteCode) {
      throw new AppError(403, 'FORBIDDEN', 'Invalid invite code');
    }

    // Check if already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (existingMember) {
      throw new AppError(409, 'CONFLICT', 'Already a member of this group');
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: 'member',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return member;
  }

  async leaveGroup(groupId: number, userId: number) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!member) {
      throw new AppError(404, 'NOT_FOUND', 'Not a member of this group');
    }

    if (member.role === 'owner') {
      throw new AppError(400, 'BAD_REQUEST', 'Owner cannot leave the group');
    }

    await prisma.groupMember.delete({
      where: { id: member.id },
    });

    return { message: 'Left group successfully' };
  }

  async getMembers(groupId: number) {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { totalPoints: 'desc' },
    });

    return members;
  }

  async removeMember(groupId: number, userId: number, targetUserId: number) {
    await this.checkPermission(groupId, userId, ['owner', 'admin']);

    const targetMember = await prisma.groupMember.findFirst({
      where: { groupId, userId: targetUserId },
    });

    if (!targetMember) {
      throw new AppError(404, 'NOT_FOUND', 'Member not found');
    }

    if (targetMember.role === 'owner') {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot remove group owner');
    }

    await prisma.groupMember.delete({
      where: { id: targetMember.id },
    });

    return { message: 'Member removed successfully' };
  }

  async getRankings(groupId: number) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Group not found');
    }

    const rankings = await prisma.groupRanking.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
    });

    return rankings;
  }

  async getGroupPredictions(groupId: number, userId: number) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!member) {
      throw new AppError(403, 'FORBIDDEN', 'Not a member of this group');
    }

    const predictions = await prisma.prediction.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
      },
      orderBy: { predictedAt: 'desc' },
    });

    return predictions;
  }

  async getScoringRules(groupId: number) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Group not found');
    }

    const rules = await prisma.groupScoringRule.findMany({
      where: { groupId },
      orderBy: { points: 'desc' },
    });

    return rules;
  }

  async createScoringRule(groupId: number, userId: number, data: {
    ruleDescription: string;
    points: number;
  }) {
    await this.checkPermission(groupId, userId, ['owner', 'admin']);

    const rule = await prisma.groupScoringRule.create({
      data: {
        groupId,
        ruleDescription: data.ruleDescription,
        points: data.points,
      },
    });

    return rule;
  }

  async updateScoringRule(groupId: number, ruleId: number, userId: number, data: {
    ruleDescription?: string;
    points?: number;
  }) {
    await this.checkPermission(groupId, userId, ['owner', 'admin']);

    const rule = await prisma.groupScoringRule.findFirst({
      where: { id: ruleId, groupId },
    });

    if (!rule) {
      throw new AppError(404, 'NOT_FOUND', 'Scoring rule not found');
    }

    const updated = await prisma.groupScoringRule.update({
      where: { id: ruleId },
      data,
    });

    return updated;
  }

  async deleteScoringRule(groupId: number, ruleId: number, userId: number) {
    await this.checkPermission(groupId, userId, ['owner', 'admin']);

    const rule = await prisma.groupScoringRule.findFirst({
      where: { id: ruleId, groupId },
    });

    if (!rule) {
      throw new AppError(404, 'NOT_FOUND', 'Scoring rule not found');
    }

    await prisma.groupScoringRule.delete({
      where: { id: ruleId },
    });

    return { message: 'Scoring rule deleted successfully' };
  }

  private async checkPermission(groupId: number, userId: number, allowedRoles: string[]) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!member || !allowedRoles.includes(member.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions');
    }
  }
}
