import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ProjectList from './components/ProjectList';
import VideoEditor from './components/VideoEditor';
import NewProjectModal from './components/NewProjectModal';
import './App.css';

function App() {
  const [projects, setProjects] = useState([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name, url) => {
    try {
      const response = await axios.post('/api/projects', { name, url });
      setProjects([...projects, response.data]);
      setShowNewProjectModal(false);
      navigate(`/project/${response.data.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const deleteProject = async (projectId) => {
    try {
      await axios.delete(`/api/projects/${projectId}`);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const updateProject = async (projectData) => {
    try {
      const response = await axios.put(`/api/projects/${projectData.id}`, projectData);
      setProjects(projects.map(p => p.id === projectData.id ? response.data : p));
      return response.data;
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>YouTube Snipper</h1>
        <button 
          className="new-project-btn"
          onClick={() => setShowNewProjectModal(true)}
        >
          New Project
        </button>
      </header>
      
      <main className="App-main">
        <Routes>
          <Route 
            path="/" 
            element={
              <ProjectList
                projects={projects}
                loading={loading}
                onLoadProject={(id) => navigate(`/project/${id}`)}
                onDeleteProject={deleteProject}
              />
            } 
          />
          <Route 
            path="/project/:projectId" 
            element={
              <VideoEditor
                onUpdateProject={updateProject}
                onBack={() => navigate('/')}
              />
            } 
          />
        </Routes>
      </main>

      {showNewProjectModal && (
        <NewProjectModal
          onClose={() => setShowNewProjectModal(false)}
          onCreateProject={createProject}
        />
      )}
    </div>
  );
}

export default App;
