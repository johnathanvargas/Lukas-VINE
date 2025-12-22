import { useState } from 'react';
import * as chrono from 'chrono-node';
import { createTask } from '@/services/api';

interface QuickAddProps {
  onTaskCreated: () => void;
}

export default function QuickAdd({ onTaskCreated }: QuickAddProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      // Simple parsing: extract date if present using chrono-node
      const parsedDate = chrono.parseDate(input);
      
      // For now, treat the entire input as the task title
      // (Could be enhanced to parse out the date text)
      const title = input.trim();
      
      await createTask({
        title,
        dueDate: parsedDate ? parsedDate.toISOString() : undefined,
        priority: 1,
      });

      setInput('');
      onTaskCreated();
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="quick-add" onSubmit={handleSubmit}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Add task (e.g., 'Water plants tomorrow')"
        disabled={loading}
        className="quick-add-input"
      />
      <button type="submit" disabled={loading || !input.trim()} className="quick-add-btn">
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  );
}
