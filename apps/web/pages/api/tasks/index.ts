import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const tasks = await prisma.task.findMany({
        orderBy: [
          { completed: 'asc' },
          { order: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          project: true,
          labels: {
            include: {
              label: true,
            },
          },
        },
      });
      return res.status(200).json(tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { title, description, dueDate, priority, projectId, sectionId } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const task = await prisma.task.create({
        data: {
          title,
          description,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          priority: priority || 1,
          projectId,
          sectionId,
          // userId: null for now (auth pending)
        },
      });

      return res.status(201).json(task);
    } catch (error) {
      console.error('Failed to create task:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
