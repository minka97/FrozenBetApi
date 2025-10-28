import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class UserService {
  async getUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return {
      users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    return user;
  }

  async getUserStatistics(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const [totalPredictions, groupMemberships, rankings] = await Promise.all([
      prisma.prediction.count({ where: { userId } }),
      prisma.groupMember.count({ where: { userId } }),
      prisma.groupRanking.findMany({
        where: { userId },
        include: {
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const totalPoints = rankings.reduce((sum, r) => sum + r.totalPoints, 0);
    const correctPredictions = rankings.reduce((sum, r) => sum + r.correctPredictions, 0);

    return {
      userId,
      username: user.username,
      totalPredictions,
      correctPredictions,
      totalPoints,
      groupsJoined: groupMemberships,
      rankings,
    };
  }

  async getUserGroups(userId: number, page?: number, limit?: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const pageNumber = page || 1;
    const limitNumber = limit || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where = { userId };

    const [memberships, total] = await Promise.all([
      prisma.groupMember.findMany({
        where,
        include: {
          group: {
            include: {
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
          },
        },
        skip,
        take: limitNumber,
      }),
      prisma.groupMember.count({ where }),
    ]);

    const groups = memberships.map(m => ({
      ...m.group,
      userRole: m.role,
      userPoints: m.totalPoints,
      joinedAt: m.joinedAt,
    }));

    return {
      groups,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }

  async getUserPredictions(userId: number, page?: number, limit?: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    const pageNumber = page || 1;
    const limitNumber = limit || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where = { userId };

    const [predictions, total] = await Promise.all([
      prisma.prediction.findMany({
        where,
        include: {
          match: {
            include: {
              homeTeam: true,
              awayTeam: true,
              competition: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { predictedAt: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.prediction.count({ where }),
    ]);

    return {
      predictions,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }
}
