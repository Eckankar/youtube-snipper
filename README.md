# YouTube Snipper 🎬✂️

**YouTube Snipper** is a powerful yet user-friendly web application that lets you extract and combine the best moments from any YouTube video (or other supported video sources) into a single compilation clip. Perfect for creating highlight reels, funny moment compilations, or condensing long videos into their most valuable segments.

## ✨ What Does It Do?

Ever watched a long video and wished you could just extract the best parts? YouTube Snipper makes it easy:

1. **Download any video** from YouTube or other supported platforms
2. **Visually select clips** using an interactive timeline editor
3. **Preview your selections** before exporting
4. **Export a single video** containing only your chosen moments

Whether you're creating gaming highlights, educational summaries, or comedy compilations, YouTube Snipper streamlines the entire process into a simple, intuitive workflow.

---

## 🚀 Quick Start (For Everyone)

### Prerequisites

You only need two things installed on your computer:
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (Windows/Mac/Linux)
- **A web browser** (Chrome, Firefox, Safari, etc.)

That's it! Docker will handle everything else automatically.

### Installation & Running

1. **Download this project**
   - Click the green "Code" button at the top of this page → "Download ZIP"
   - Extract the ZIP file to a folder on your computer
   
   *OR if you know Git:*
   ```bash
   git clone https://github.com/yourusername/youtube-snipper.git
   cd youtube-snipper
   ```

2. **Configure user permissions** (important!)
   
   Copy the example configuration file:
   ```bash
   # On Windows (PowerShell):
   copy .env.example .env
   
   # On Mac/Linux:
   cp .env.example .env
   ```
   
   Then edit the `.env` file:
   - **Windows users**: Set both `UID=1000` and `GID=1000` (already the default)
   - **Mac/Linux users**: Run these commands to find your IDs, then update `.env`:
     ```bash
     id -u    # Your user ID
     id -g    # Your group ID
     ```

3. **Start the application**
   
   Open a terminal/command prompt in the project folder and run:
   ```bash
   docker-compose up --build
   ```
   
   First-time setup takes 2-5 minutes as Docker downloads everything needed.
   
   You'll know it's ready when you see messages like:
   ```
   backend_1   | Booting worker with pid: ...
   frontend_1  | webpack compiled successfully
   ```

   Note: only the frontend service is exposed to your host (http://localhost:3000). The backend and Redis services run inside the Docker network and are reachable from the frontend via the internal hostnames (backend, redis). They are not bound to host ports by default.

4. **Open the app**
   
   Go to **http://localhost:3000** in your web browser

5. **Stop the application**
   
   Press `Ctrl+C` in the terminal, then run:
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
├── backend/          # Flask API (Python)
│   ├── app.py       # Main application logic
│   └── Dockerfile
├── frontend/         # React UI (JavaScript)
│   ├── src/
│   │   ├── components/
│   │   └── App.js
│   └── Dockerfile
├── projects/         # Stored project data (created automatically)
└── docker-compose.yml
```

### Tech Stack

- **Backend**: Flask, yt-dlp, FFmpeg, Redis
- **Frontend**: React, ReactPlayer, Axios
- **Infrastructure**: Docker, Docker Compose

### Development Setup

1. **Clone and configure** (see Quick Start above)

2. **Start in development mode**:
   ```bash
   docker-compose up --build
   ```

3. **Access services**:
   - Frontend: http://localhost:3000
   - Backend API: accessible from the frontend at /api via the frontend proxy (not exposed to the host by default)
   - Redis: internal to the Docker network (not exposed to the host by default)

If you need to access the backend or Redis directly from your host (for debugging), either:
- Temporarily add port mappings back to docker-compose.yml for the relevant service(s), or
- Use docker-compose exec to run commands inside a container, e.g.:
  ```bash
  docker-compose exec backend /bin/sh
  docker-compose exec redis redis-cli -h redis
  ```

4. **Development features**:
   - Hot reload enabled for both frontend and backend
   - Logs visible in terminal
   - Projects directory mounted as volume (persists across restarts)

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

**Frontend won't load:**
- Wait 30 seconds after "webpack compiled" message
- Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

---

## ⚠️ Buyer beware

This project is largely "vibe-coded" — experimental, informal, and not production-hardened. It is intended for single-person use on a trusted internal network only. Do not expose backend or Redis services to the public Internet; use at your own risk.

---

## 📝 License

This project is open source and available under the MIT License.