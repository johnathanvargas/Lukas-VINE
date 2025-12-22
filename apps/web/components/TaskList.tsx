import { updateTask, deleteTask } from '@/services/api';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: number;
  completed: boolean;
}

interface TaskListProps {
  tasks: Task[];
  onTaskSelect: (task: Task) => void;
  onTaskUpdated: () => void;
}

export default function TaskList({ tasks, onTaskSelect, onTaskUpdated }: TaskListProps) {
  const handleToggleComplete = async (task: Task) => {
    try {
      await updateTask(task.id, { completed: !task.completed });
      onTaskUpdated();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleDelete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask(taskId);
      onTaskUpdated();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 4: return 'urgent';
      case 3: return 'high';
      case 2: return 'medium';
      case 1: return 'low';
      default: return 'normal';
    }
  };

  if (tasks.length === 0) {
    return <div className="empty-state">No tasks yet. Add one above!</div>;
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <div 
          key={task.id} 
          className={`task-item ${task.completed ? 'completed' : ''}`}
          onClick={() => onTaskSelect(task)}
        >
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => handleToggleComplete(task)}
            onClick={(e) => e.stopPropagation()}
            className="task-checkbox"
          />
          <div className="task-content">
            <h4 className="task-title">{task.title}</h4>
            {task.dueDate && (
              <span className="task-due-date">
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            <span className={`task-priority priority-${getPriorityLabel(task.priority)}`}>
              {getPriorityLabel(task.priority)}
            </span>
          </div>
          <button 
            onClick={(e) => handleDelete(task.id, e)}
            className="task-delete"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
