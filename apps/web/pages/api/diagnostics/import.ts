import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;

    // Expected format: { plants: [...], chemicals: [...], diagnostics: [...] }
    let imported = { plants: 0, chemicals: 0, diagnostics: 0 };

    // Import plants
    if (Array.isArray(data.plants)) {
      for (const plant of data.plants) {
        await prisma.plant.upsert({
          where: { id: plant.id || 'import-' + Date.now() + '-' + Math.random() },
          update: plant,
          create: plant,
        });
        imported.plants++;
      }
    }

    // Import chemicals
    if (Array.isArray(data.chemicals)) {
      for (const chemical of data.chemicals) {
        await prisma.chemical.upsert({
          where: { name: chemical.name },
          update: chemical,
          create: chemical,
        });
        imported.chemicals++;
      }
    }

    // Import diagnostic records
    if (Array.isArray(data.diagnostics)) {
      for (const diagnostic of data.diagnostics) {
        await prisma.diagnosticRecord.create({
          data: diagnostic,
        });
        imported.diagnostics++;
      }
    }

    return res.status(200).json({
      message: 'Import successful',
      imported,
    });
  } catch (error) {
    console.error('Failed to import diagnostics:', error);
    return res.status(500).json({ error: 'Failed to import diagnostics' });
  }
}
