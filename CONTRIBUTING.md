# Developer Guide

This guide covers technical details for developers who want to contribute to or modify YouTube Snipper.

## 📁 Project Structure

```
youtube-snipper/
├── .github/
│   └── workflows/
│       └── docker-publish.yml  # CI/CD for building images
├── backend/          # Flask API (Python)
│   ├── app.py       # Main application logic
│   └── Dockerfile
├── frontend/         # React UI (JavaScript)
│   ├── src/
│   │   ├── components/
│   │   └── App.js
│   └── Dockerfile
├── projects/         # Stored project data (created automatically)
├── docker-compose.yml      # Production setup (uses pre-built images)
└── docker-compose.dev.yml  # Development setup (builds locally)
```

## 🛠️ Tech Stack

- **Backend**: Flask, yt-dlp, FFmpeg, Redis
- **Frontend**: React, ReactPlayer, Axios
- **Infrastructure**: Docker, Docker Compose
- **CI/CD**: GitHub Actions, GitHub Container Registry

## 🚀 Development Setup

### Option 1: Using Pre-built Images (Quick Start)

Use this if you just want to run the app without modifying code:

```bash
# Clone and configure (see README Quick Start)
docker-compose up
```

Images are automatically pulled from GitHub Container Registry.

### Option 2: Local Development with Hot Reload

Use this if you want to modify the code and see changes immediately:

1. **Clone and configure** (see README Quick Start)

2. **Start in development mode**:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

3. **Access services**:
   - Frontend: http://localhost:3000
   - Backend API: accessible from the frontend at /api via the frontend proxy (not exposed to the host by default)
   - Redis: internal to the Docker network (not exposed to the host by default)

4. **Development features**:
   - Hot reload enabled for both frontend and backend
   - Source code mounted as volumes
   - Logs visible in terminal
   - Projects directory persists across restarts

If you need to access the backend or Redis directly from your host (for debugging), either:
- Temporarily add port mappings to docker-compose.dev.yml for the relevant service(s), or
- Use docker-compose exec to run commands inside a container:
  ```bash
  docker-compose -f docker-compose.dev.yml exec backend /bin/sh
  docker-compose -f docker-compose.dev.yml exec redis redis-cli -h redis
  ```

## 🔄 Switching Between Modes

**Production (pre-built images):**
```bash
docker-compose up
```

**Development (local builds):**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## 🧪 Building and Testing Images Locally

To test your changes before pushing:

```bash
# Build images locally
docker-compose -f docker-compose.dev.yml build

# Run with local builds
docker-compose -f docker-compose.dev.yml up
```

## 🤖 CI/CD Pipeline

When you push to the `main` branch, GitHub Actions automatically:
1. Builds both backend and frontend Docker images
2. Tags them with `latest` and the git SHA
3. Pushes them to GitHub Container Registry at:
   - `ghcr.io/eckankar/youtube-snipper-backend:latest`
   - `ghcr.io/eckankar/youtube-snipper-frontend:latest`

You can manually trigger the workflow from the Actions tab on GitHub.

## 🔌 API Endpoints

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/download` - Start video download
- `GET /api/projects/:id/download/progress` - SSE stream for download progress
- `POST /api/projects/:id/export` - Export edited video

## ⚙️ Environment Variables

- `UID` / `GID` - User/group ID for file permissions
- `PROJECTS_PATH` - Path to store downloaded videos and project data (defaults to ./projects)
- `FLASK_ENV` - Flask environment (development/production)
- `REDIS_URL` - Redis connection string
- `LOG_LEVEL` - Logging verbosity (debug/info/warning/error)

## 🐛 Development Troubleshooting

**Images not updating:**
- Pull latest images: `docker-compose pull`
- For development, rebuild: `docker-compose -f docker-compose.dev.yml up --build`

**Docker cleanup:**
- Try `docker-compose down -v` to clean up, then rebuild
- For development: `docker-compose -f docker-compose.dev.yml down -v`

**Frontend won't load:**
- Wait 30 seconds after "webpack compiled" message
- Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
