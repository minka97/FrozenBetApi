import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class PredictionService {
  async createPrediction(userId: number, data: {
    matchId: number;
    groupId: number;
    homeScorePrediction: number;
    awayScorePrediction: number;
  }) {
    const match = await prisma.match.findUnique({
      where: { id: data.matchId },
    });

    if (!match) {
      throw new AppError(404, 'NOT_FOUND', 'Match not found');
    }

    if (new Date(match.scheduledDate) <= new Date()) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot predict after match has started');
    }

    if (match.status !== 'scheduled') {
      throw new AppError(400, 'BAD_REQUEST', 'Match is not in scheduled status');
    }

    const member = await prisma.groupMember.findFirst({
      where: { groupId: data.groupId, userId },
    });

    if (!member) {
      throw new AppError(403, 'FORBIDDEN', 'Not a member of this group');
    }

    const existing = await prisma.prediction.findFirst({
      where: {
        userId,
        matchId: data.matchId,
        groupId: data.groupId,
      },
    });

    if (existing) {
      throw new AppError(409, 'CONFLICT', 'Prediction already exists for this match');
    }

    const prediction = await prisma.prediction.create({
      data: {
        userId,
        matchId: data.matchId,
        groupId: data.groupId,
        homeScorePrediction: data.homeScorePrediction,
        awayScorePrediction: data.awayScorePrediction,
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
        group: true,
      },
    });

    return prediction;
  }

  async updatePrediction(predictionId: number, userId: number, data: {
    homeScorePrediction: number;
    awayScorePrediction: number;
  }) {
    const prediction = await prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { match: true },
    });

    if (!prediction) {
      throw new AppError(404, 'NOT_FOUND', 'Prediction not found');
    }

    if (prediction.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Not your prediction');
    }

    if (new Date(prediction.match.scheduledDate) <= new Date()) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot update after match has started');
    }

    const updated = await prisma.prediction.update({
      where: { id: predictionId },
      data: {
        homeScorePrediction: data.homeScorePrediction,
        awayScorePrediction: data.awayScorePrediction,
      },
      include: {
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
          },
        },
      },
    });

    return updated;
  }

  async getUserPredictions(userId: number, params: { groupId?: number; matchId?: number; page?: number; limit?: number }) {
    const where: any = { userId };
    if (params.groupId) where.groupId = params.groupId;
    if (params.matchId) where.matchId = params.matchId;

    const pageNumber = params.page || 1;
    const limitNumber = params.limit || 20;
    const skip = (pageNumber - 1) * limitNumber;

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

  async getPredictionById(predictionId: number, userId: number) {
    const prediction = await prisma.prediction.findUnique({
      where: { id: predictionId },
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
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!prediction) {
      throw new AppError(404, 'NOT_FOUND', 'Prediction not found');
    }

    if (prediction.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Not your prediction');
    }

    return prediction;
  }

  async deletePrediction(predictionId: number, userId: number) {
    const prediction = await prisma.prediction.findUnique({
      where: { id: predictionId },
      include: { match: true },
    });

    if (!prediction) {
      throw new AppError(404, 'NOT_FOUND', 'Prediction not found');
    }

    if (prediction.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Not your prediction');
    }

    if (new Date(prediction.match.scheduledDate) <= new Date()) {
      throw new AppError(400, 'BAD_REQUEST', 'Cannot delete after match has started');
    }

    await prisma.prediction.delete({
      where: { id: predictionId },
    });

    return { message: 'Prediction deleted successfully' };
  }

  async getMatchPredictions(matchId: number, groupId: number, userId: number) {
    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });

    if (!member) {
      throw new AppError(403, 'FORBIDDEN', 'Not a member of this group');
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new AppError(404, 'NOT_FOUND', 'Match not found');
    }

    if (new Date(match.scheduledDate) > new Date() && match.status === 'scheduled') {
      const userPrediction = await prisma.prediction.findFirst({
        where: { matchId, groupId, userId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      return userPrediction ? [userPrediction] : [];
    }

    const predictions = await prisma.prediction.findMany({
      where: { matchId, groupId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { predictedAt: 'asc' },
    });

    return predictions;
  }

  async calculatePointsForMatch(matchId: number) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.status !== 'finished') {
      throw new AppError(400, 'BAD_REQUEST', 'Match is not finished');
    }

    if (match.homeScore === null || match.awayScore === null) {
      throw new AppError(400, 'BAD_REQUEST', 'Match scores are not set');
    }

    const predictions = await prisma.prediction.findMany({
      where: { matchId },
      include: {
        group: {
          include: {
            scoringRules: true,
          },
        },
      },
    });

    for (const prediction of predictions) {
      const points = this.calculatePoints(
        prediction.homeScorePrediction,
        prediction.awayScorePrediction,
        match.homeScore,
        match.awayScore,
        prediction.group.scoringRules
      );

      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { pointsEarned: points },
      });

      await prisma.groupMember.updateMany({
        where: {
          groupId: prediction.groupId,
          userId: prediction.userId,
        },
        data: {
          totalPoints: {
            increment: points,
          },
        },
      });

      const ranking = await prisma.groupRanking.findFirst({
        where: {
          groupId: prediction.groupId,
          userId: prediction.userId,
        },
      });

      if (ranking) {
        const isCorrect = points > 0;
        await prisma.groupRanking.update({
          where: { id: ranking.id },
          data: {
            totalPoints: { increment: points },
            totalPredictions: { increment: 1 },
            correctPredictions: isCorrect ? { increment: 1 } : undefined,
          },
        });
      } else {
        await prisma.groupRanking.create({
          data: {
            groupId: prediction.groupId,
            userId: prediction.userId,
            totalPoints: points,
            totalPredictions: 1,
            correctPredictions: points > 0 ? 1 : 0,
          },
        });
      }
    }

    const groups = [...new Set(predictions.map(p => p.groupId))];
    for (const groupId of groups) {
      await this.updateGroupRankings(groupId);
    }

    return { message: 'Points calculated successfully' };
  }

  private calculatePoints(
    predictedHome: number,
    predictedAway: number,
    actualHome: number,
    actualAway: number,
    rules: any[]
  ): number {
    let points = 0;

    if (predictedHome === actualHome && predictedAway === actualAway) {
      const rule = rules.find(r => r.ruleDescription?.includes('Exact score'));
      points += rule?.points || 5;
      return points;
    }

    const predictedResult = predictedHome > predictedAway ? 'home' : predictedHome < predictedAway ? 'away' : 'draw';
    const actualResult = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw';

    if (predictedResult === actualResult) {
      if (actualResult === 'draw') {
        const rule = rules.find(r => r.ruleDescription?.includes('Correct draw'));
        points += rule?.points || 3;
      } else {
        const rule = rules.find(r => r.ruleDescription?.includes('Correct winner'));
        points += rule?.points || 3;
      }
    }

    return points;
  }

  private async updateGroupRankings(groupId: number) {
    const rankings = await prisma.groupRanking.findMany({
      where: { groupId },
      orderBy: { totalPoints: 'desc' },
    });

    let currentRank = 1;
    for (let i = 0; i < rankings.length; i++) {
      const ranking = rankings[i];
      const previousRank = ranking.rank;

      if (i > 0 && rankings[i - 1].totalPoints === ranking.totalPoints) {
        await prisma.groupRanking.update({
          where: { id: ranking.id },
          data: {
            rank: currentRank,
            previousRank,
          },
        });
      } else {
        currentRank = i + 1;
        await prisma.groupRanking.update({
          where: { id: ranking.id },
          data: {
            rank: currentRank,
            previousRank,
          },
        });
      }
    }
  }
}
