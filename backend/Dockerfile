FROM python:3.11-slim

WORKDIR /app

# Ensure unbuffered stdout/stderr for timely logs
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Upgrade yt-dlp to the latest version
RUN pip install --no-cache-dir --upgrade yt-dlp

# Copy application code
COPY . .

# Create projects directory
RUN mkdir -p /app/projects

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--worker-class", "gevent", "--workers", "4", "--timeout", "300", "--access-logfile", "-", "--access-logformat", "%(h)s %(l)s %(u)s %(t)s \"%(r)s\" %(s)s %(b)s \"%(f)s\" \"%(a)s\" %(D)s", "app:app"]
