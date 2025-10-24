import React from 'react';
import './DownloadProgress.css';

const DownloadProgress = ({ progress }) => {
  if (!progress) return null;

  const getProgressPercent = () => {
    if (typeof progress.percent === 'number') {
      return progress.percent;
    }
    if (progress.total && progress.downloaded) {
      return Math.round((progress.downloaded / progress.total) * 100);
    }
    if (progress.percent) {
      return parseInt(progress.percent);
    }
    return 0;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const percent = getProgressPercent();

  return (
    <div className="download-progress">
      <div className="progress-content">
        <h3>Downloading Video</h3>
        
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${percent}%` }}
          />
          <span className="progress-percent">{percent}%</span>
        </div>
        
        {progress.status === 'downloading' && (
          <div className="progress-details">
            {progress.downloaded && progress.total && (
              <span className="progress-size">
                {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
              </span>
            )}
            {progress.speed && (
              <span className="progress-speed">{progress.speed}</span>
            )}
            {progress.eta && progress.eta !== 'Unknown' && (
              <span className="progress-eta">ETA: {progress.eta}</span>
            )}
          </div>
        )}
        
        {progress.status === 'finished' && (
          <p className="progress-message">Processing video...</p>
        )}
        
        {progress.status === 'starting' && (
          <p className="progress-message">Starting download...</p>
        )}
      </div>
    </div>
  );
};

export default DownloadProgress;
