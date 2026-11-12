# ZELVORA production image: React build + Python API in one origin.
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_BASE=/
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ZELVORA_ENV=production \
    ZELVORA_API_HOST=0.0.0.0 \
    ZELVORA_STATIC_DIR=/app/static \
    ZELVORA_COOKIE_SECURE=1 \
    ZELVORA_COOKIE_SAMESITE=Lax \
    ZELVORA_SESSION_STORE=db \
    ZELVORA_AUTO_MIGRATE=1 \
    PORT=8000
WORKDIR /app
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY database/ database/
COPY --from=frontend /app/frontend/dist /app/static
RUN useradd --create-home --uid 10001 zelvora
USER zelvora
EXPOSE 8000
CMD ["python", "backend/start.py"]
