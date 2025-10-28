/**
 * @format
 * @file ingest-competitions.ts
 * @description Script pour peupler la table "Competition" à partir d'une API externe.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

// ✅ Schéma de validation Zod pour une compétition
const CompetitionApiSchema = z.object({
  id: z.number(),
  themeId: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  season: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});

const CompetitionsApiSchema = z.array(CompetitionApiSchema);

async function fetchCompetitions(apiUrl: string) {
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Erreur API ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return CompetitionsApiSchema.parse(data);
}

async function main() {
  const API_URL = "https://frozen-bet-ext-api.vercel.app/competitions";
  console.log(`🚀 Récupération des compétitions depuis ${API_URL} ...`);

  const competitions = await fetchCompetitions(API_URL);
  console.log(`📦 ${competitions.length} compétition(s) récupérée(s)`);

  let created = 0;
  let updated = 0;

  for (const c of competitions) {
    await prisma.competition.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        themeId: c.themeId,
        name: c.name,
        description: c.description ?? null,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        season: c.season ?? null,
        status: c.status ?? "upcoming",
      },
      update: {
        themeId: c.themeId,
        name: c.name,
        description: c.description ?? null,
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        season: c.season ?? null,
        status: c.status ?? "upcoming",
      },
    });

    created++;
  }

  console.log(
    `✅ Terminé. ${created} compétition(s) insérée(s) ou mise(s) à jour.`
  );
}

main()
  .catch((e) => {
    console.error("❌ Erreur durant l’ingestion :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
