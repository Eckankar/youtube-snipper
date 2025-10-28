import React from 'react';

const ProjectList = ({ projects, loading, onLoadProject, onDeleteProject }) => {
  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <h2>No projects yet</h2>
        <p>Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="project-list">
      <h2>Your Projects</h2>
      <div className="projects-grid">
        {projects.map(project => (
          <div key={project.id} className="project-card">
            <div className="project-info">
              <h3>{project.name}</h3>
              <p className="project-url">{project.url}</p>
              <p className="project-date">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </p>
              <p className="project-segments">
                {project.segments?.length || 0} clips
              </p>
            </div>
            <div className="project-actions">
              <button 
                onClick={() => onLoadProject(project.id)}
                className="load-btn"
              >
                Open
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this project?')) {
                    onDeleteProject(project.id);
                  }
                }}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectList;