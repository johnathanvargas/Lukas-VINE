import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const requests = await prisma.request.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json(requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      return res.status(500).json({ error: 'Failed to fetch requests' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { title, description, plantName, symptoms, priority } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const request = await prisma.request.create({
        data: {
          title,
          description,
          plantName,
          symptoms,
          priority: priority || 2,
          status: 'pending',
          // userId: null for now (auth pending)
        },
      });

      return res.status(201).json(request);
    } catch (error) {
      console.error('Failed to create request:', error);
      return res.status(500).json({ error: 'Failed to create request' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
