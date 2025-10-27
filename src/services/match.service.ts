import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { PredictionService } from './prediction.service';

export class MatchService {
  private predictionService = new PredictionService();

  async createMatch(data: {
    competitionId: number;
    homeTeamId: number;
    awayTeamId: number;
    scheduledDate: Date;
    location?: string;
  }) {
    const match = await prisma.match.create({
      data: {
        ...data,
        status: 'scheduled',
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
    });

    return match;
  }

  async updateMatch(id: number, data: any) {
    const match = await prisma.match.update({
      where: { id },
      data,
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
    });

    return match;
  }

  async deleteMatch(id: number) {
    await prisma.match.delete({
      where: { id },
    });

    return { message: 'Match deleted successfully' };
  }

  async updateScore(id: number, homeScore: number, awayScore: number) {
    const match = await prisma.match.findUnique({
      where: { id },
    });

    if (!match) {
      throw new AppError(404, 'NOT_FOUND', 'Match not found');
    }

    const updated = await prisma.match.update({
      where: { id },
      data: {
        homeScore,
        awayScore,
        status: 'finished',
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    // Calculate points for all predictions on this match
    await this.predictionService.calculatePointsForMatch(id);

    return updated;
  }

  async getFinishedMatches() {
    const matches = await prisma.match.findMany({
      where: {
        status: 'finished',
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
      orderBy: { scheduledDate: 'desc' },
      take: 50,
    });

    return matches;
  }
}
