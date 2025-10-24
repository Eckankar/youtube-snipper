import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import ReactPlayer from 'react-player';
import Timeline from './Timeline';
import DownloadProgress from './DownloadProgress';
import axios from 'axios';

const VideoEditor = ({ onUpdateProject, onBack }) => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [segments, setSegments] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [playingSegmentIndex, setPlayingSegmentIndex] = useState(null);
  const playerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const startedRef = useRef(false);
  const editorRef = useRef(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await axios.get(`/api/projects/${projectId}`);
        setProject(response.data);
        setSegments(response.data.segments || []);
        setDuration(response.data.duration || 0);
      } catch (error) {
        console.error('Error loading project:', error);
      }
    };
    
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const startProgressStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    const url = new URL(`/api/projects/${projectId}/download/progress`, window.location.origin);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = async (event) => {
      try {
        console.debug('Received SSE event:', event.data); // Debug log

        const progress = JSON.parse(event.data);
        setDownloadProgress(progress);

        if (progress.status === 'complete') {
          const updatedProject = {
            ...project,
            video_path: `/projects/${projectId}/video.mp4`,
            duration: progress.duration
          };
          if (progress.title) {
            updatedProject.title = progress.title;
            if (project.name === 'Untitled Project' || !project.name) {
              updatedProject.name = progress.title;
            }
          }
          const updated = await onUpdateProject(updatedProject);
          if (updated) {
            setProject(updated);
            setDuration(updated.duration || progress.duration);
          }
          setIsDownloading(false);
          es.close();
          eventSourceRef.current = null;
        } else if (progress.status === 'error') {
          alert(`Failed to download video: ${progress.error}`);
          setIsDownloading(false);
          setDownloadProgress(null);
          es.close();
          eventSourceRef.current = null;
        }
      } catch (e) {
        console.error('Error parsing progress message:', e);
      }
    };

    es.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Don't immediately close on error, let it retry
      if (es.readyState === EventSource.CLOSED) {
        setIsDownloading(false);
        setDownloadProgress(null);
        eventSourceRef.current = null;
      }
    };

    es.onopen = () => {
      console.log('SSE connection opened');
    };
  }, [projectId, project, onUpdateProject]);

  const downloadVideo = useCallback(async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress({ status: 'starting', percent: '0%' });

    try {
      await axios.post(`/api/projects/${projectId}/download`);
      startProgressStream();
    } catch (error) {
      if (error.response && error.response.status === 409) {
        // Download already in progress; attach to progress stream
        startProgressStream();
        return;
      }
      console.error('Error starting download:', error);
      alert('Failed to start download');
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [isDownloading, projectId, startProgressStream]);

  useEffect(() => {
    if (project && !project.video_path && project.url && !startedRef.current) {
      startedRef.current = true;
      downloadVideo();
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [project, downloadVideo]);

  // Focus the editor on mount for keyboard events
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  const handleProgress = (progress) => {
    setCurrentTime(progress.playedSeconds);
    
    // Handle continuous segment playback
    if (playingSegmentIndex !== null) {
      const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
      const currentSegment = sortedSegments[playingSegmentIndex];
      
      if (currentSegment && progress.playedSeconds >= currentSegment.end) {
        if (playingSegmentIndex < sortedSegments.length - 1) {
          // Move to next segment
          const nextSegment = sortedSegments[playingSegmentIndex + 1];
          setPlayingSegmentIndex(playingSegmentIndex + 1);
          playerRef.current.seekTo(nextSegment.start);
        } else {
          // Finished all segments
          setIsPlaying(false);
          setPlayingSegmentIndex(null);
        }
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      addSegment(currentTime);
    } else if (e.key === ' ') {
      e.preventDefault();
      setIsPlaying(!isPlaying);
    }
  };

  const addSegment = (startTime) => {
    const newSegment = {
      id: Date.now(),
      start: startTime,
      end: Math.min(startTime + 5, duration)
    };
    const updatedSegments = [...segments, newSegment];
    setSegments(updatedSegments);
    onUpdateProject({
      ...project,
      segments: updatedSegments
    });
  };

  const updateSegment = (segmentId, updates) => {
    const updatedSegments = segments.map(seg =>
      seg.id === segmentId ? { ...seg, ...updates } : seg
    );
    setSegments(updatedSegments);
    onUpdateProject({
      ...project,
      segments: updatedSegments
    });
  };

  const deleteSegment = (segmentId) => {
    const updatedSegments = segments.filter(seg => seg.id !== segmentId);
    setSegments(updatedSegments);
    setSelectedSegment(null);
    onUpdateProject({
      ...project,
      segments: updatedSegments
    });
  };

  const exportVideo = async () => {
    if (segments.length === 0) {
      alert('No segments to export');
      return;
    }

    setIsExporting(true);
    try {
      const response = await axios.post(`/api/projects/${projectId}/export`, {}, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${project.name}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting video:', error);
      alert('Failed to export video');
    } finally {
      setIsExporting(false);
    }
  };

  const playSegment = (segment) => {
    if (playerRef.current) {
      playerRef.current.seekTo(segment.start);
      setIsPlaying(true);
      setSelectedSegment(segment);
      setPlayingSegmentIndex(null);
      
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.seekTo(segment.end);
          setIsPlaying(false);
        }
      }, (segment.end - segment.start) * 1000);
    }
  };

  const playAllSegments = () => {
    if (segments.length === 0) return;
    
    const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
    setPlayingSegmentIndex(0);
    playerRef.current.seekTo(sortedSegments[0].start);
    setIsPlaying(true);
  };

  if (!project) {
    return (
      <div className="loading">
        <p>Loading project...</p>
      </div>
    );
  }

  return (
    <div 
      className="video-editor" 
      onKeyDown={handleKeyPress} 
      tabIndex={0}
      ref={editorRef}
      style={{ outline: 'none' }}
    >
      <div className="editor-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h2>{project.name}</h2>
        <div className="editor-actions">
          <button 
            onClick={playAllSegments}
            disabled={segments.length === 0}
            className="play-all-btn"
          >
            Play All Clips
          </button>
          <button 
            onClick={exportVideo} 
            disabled={isExporting || segments.length === 0}
            className="export-btn"
          >
            {isExporting ? 'Exporting...' : 'Export Video'}
          </button>
        </div>
      </div>

      <div className="video-container">
        {isDownloading ? (
          <DownloadProgress progress={downloadProgress} />
        ) : project.video_path ? (
          <ReactPlayer
            ref={playerRef}
            url={project.video_path}
            playing={isPlaying}
            onProgress={handleProgress}
            onDuration={setDuration}
            width="100%"
            height="100%"
            controls={true}
            progressInterval={50}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <div className="no-video">
            <p>No video loaded</p>
            <button onClick={downloadVideo}>Download Video</button>
          </div>
        )}
      </div>

      <div className="timeline-container">
        <Timeline
          segments={segments}
          duration={duration}
          currentTime={currentTime}
          selectedSegment={selectedSegment}
          onSegmentSelect={setSelectedSegment}
          onSegmentUpdate={updateSegment}
          onSegmentDelete={deleteSegment}
          onSegmentPlay={playSegment}
          onSeek={(time) => playerRef.current?.seekTo(time)}
        />
      </div>

      <div className="editor-info">
        <p>Press 'S' to add a 5-second clip at current time | Press Space to play/pause</p>
        <p>Scroll on timeline to zoom in/out | Click timeline to seek</p>
        <p>Current time: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s | Clips: {segments.length}</p>
      </div>
    </div>
  );
};

export default VideoEditor;
