import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { PredictionService } from './prediction.service';
import { sseService } from './sse.service';

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
    const oldMatch = await prisma.match.findUnique({
      where: { id },
      select: { status: true },
    });

    const match = await prisma.match.update({
      where: { id },
      data,
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
    });

    // Broadcast status change if status has changed
    if (oldMatch && oldMatch.status !== match.status) {
      sseService.broadcastMatchStatusChange(id, match.status, {
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        competition: match.competition.name,
        scheduledDate: match.scheduledDate,
      });
    }

    return match;
  }

  async deleteMatch(id: number) {
    await prisma.match.delete({
      where: { id },
    });

    return { message: 'Match deleted successfully' };
  }

  async updateScore(id: number, homeScore: number, awayScore: number, status?: string) {
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
    });

    if (!match) {
      throw new AppError(404, 'NOT_FOUND', 'Match not found');
    }

    const updated = await prisma.match.update({
      where: { id },
      data: {
        homeScore,
        awayScore,
        status: status || 'finished',
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
    });

    // Broadcast score update to all subscribed clients
    sseService.broadcastScoreUpdate(id, {
      homeScore,
      awayScore,
      homeTeam: updated.homeTeam.name,
      awayTeam: updated.awayTeam.name,
      status: updated.status,
      competition: updated.competition.name,
    });

    // Calculate points for all predictions on this match if finished
    if (updated.status === 'finished') {
      await this.predictionService.calculatePointsForMatch(id);
    }

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
