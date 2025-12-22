import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  if (req.method === 'PATCH') {
    try {
      const { title, description, dueDate, priority, completed, projectId, sectionId } = req.body;

      const task = await prisma.task.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(priority !== undefined && { priority }),
          ...(completed !== undefined && { completed }),
          ...(projectId !== undefined && { projectId }),
          ...(sectionId !== undefined && { sectionId }),
        },
      });

      return res.status(200).json(task);
    } catch (error) {
      console.error('Failed to update task:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await prisma.task.delete({
        where: { id },
      });
      return res.status(204).end();
    } catch (error) {
      console.error('Failed to delete task:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
