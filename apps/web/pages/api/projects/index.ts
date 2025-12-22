import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const projects = await prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      });
      return res.status(200).json(projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description, color } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const project = await prisma.project.create({
        data: {
          name,
          description,
          color: color || '#3b82f6',
          // userId: null for now (auth pending)
        },
      });

      return res.status(201).json(project);
    } catch (error) {
      console.error('Failed to create project:', error);
      return res.status(500).json({ error: 'Failed to create project' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
