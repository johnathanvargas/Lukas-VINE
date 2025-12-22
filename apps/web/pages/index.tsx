import { useEffect, useState } from 'react';
import QuickAdd from '@/components/QuickAdd';
import TaskList from '@/components/TaskList';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import { getTasks } from '@/services/api';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: number;
  completed: boolean;
  projectId?: string;
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await getTasks();
      setTasks(data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleTaskCreated = () => {
    loadTasks();
  };

  const handleTaskSelect = (task: Task) => {
    setSelectedTask(task);
  };

  const handleTaskUpdated = () => {
    loadTasks();
    setSelectedTask(null);
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Today</h2>
        <p className="date">{new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
      </div>

      <QuickAdd onTaskCreated={handleTaskCreated} />

      {loading ? (
        <div className="loading">Loading tasks...</div>
      ) : (
        <TaskList 
          tasks={tasks} 
          onTaskSelect={handleTaskSelect}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {selectedTask && (
        <TaskDetailPanel 
          task={selectedTask} 
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdated}
        />
      )}
    </div>
  );
}
