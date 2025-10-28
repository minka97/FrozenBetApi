import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

export class CompetitionService {
  async getCompetitions(params: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [competitions, total] = await Promise.all([
      prisma.competition.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              teams: true,
              matches: true,
              groups: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
      prisma.competition.count({ where }),
    ]);

    return {
      competitions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCompetitionById(id: number) {
    const competition = await prisma.competition.findUnique({
      where: { id },
      include: {
        teams: true,
        _count: {
          select: {
            matches: true,
            groups: true,
          },
        },
      },
    });

    if (!competition) {
      throw new AppError(404, 'NOT_FOUND', 'Competition not found');
    }

    return competition;
  }

  async createCompetition(data: {
    themeId: number;
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    season?: string;
  }) {
    const competition = await prisma.competition.create({
      data: {
        ...data,
        status: 'upcoming',
      },
    });

    return competition;
  }

  async updateCompetition(id: number, data: any) {
    const competition = await prisma.competition.update({
      where: { id },
      data,
    });

    return competition;
  }

  async deleteCompetition(id: number) {
    await prisma.competition.delete({
      where: { id },
    });

    return { message: 'Competition deleted successfully' };
  }

  async getCompetitionMatches(id: number, page?: number, limit?: number) {
    const pageNumber = page || 1;
    const limitNumber = limit || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where = { competitionId: id };

    const [matches, total] = await Promise.all([
      prisma.match.findMany({
        where,
        include: {
          homeTeam: true,
          awayTeam: true,
        },
        orderBy: { scheduledDate: 'asc' },
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

  async getCompetitionTeams(id: number, page?: number, limit?: number) {
    const pageNumber = page || 1;
    const limitNumber = limit || 20;
    const skip = (pageNumber - 1) * limitNumber;

    const where = { competitionId: id };

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limitNumber,
      }),
      prisma.team.count({ where }),
    ]);

    return {
      teams,
      meta: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    };
  }

  async getCompetitionStandings(id: number) {
    const competition = await prisma.competition.findUnique({
      where: { id },
    });

    if (!competition) {
      throw new AppError(404, 'NOT_FOUND', 'Competition not found');
    }

    // Get all finished matches in this competition
    const matches = await prisma.match.findMany({
      where: {
        competitionId: id,
        status: 'finished',
        homeScore: { not: null },
        awayScore: { not: null },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
      },
    });

    // Calculate standings
    const teamStats = new Map();

    matches.forEach(match => {
      const homeTeamId = match.homeTeamId;
      const awayTeamId = match.awayTeamId;
      const homeScore = match.homeScore!;
      const awayScore = match.awayScore!;

      // Initialize team stats if not exists
      if (!teamStats.has(homeTeamId)) {
        teamStats.set(homeTeamId, {
          teamId: homeTeamId,
          teamName: match.homeTeam.name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        });
      }
      if (!teamStats.has(awayTeamId)) {
        teamStats.set(awayTeamId, {
          teamId: awayTeamId,
          teamName: match.awayTeam.name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
        });
      }

      const homeStats = teamStats.get(homeTeamId);
      const awayStats = teamStats.get(awayTeamId);

      // Update played
      homeStats.played += 1;
      awayStats.played += 1;

      // Update goals
      homeStats.goalsFor += homeScore;
      homeStats.goalsAgainst += awayScore;
      awayStats.goalsFor += awayScore;
      awayStats.goalsAgainst += homeScore;

      // Determine winner and update stats
      if (homeScore > awayScore) {
        homeStats.won += 1;
        homeStats.points += 3;
        awayStats.lost += 1;
      } else if (homeScore < awayScore) {
        awayStats.won += 1;
        awayStats.points += 3;
        homeStats.lost += 1;
      } else {
        homeStats.drawn += 1;
        homeStats.points += 1;
        awayStats.drawn += 1;
        awayStats.points += 1;
      }

      // Update goal difference
      homeStats.goalDifference = homeStats.goalsFor - homeStats.goalsAgainst;
      awayStats.goalDifference = awayStats.goalsFor - awayStats.goalsAgainst;
    });

    // Convert to array and sort by points, then goal difference, then goals for
    const standings = Array.from(teamStats.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    // Add position
    standings.forEach((team, index) => {
      team.position = index + 1;
    });

    return standings;
  }
}
