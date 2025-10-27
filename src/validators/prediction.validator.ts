import { z } from 'zod';

export const createPredictionSchema = z.object({
  matchId: z.number().int().positive(),
  groupId: z.number().int().positive(),
  homeScorePrediction: z.number().int().min(0),
  awayScorePrediction: z.number().int().min(0),
});

export const updatePredictionSchema = z.object({
  homeScorePrediction: z.number().int().min(0),
  awayScorePrediction: z.number().int().min(0),
});
