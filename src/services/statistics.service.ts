import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class StatisticsService {
  async getUserStatistics(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User not found');
    }

    // Get total predictions
    const totalPredictions = await prisma.prediction.count({
      where: { userId },
    });

    // Get predictions with points
    const predictions = await prisma.prediction.findMany({
      where: {
        userId,
        pointsEarned: { not: null },
      },
      select: {
        pointsEarned: true,
      },
    });

    const totalPoints = predictions.reduce((sum, p) => sum + (p.pointsEarned || 0), 0);
    const correctPredictions = predictions.filter(p => (p.pointsEarned || 0) > 0).length;
    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;

    // Get group memberships
    const groupMemberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get rankings in each group
    const rankings = await prisma.groupRanking.findMany({
      where: { userId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
    });

    return {
      totalPredictions,
      totalPoints,
      correctPredictions,
      accuracy: Math.round(accuracy * 100) / 100,
      groupsJoined: groupMemberships.length,
      rankings: rankings.map(r => ({
        groupId: r.group.id,
        groupName: r.group.name,
        rank: r.rank,
        totalPoints: r.totalPoints,
        totalPredictions: r.totalPredictions,
        correctPredictions: r.correctPredictions,
      })),
    };
  }

  async getGroupStatistics(groupId: number, userId: number) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new AppError(404, 'NOT_FOUND', 'Group not found');
    }

    // Check if user is a member
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!member) {
      throw new AppError(403, 'FORBIDDEN', 'Not a member of this group');
    }

    // Get total members
    const totalMembers = await prisma.groupMember.count({
      where: { groupId },
    });

    // Get total predictions
    const totalPredictions = await prisma.prediction.count({
      where: { groupId },
    });

    // Get top performers
    const topPerformers = await prisma.groupRanking.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
      take: 5,
    });

    // Get recent activity
    const recentPredictions = await prisma.prediction.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        match: {
          select: {
            id: true,
            homeTeam: { select: { name: true } },
            awayTeam: { select: { name: true } },
          },
        },
      },
      orderBy: { predictedAt: 'desc' },
      take: 10,
    });

    return {
      groupId,
      groupName: group.name,
      totalMembers,
      totalPredictions,
      topPerformers: topPerformers.map(p => ({
        userId: p.user.id,
        username: p.user.username,
        rank: p.rank,
        totalPoints: p.totalPoints,
        correctPredictions: p.correctPredictions,
        totalPredictions: p.totalPredictions,
      })),
      recentActivity: recentPredictions.map(p => ({
        predictionId: p.id,
        userId: p.user.id,
        username: p.user.username,
        match: `${p.match.homeTeam.name} vs ${p.match.awayTeam.name}`,
        prediction: `${p.homeScorePrediction} - ${p.awayScorePrediction}`,
        pointsEarned: p.pointsEarned,
        predictedAt: p.predictedAt,
      })),
    };
  }

  async getLeaderboard(params: { competitionId?: number; limit?: number }) {
    const { competitionId, limit = 50 } = params;

    const where: any = {};
    if (competitionId) {
      // Get all groups for this competition
      const groups = await prisma.group.findMany({
        where: { competitionId },
        select: { id: true },
      });
      where.groupId = { in: groups.map(g => g.id) };
    }

    // Get rankings across all groups or specific competition
    const rankings = await prisma.groupRanking.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            competition: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ totalPoints: 'desc' }, { correctPredictions: 'desc' }],
      take: limit,
    });

    // Aggregate user stats across all groups
    const userStatsMap = new Map();

    rankings.forEach(ranking => {
      const userId = ranking.user.id;
      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, {
          userId: ranking.user.id,
          username: ranking.user.username,
          firstName: ranking.user.firstName,
          lastName: ranking.user.lastName,
          totalPoints: 0,
          totalPredictions: 0,
          correctPredictions: 0,
          groupsParticipated: 0,
        });
      }

      const stats = userStatsMap.get(userId);
      stats.totalPoints += ranking.totalPoints;
      stats.totalPredictions += ranking.totalPredictions;
      stats.correctPredictions += ranking.correctPredictions;
      stats.groupsParticipated += 1;
    });

    // Convert to array and sort
    const leaderboard = Array.from(userStatsMap.values())
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        return b.correctPredictions - a.correctPredictions;
      })
      .slice(0, limit)
      .map((stats, index) => ({
        rank: index + 1,
        ...stats,
        accuracy:
          stats.totalPredictions > 0
            ? Math.round((stats.correctPredictions / stats.totalPredictions) * 100 * 100) / 100
            : 0,
      }));

    return leaderboard;
  }
}
