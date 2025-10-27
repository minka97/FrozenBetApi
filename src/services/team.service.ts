import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class TeamService {
  async getTeams(params: { competitionId?: number; page?: number; limit?: number }) {
    const { competitionId, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (competitionId) where.competitionId = competitionId;

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        include: {
          competition: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.team.count({ where }),
    ]);

    return {
      teams,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTeamById(id: number) {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        competition: true,
        _count: {
          select: {
            homeMatches: true,
            awayMatches: true,
          },
        },
      },
    });

    if (!team) {
      throw new AppError(404, 'NOT_FOUND', 'Team not found');
    }

    return team;
  }

  async createTeam(data: {
    competitionId: number;
    name: string;
    shortName?: string;
    logoUrl?: string;
    country?: string;
    externalApiId?: string;
  }) {
    const team = await prisma.team.create({
      data,
    });

    return team;
  }

  async updateTeam(id: number, data: any) {
    const team = await prisma.team.update({
      where: { id },
      data,
    });

    return team;
  }

  async deleteTeam(id: number) {
    await prisma.team.delete({
      where: { id },
    });

    return { message: 'Team deleted successfully' };
  }

  async getTeamMatches(id: number) {
    const matches = await prisma.match.findMany({
      where: {
        OR: [
          { homeTeamId: id },
          { awayTeamId: id },
        ],
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        competition: true,
      },
      orderBy: { scheduledDate: 'desc' },
    });

    return matches;
  }
}
