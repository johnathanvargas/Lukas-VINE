import { useEffect, useState } from 'react';
import { getProjects } from '@/services/api';

interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();
        setProjects(data);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  return (
    <div className="page-container">
      <h2>Projects</h2>
      {loading ? (
        <div className="loading">Loading projects...</div>
      ) : (
        <div className="project-grid">
          {projects.length === 0 ? (
            <p>No projects yet. Create your first project!</p>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="project-card">
                <div 
                  className="project-color" 
                  style={{ backgroundColor: project.color || '#3b82f6' }}
                />
                <h3>{project.name}</h3>
                {project.description && <p>{project.description}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
