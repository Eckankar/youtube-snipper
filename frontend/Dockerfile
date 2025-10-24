FROM node:18-alpine

WORKDIR /app

# Ensure proxy points to the backend service in Docker
ENV REACT_APP_API_URL=http://backend:5000

# Copy package files
COPY package*.json ./

# Install dependencies as root first
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
