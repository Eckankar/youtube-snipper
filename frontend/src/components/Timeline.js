import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

const Timeline = ({
  segments,
  duration,
  currentTime,
  selectedSegment,
  onSegmentSelect,
  onSegmentUpdate,
  onSegmentDelete,
  onSegmentPlay,
  onSeek
}) => {
  const [isDragging, setIsDragging] = useState(null);
  const [dragType, setDragType] = useState(null);
  const timelineRef = useRef(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);
  
  // Zoom state: zoom level (1.0 = normal, >1 = zoomed in) and offset (in seconds)
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [zoomOffset, setZoomOffset] = useState(0);

  // measure width after mount and on resize
  useLayoutEffect(() => {
    const measure = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.offsetWidth || 0);
      }
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined' && timelineRef.current) {
      ro = new ResizeObserver(measure);
      ro.observe(timelineRef.current);
    } else {
      window.addEventListener('resize', measure);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', measure);
    };
  }, []);

  // Get visible duration based on zoom
  const getVisibleDuration = () => {
    return duration / zoomLevel;
  };

  // Get visible start time based on offset
  const getVisibleStart = () => {
    return Math.max(0, Math.min(zoomOffset, duration - getVisibleDuration()));
  };

  // Convert pixels to time with zoom
  const pixelsToTime = (pixels) => {
    if (!timelineWidth || !duration) return 0;
    const visibleDuration = getVisibleDuration();
    const visibleStart = getVisibleStart();
    return visibleStart + (pixels / timelineWidth) * visibleDuration;
  };

  // Convert time to pixels with zoom
  const timeToPixels = (time) => {
    if (!timelineWidth || !duration) return 0;
    const visibleDuration = getVisibleDuration();
    const visibleStart = getVisibleStart();
    return ((time - visibleStart) / visibleDuration) * timelineWidth;
  };

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const timeAtMouse = pixelsToTime(mouseX);
    
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1.0, Math.min(100.0, zoomLevel * zoomDelta));
    
    // Calculate new offset to keep time at mouse in same position
    const newVisibleDuration = duration / newZoom;
    const mouseRatio = mouseX / timelineWidth;
    const newOffset = timeAtMouse - (newVisibleDuration * mouseRatio);
    
    setZoomLevel(newZoom);
    setZoomOffset(Math.max(0, Math.min(newOffset, duration - newVisibleDuration)));
  }, [zoomLevel, duration, timelineWidth, pixelsToTime]);

  const handleMouseDown = (e, segmentId, type) => {
    e.stopPropagation();
    setIsDragging(segmentId);
    setDragType(type);
  };

  // update handleMouseMove to work with zoom
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelsToTime(x);

    const segment = segments.find(s => s.id === isDragging);
    if (!segment) return;

    if (dragType === 'move') {
      const segmentDuration = segment.end - segment.start;
      const newStart = Math.max(0, Math.min(time, duration - segmentDuration));
      onSegmentUpdate(isDragging, {
        start: newStart,
        end: newStart + segmentDuration
      });
    } else if (dragType === 'start') {
      const newStart = Math.max(0, Math.min(time, segment.end - 0.5));
      onSegmentUpdate(isDragging, { start: newStart });
    } else if (dragType === 'end') {
      const newEnd = Math.min(duration, Math.max(time, segment.start + 0.5));
      onSegmentUpdate(isDragging, { end: newEnd });
    }
  }, [isDragging, dragType, duration, segments, onSegmentUpdate, pixelsToTime]);

  const handleMouseUp = () => {
    setIsDragging(null);
    setDragType(null);
  };

  const handleTimelineClick = (e) => {
    // guard for null ref
    if (!timelineRef.current) return;
    if (e.target === timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = pixelsToTime(x);
      onSeek(time);
    }
  };

  // calculate sensible time interval for markers based on duration
  const getTimeInterval = () => {
    const visibleDuration = getVisibleDuration();
    if (visibleDuration <= 60) return 5;        // <= 1 min: every 5s
    if (visibleDuration <= 300) return 30;      // <= 5 min: every 30s
    if (visibleDuration <= 1800) return 60;     // <= 30 min: every 1 min
    if (visibleDuration <= 3600) return 300;    // <= 1 hour: every 5 min
    return 600;                          // > 1 hour: every 10 min
  };

  // update hover tooltip when mouse moves over the timeline
  const handleTimelineMouseMove = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelsToTime(x);
    setHoverTime(time);
    setHoverPosition(x);
  };

  // clear hover state when leaving the timeline
  const handleTimelineMouseLeave = () => {
    setHoverTime(null);
    setHoverPosition(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove]);

  // Add wheel event listener
  useEffect(() => {
    const timeline = timelineRef.current;
    if (timeline) {
      timeline.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        timeline.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  // Render time markers for visible range
  const renderTimeMarkers = () => {
    const interval = getTimeInterval();
    const visibleStart = getVisibleStart();
    const visibleEnd = visibleStart + getVisibleDuration();
    const firstMarker = Math.floor(visibleStart / interval) * interval;
    
    const markers = [];
    for (let time = firstMarker; time <= visibleEnd; time += interval) {
      if (time >= 0 && time <= duration) {
        markers.push(
          <div 
            key={time} 
            className="time-marker"
            style={{ left: `${timeToPixels(time)}px` }}
          >
            {formatTime(time)}
          </div>
        );
      }
    }
    return markers;
  };

  return (
    <div className="timeline">
      <div 
        className="timeline-track"
        ref={timelineRef}
        onClick={handleTimelineClick}
        onMouseMove={handleTimelineMouseMove}
        onMouseLeave={handleTimelineMouseLeave}
      >
        {/* Current time indicator */}
        <div 
          className="current-time-indicator"
          style={{ left: `${timeToPixels(currentTime)}px` }}
        />

        {/* Hover tooltip */}
        {hoverTime !== null && hoverPosition !== null && (
          <div 
            className="hover-time-tooltip"
            style={{ left: `${hoverPosition}px` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Render only visible segments */}
        {segments.map(segment => {
          const left = timeToPixels(segment.start);
          const width = timeToPixels(segment.end) - left;
          
          // Skip if segment is outside visible range
          if (left + width < 0 || left > timelineWidth) return null;
          
          return (
            <div
              key={segment.id}
              className={`timeline-segment ${selectedSegment?.id === segment.id ? 'selected' : ''}`}
              style={{
                left: `${left}px`,
                width: `${width}px`
              }}
              onClick={() => onSegmentSelect(segment)}
            >
              {/* Resize handles */}
              <div 
                className="resize-handle start"
                onMouseDown={(e) => handleMouseDown(e, segment.id, 'start')}
              />
              <div 
                className="resize-handle end"
                onMouseDown={(e) => handleMouseDown(e, segment.id, 'end')}
              />
              
              {/* Segment content */}
              <div 
                className="segment-content"
                onMouseDown={(e) => handleMouseDown(e, segment.id, 'move')}
              >
                <span className="segment-time">
                  {segment.start.toFixed(1)}s - {segment.end.toFixed(1)}s
                </span>
              </div>

              {/* Controls */}
              {selectedSegment?.id === segment.id && (
                <div className="segment-controls">
                  <button onClick={() => onSegmentPlay(segment)}>Play</button>
                  <button onClick={() => onSegmentDelete(segment.id)}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="time-markers">
        {renderTimeMarkers()}
      </div>
      
      {zoomLevel > 1 && (
        <div className="zoom-info">
          Zoom: {zoomLevel.toFixed(1)}x (scroll to zoom)
        </div>
      )}
    </div>
  );
};

// Helper function to format time
const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default Timeline;
