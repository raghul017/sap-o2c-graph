FROM python:3.11-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean

WORKDIR /app

# Install Python deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt

# Install and build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY . .
RUN cd frontend && npm run build

EXPOSE 8080

CMD cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
