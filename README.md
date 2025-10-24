# YouTube Snipper 🎬✂️

**YouTube Snipper** is a simple little web application that lets you extract and combine the best moments from any YouTube video (or other supported video sources) into a single compilation clip. Perfect for creating highlight reels, funny moment compilations, or condensing long videos into their most valuable segments.

## ✨ What Does It Do?

Ever watched a long video and wished you could just extract the best parts? YouTube Snipper makes it easy:

1. **Download any video** from YouTube or other supported platforms
2. **Visually select clips** using an interactive timeline editor
3. **Preview your selections** before exporting
4. **Export a single video** containing only your chosen moments

Whether you're creating gaming highlights, educational summaries, or comedy compilations, YouTube Snipper streamlines the entire process into a simple, intuitive workflow.

![YouTube Snipper Editor Screenshot](docs/screenshots/screenshot_initial_release_2025-10-24.png)

---

## 🚀 Quick Start

### Option 1: One-File Install (No Cloning Needed)

You can run YouTube Snipper by simply downloading the [docker-compose.yml](https://github.com/Eckankar/youtube-snipper/raw/main/docker-compose.yml) file and placing it in a folder on your computer. This works great with platforms like **Dockge**, **Portainer**, or any system that can run Docker Compose.

1. **Download docker-compose.yml**
   - [Get the file here](https://github.com/Eckankar/youtube-snipper/raw/main/docker-compose.yml)
   - Place it in a folder (e.g. `youtube-snipper`)

2. **Create a `.env` file for configuration**
   - Download [`.env.example`](https://github.com/Eckankar/youtube-snipper/raw/main/.env.example) to the same folder and rename it to `.env`
   - Edit `.env` and configure:
     - **User permissions:**
       - **Windows users**: Use `UID=1000` and `GID=1000`
       - **Mac/Linux users**: Run `id -u` and `id -g` to get your IDs, then update `.env`
     - **Projects folder:** Set `PROJECTS_PATH` to where you want to store downloaded videos and projects
       - **Windows example**: `PROJECTS_PATH=C:/Users/YourName/youtube-snipper-data`
       - **Mac/Linux example**: `PROJECTS_PATH=/home/yourname/youtube-snipper-data`
       - If not set, defaults to `./projects` (a subfolder next to docker-compose.yml)

3. **Start the app**
   ```bash
   docker-compose up
   ```
   Or use your Docker Compose GUI (Dockge, Portainer, etc.) to start the stack.

4. **Open the app**
   - Go to [http://localhost:3000](http://localhost:3000) in your browser

5. **Stop the app**
   ```bash
   docker-compose down
   ```

---

### Option 2: Manual Install (Clone the Repo)

If you want to modify the code or run in development mode:

1. **Clone the repository**
   ```bash
   git clone https://github.com/Eckankar/youtube-snipper.git
   cd youtube-snipper
   ```

2. **Configure user permissions and projects folder**
   ```bash
   # On Windows (PowerShell):
   copy .env.example .env

   # On Mac/Linux:
   cp .env.example .env
   ```
   - Edit `.env`:
     - **User permissions:** Set `UID` and `GID` as above for your OS
     - **Projects folder:** Set `PROJECTS_PATH` to your desired location
       - If not set, defaults to `./projects` (a subfolder in the repository)
       - Consider using a location outside the repo if you want to persist data across repo updates

3. **Start the application**
   ```bash
   docker-compose up
   ```

4. **Open the app**
   - Go to [http://localhost:3000](http://localhost:3000)

5. **Stop the app**
   ```bash
   docker-compose down
   ```

---

## 📖 How to Use

### Creating Your First Project

1. **Click "New Project"** in the top-right corner
2. **Enter a project name** (optional - will auto-fill from video title if not given)
3. **Paste the video URL** from YouTube or another supported site
4. **Click "Create Project"**

The video will begin downloading automatically. Progress is shown with a live progress bar including download speed and estimated time remaining.

### Editing Your Clips

Once the video downloads, you'll see the editor interface:

#### Timeline Controls
- **Click the timeline** to jump to any point in the video
- **Press 'S'** to quickly add a 5-second clip starting at the current time
- **Press Space** to play/pause the video
- **Scroll on the timeline** to zoom in/out for precise editing

#### Working with Segments
- **Drag the edges** of any clip to adjust its start/end time
- **Drag the entire clip** to move it to a different part of the timeline
- **Click a clip** to select it and show controls
- **Click "Play"** on a segment to preview just that clip
- **Click "Delete"** to remove an unwanted segment
- **Use "Play All Clips"** to preview all segments in sequence

#### Exporting Your Video

1. Click **"Export Video"** when you're happy with your clips
2. Wait for processing (usually takes 30 seconds to a few minutes)
3. Your compiled video will download automatically

---

## 💻 For Developers

### Project Structure

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

### Tech Stack

- **Backend**: Flask, yt-dlp, FFmpeg, Redis
- **Frontend**: React, ReactPlayer, Axios
- **Infrastructure**: Docker, Docker Compose
- **CI/CD**: GitHub Actions, GitHub Container Registry

### Development Setup

#### Option 1: Using Pre-built Images (Quick Start)

Use this if you just want to run the app without modifying code:

```bash
# Clone and configure (see Quick Start above)
docker-compose up
```

Images are automatically pulled from GitHub Container Registry.

#### Option 2: Local Development with Hot Reload

Use this if you want to modify the code and see changes immediately:

1. **Clone and configure** (see Quick Start above)

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

### Switching Between Modes

**Production (pre-built images):**
```bash
docker-compose up
```

**Development (local builds):**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Building and Testing Images Locally

To test your changes before pushing:

```bash
# Build images locally
docker-compose -f docker-compose.dev.yml build

# Run with local builds
docker-compose -f docker-compose.dev.yml up
```

### CI/CD Pipeline

When you push to the `main` branch, GitHub Actions automatically:
1. Builds both backend and frontend Docker images
2. Tags them with `latest` and the git SHA
3. Pushes them to GitHub Container Registry at:
   - `ghcr.io/eckankar/youtube-snipper-backend:latest`
   - `ghcr.io/eckankar/youtube-snipper-frontend:latest`

You can manually trigger the workflow from the Actions tab on GitHub.

### API Endpoints

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/download` - Start video download
- `GET /api/projects/:id/download/progress` - SSE stream for download progress
- `POST /api/projects/:id/export` - Export edited video

### Environment Variables

- `UID` / `GID` - User/group ID for file permissions
- `PROJECTS_PATH` - Path to store downloaded videos and project data (defaults to ./projects)
- `FLASK_ENV` - Flask environment (development/production)
- `REDIS_URL` - Redis connection string
- `LOG_LEVEL` - Logging verbosity (debug/info/warning/error)

---

## 🐛 Troubleshooting

**Video won't download:**
- Check if the URL is from a supported site (YouTube, Vimeo, etc.)
- Some videos may be region-locked or age-restricted

**Permission errors on Linux/Mac:**
- Make sure your `UID` and `GID` in `.env` match your user
- Run `id -u` and `id -g` to find correct values

**Docker issues:**
- Try `docker-compose down -v` to clean up, then rebuild
- Make sure Docker Desktop is running
- For development: `docker-compose -f docker-compose.dev.yml down -v`

**Frontend won't load:**
- Wait 30 seconds after "webpack compiled" message
- Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

**Images not updating:**
- Pull latest images: `docker-compose pull`
- For development, rebuild: `docker-compose -f docker-compose.dev.yml up --build`

---

## ⚠️ Buyer beware

This project is largely "vibe-coded" — experimental, informal, and not production-hardened. It is intended for single-person use on a trusted internal network only. Do not expose backend or Redis services to the public Internet; use at your own risk.

---

## 📝 License

This project is open source and available under the MIT License.