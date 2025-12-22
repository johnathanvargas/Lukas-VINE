import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symptoms } = req.body;

    if (!symptoms) {
      return res.status(400).json({ error: 'Symptoms are required' });
    }

    // Simple query: search for diagnostic records matching symptoms
    // Split symptoms into keywords and search
    const keywords = symptoms.toLowerCase().split(/[\s,]+/).filter(Boolean);

    const diagnostics = await prisma.diagnosticRecord.findMany({
      where: {
        OR: keywords.map((keyword: string) => ({
          symptoms: {
            contains: keyword,
            mode: 'insensitive' as const,
          },
        })),
      },
      include: {
        plant: true,
        chemical: true,
      },
      take: 10,
    });

    // Transform to simpler format
    const results = diagnostics.map((d: any) => ({
      plantName: d.plant.commonName,
      diagnosis: d.diagnosis,
      recommendedAction: d.recommendedAction,
      severity: d.severity,
      chemical: d.chemical?.name,
    }));

    return res.status(200).json(results);
  } catch (error) {
    console.error('Failed to query diagnostics:', error);
    return res.status(500).json({ error: 'Failed to query diagnostics' });
  }
}
