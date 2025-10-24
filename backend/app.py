from flask import Flask, request, jsonify, send_file, stream_with_context
from flask_cors import CORS
import os
import json
import yt_dlp
import subprocess
from datetime import datetime
import uuid
from werkzeug.utils import secure_filename
import threading
import tempfile
import redis
import time
import logging

app = Flask(__name__)
CORS(app)

# Configure logging (env-driven)
log_level_name = os.getenv('LOG_LEVEL', 'INFO').upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Log toolchain info at startup
try:
    ytdlp_version = getattr(yt_dlp, '__version__', None) or getattr(getattr(yt_dlp, 'version', None), '__version__', 'unknown')
    logger.info(f"yt-dlp version: {ytdlp_version} (module: {getattr(yt_dlp, '__file__', '<unknown>')})")
except Exception:
    logger.warning("Unable to determine yt-dlp version", exc_info=True)

try:
    ffmpeg_ver = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, check=False)
    first_line = (ffmpeg_ver.stdout or '').splitlines()[0] if ffmpeg_ver.stdout else 'ffmpeg version: <unavailable>'
    logger.info(first_line)
except Exception:
    logger.warning("Unable to determine ffmpeg version", exc_info=True)

# Request logging middleware
@app.before_request
def log_request_info():
    logger.info(f"Request: {request.method} {request.path} from {request.remote_addr}")

@app.after_request
def log_response_info(response):
    logger.info(f"Response: {response.status_code} for {request.method} {request.path}")
    return response

# Configuration
DEFAULT_PROJECT_NAME = "Untitled Project"
PROJECTS_DIR = "/app/projects"
CACHE_DIR = "/app/projects/.cache"
os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

# Redis connection for shared state between workers
redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))

class ProjectManager:
    def __init__(self):
        self.projects = {}
        self.load_projects()
    
    def load_projects(self):
        for project_id in os.listdir(PROJECTS_DIR):
            project_path = os.path.join(PROJECTS_DIR, project_id)
            if os.path.isdir(project_path):
                meta_file = os.path.join(project_path, "meta.json")
                if os.path.exists(meta_file):
                    with open(meta_file, 'r') as f:
                        self.projects[project_id] = json.load(f)
    
    def save_project(self, project_id, data):
        project_path = os.path.join(PROJECTS_DIR, project_id)
        os.makedirs(project_path, exist_ok=True)
        
        meta_file = os.path.join(project_path, "meta.json")
        with open(meta_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        self.projects[project_id] = data
    
    def get_project(self, project_id):
        return self.projects.get(project_id)
    
    def delete_project(self, project_id):
        project_path = os.path.join(PROJECTS_DIR, project_id)
        if os.path.exists(project_path):
            import shutil
            shutil.rmtree(project_path)
        if project_id in self.projects:
            del self.projects[project_id]

project_manager = ProjectManager()

@app.route('/api/projects', methods=['GET'])
def list_projects():
    return jsonify(list(project_manager.projects.values()))

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    project_id = str(uuid.uuid4())
    
    project = {
        'id': project_id,
        'name': data.get('name', DEFAULT_PROJECT_NAME),
        'url': data.get('url'),
        'created_at': datetime.now().isoformat(),
        'segments': [],
        'video_path': None,
        'duration': None
    }
    
    project_manager.save_project(project_id, project)
    return jsonify(project)

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    project = project_manager.get_project(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify(project)

@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    project = project_manager.get_project(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    data = request.json
    project.update(data)
    project_manager.save_project(project_id, project)
    return jsonify(project)

@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = project_manager.get_project(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    project_manager.delete_project(project_id)
    return jsonify({'success': True})

@app.route('/api/projects/<project_id>/download', methods=['POST'])
def download_video(project_id):
    project = project_manager.get_project(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    # Check if download is already in progress using Redis, but clear stale locks
    active_key = f'download:active:{project_id}'
    heartbeat_key = f'download:heartbeat:{project_id}'
    if redis_client.exists(active_key):
        try:
            hb_raw = redis_client.get(heartbeat_key)
            now = int(time.time())
            hb = int(hb_raw) if hb_raw is not None else None
            # Consider a lock stale if no heartbeat within 60s
            if hb is None or (now - hb) > 60:
                logger.warning(f"Stale download lock detected for project {project_id}; clearing.")
                redis_client.delete(active_key)
                redis_client.delete(heartbeat_key)
            else:
                return jsonify({'error': 'Download already in progress'}), 409
        except Exception:
            # Fail safe: keep behavior if parsing fails
            return jsonify({'error': 'Download already in progress'}), 409
    
    # Mark download as active with expiration (safety net)
    redis_client.setex(active_key, 3600, '1')
    
    def download_task():
        import shutil

        # Publish 'started' and initialize heartbeat
        try:
            redis_client.publish(f'download:progress:{project_id}', json.dumps({'status': 'started'}))
            now = int(time.time())
            redis_client.setex(heartbeat_key, 3600, now)
        except Exception:
            logger.warning(f"Failed to initialize heartbeat for project {project_id}", exc_info=True)

        def progress_hook(d):
            # Update heartbeat (throttled to ~1s)
            nonlocal_last = getattr(progress_hook, "_last_hb", 0)
            now_ts = int(time.time())
            if now_ts != nonlocal_last:
                try:
                    redis_client.setex(heartbeat_key, 3600, now_ts)
                except Exception:
                    logger.debug("Heartbeat update failed", exc_info=True)
                progress_hook._last_hb = now_ts

            if d['status'] == 'downloading':
                downloaded = d.get('downloaded_bytes', 0)
                total = d.get('total_bytes', 0) or d.get('total_bytes_estimate', 0)
                percent = int(downloaded / total * 100) if total else 0
                entry = {
                    'status': 'downloading',
                    'percent': percent,
                    'downloaded': downloaded,
                    'total': total,
                    'speed': d.get('_speed_str', '0B/s').strip(),
                    'eta': d.get('_eta_str', 'Unknown').strip()
                }
                logger.debug(f"yt-dlp progress: {percent}% ({downloaded}/{total}) {entry['speed']} ETA {entry['eta']}")
                # Publish progress to Redis
                redis_client.publish(f'download:progress:{project_id}', json.dumps(entry))
            elif d['status'] == 'finished':
                logger.info("yt-dlp reports status=finished (merge/post-process done)")
                redis_client.publish(f'download:progress:{project_id}', json.dumps({'status': 'finished'}))
        
        # Create per-project temp dir under the system temp folder
        temp_dir = os.path.join(tempfile.gettempdir(), 'youtube-snipper', project_id)
        os.makedirs(temp_dir, exist_ok=True)

        ydl_opts = {
            'format': 'best[ext=mp4]',
            'outtmpl': os.path.join(temp_dir, 'video.%(ext)s'),
            'progress_hooks': [progress_hook],
            'cachedir': CACHE_DIR,
            'concurrent_fragment_downloads': 1,
            # Route yt-dlp logs into our logger
            'logger': logger,
            # More verbose logs when app log level is DEBUG
            'verbose': log_level == logging.DEBUG,
            'quiet': False,
            'no_warnings': False,
        }
        
        try:
            logger.info(f"Initializing yt-dlp for project {project_id} (thread={threading.get_ident()})")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                logger.info(f"Calling yt_dlp.extract_info(download=False) for URL {project['url']}")
                info = ydl.extract_info(project['url'], download=False)
                video_title = info.get('title', project['name'])
                logger.info(f"yt-dlp returned metadata: title='{video_title}', duration={info.get('duration')}s")

                if project['name'] in [DEFAULT_PROJECT_NAME, '']:
                    project['name'] = video_title
                    project_manager.save_project(project_id, project)

                logger.info("Calling yt_dlp.extract_info(download=True) to start download")
                info = ydl.extract_info(project['url'], download=True)
            
            project_dir = os.path.join(PROJECTS_DIR, project_id)
            os.makedirs(project_dir, exist_ok=True)

            downloaded_path = None
            if info.get('requested_downloads'):
                for item in info['requested_downloads']:
                    candidate = item.get('filepath') or item.get('_filename')
                    if candidate and os.path.exists(candidate):
                        downloaded_path = candidate
                        break
            if not downloaded_path:
                candidate = info.get('filepath') or info.get('_filename')
                if candidate and os.path.exists(candidate):
                    downloaded_path = candidate
            if not downloaded_path:
                raise RuntimeError('Downloaded file not found')

            final_video_path = os.path.join(project_dir, 'video.mp4')
            if os.path.exists(final_video_path):
                os.remove(final_video_path)

            shutil.move(downloaded_path, final_video_path)

            project['video_path'] = f"/projects/{project_id}/video.mp4"
            project['duration'] = info.get('duration')
            project['title'] = info.get('title')
            project_manager.save_project(project_id, project)
            
            redis_client.publish(f'download:progress:{project_id}', json.dumps({'status': 'complete', 'duration': project['duration'], 'title': video_title}))
        except Exception as e:
            logger.exception(f"yt-dlp download failed for project {project_id}: {e}")
            redis_client.publish(f'download:progress:{project_id}', json.dumps({'status': 'error', 'error': str(e)}))
        finally:
            # Cleanup
            redis_client.delete(f'download:active:{project_id}')
            redis_client.delete(heartbeat_key)
            # Cleanup temp dir
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
    
    # Start download in background thread
    thread = threading.Thread(target=download_task)
    thread.daemon = True
    thread.start()
    
    return jsonify({'success': True, 'message': 'Download started'})

@app.route('/api/projects/<project_id>/download/progress')
def download_progress_stream(project_id):
    @stream_with_context
    def generate():
        hb_key = f'download:heartbeat:{project_id}'
        active_key = f'download:active:{project_id}'
        if not redis_client.exists(active_key):
            yield f"data: {json.dumps({'status': 'error', 'error': 'No download in progress'})}\n\n"
            return
        
        pubsub = redis_client.pubsub()
        pubsub.subscribe(f'download:progress:{project_id}')
        
        try:
            last_sent = time.time()
            yield f": connected\n\n"
            while True:
                message = pubsub.get_message(ignore_subscribe_messages=True)
                if message:
                    # Ensure message['data'] is a string
                    data = message['data']
                    if isinstance(data, bytes):
                        data = data.decode('utf-8')
                    logger.debug(f"Emitting progress update for project {project_id}: {data}")
                    progress = json.loads(data)
                    yield f"data: {json.dumps(progress)}\n\n"
                    last_sent = time.time()
                    if progress.get('status') in ['complete', 'error']:
                        break
                else:
                    # Keepalive every 10s
                    now = time.time()
                    if now - last_sent >= 10:
                        yield f": keepalive {int(now)}\n\n"
                        last_sent = now
                    # If lock exists but heartbeat is stale, end stream
                    hb_raw = redis_client.get(hb_key)
                    hb = int(hb_raw) if hb_raw is not None else None
                    if hb is None or (int(now) - hb) > 60:
                        yield f"data: {json.dumps({'status': 'error', 'error': 'Stale download detected'})}\n\n"
                        break
                    time.sleep(1)
        finally:
            pubsub.unsubscribe()
            pubsub.close()
    
    cors_headers = {
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    }

    return generate(), { **cors_headers, 'Content-Type': 'text/event-stream' }

@app.route('/api/projects/<project_id>/export', methods=['POST'])
def export_video(project_id):
    project = project_manager.get_project(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if not project['segments']:
        return jsonify({'error': 'No segments to export'}), 400
    
    # Get the actual video file path
    video_file_path = os.path.join(PROJECTS_DIR, project_id, 'video.mp4')
    if not os.path.exists(video_file_path):
        return jsonify({'error': 'Video file not found'}), 404
    
    output_path = os.path.join(PROJECTS_DIR, project_id, 'output.mp4')
    
    # Build ffmpeg filter_complex for concatenating segments
    filter_parts = []
    input_parts = []
    
    for i, segment in enumerate(project['segments']):
        # Add input with seeking and duration
        input_parts.extend(['-ss', str(segment['start']), '-t', str(segment['end'] - segment['start']), '-i', video_file_path])
        filter_parts.append(f"[{i}:v][{i}:a]")
    
    # Create the filter_complex string
    filter_complex = f"{''.join(filter_parts)}concat=n={len(project['segments'])}:v=1:a=1[outv][outa]"
    
    cmd = ['ffmpeg', '-y'] + input_parts + [
        '-filter_complex', filter_complex,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        output_path
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return send_file(output_path, as_attachment=True, download_name=f"{project['name']}.mp4")
    except subprocess.CalledProcessError as e:
        return jsonify({'error': f'FFmpeg error: {e.stderr}'}), 500

@app.route('/projects/<project_id>/video.mp4')
def serve_video(project_id):
    video_path = os.path.join(PROJECTS_DIR, project_id, 'video.mp4')
    if not os.path.exists(video_path):
        return jsonify({'error': 'Video not found'}), 404
    return send_file(video_path)
