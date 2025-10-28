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

  async getTeamMatches(id: number, page?: number, limit?: number) {
    const pageNumber = page || 1;
    const limitNumber = limit || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where = {
      OR: [
        { homeTeamId: id },
        { awayTeamId: id },
      ],
    };

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          homeTeam: true,
          awayTeam: true,
          competition: true,
        },
        orderBy: { scheduledDate: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.match.count({ where }),
    ]);

    return {
      matches,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }
}
