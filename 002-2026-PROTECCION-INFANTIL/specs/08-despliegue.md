# 08 — Despliegue e Infraestructura

## 8.1 Entornos

| Entorno | Propósito | Acceso | Datos |
|---------|-----------|--------|-------|
| `local` | Desarrollo individual | Desarrollador | Seed data, mocks |
| `development` | Integración continua | Equipo técnico | Datos de prueba, anonimizados |
| `staging` | Validación pre-producción | QA + stakeholders | Snapshot anonimizado de producción |
| `production` | Operación real | Solo operaciones | Datos reales, backups encriptados |

---

## 8.2 Contenerización

### Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# No ejecutar como root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Docker Compose (Desarrollo Local)

```yaml
# docker-compose.yml
version: "3.8"

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: proteccion
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: proteccion_infantil
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U proteccion"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://proteccion:${DB_PASSWORD}@db:5432/proteccion_infantil
      - REDIS_URL=redis://redis:6379
      - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
      - JWT_PUBLIC_KEY=${JWT_PUBLIC_KEY}
      - MFA_ENCRYPTION_KEY=${MFA_ENCRYPTION_KEY}
      - CONFIG_ENCRYPTION_KEY=${CONFIG_ENCRYPTION_KEY}
      - EMAIL_SERVICE=${EMAIL_SERVICE}
      - EMAIL_API_KEY=${EMAIL_API_KEY}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - /app/node_modules

  web:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## 8.3 Pipeline CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd backend && npm ci
      - run: cd backend && npm run lint
      - run: cd backend && npm run test:unit
      - run: cd backend && npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run test
      - run: cd frontend && npm run build

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: "fs"
          format: "sarif"
          output: "trivy-results.sarif"
```

---

## 8.4 Infraestructura en AWS (Producción)

### Diagrama de Arquitectura Cloud

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Usuarios                                       │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CloudFront (CDN + WAF)                             │
│                    - TLS 1.3 terminación                                     │
│                    - DDoS protection (AWS Shield)                            │
│                    - Rate limiting por IP                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
            ┌─────────────┐             ┌─────────────┐
            │   S3 Bucket │             │   ALB       │
            │  (Frontend) │             │  (API)      │
            │  + OAI      │             │  HTTPS only │
            └─────────────┘             └──────┬──────┘
                                               │
                                               ▼
                                      ┌─────────────┐
                                      │  ECS Fargate │
                                      │  (Backend)   │
                                      │  2 tareas    │
                                      └──────┬──────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                        ┌─────────┐   ┌──────────┐   ┌──────────┐
                        │ RDS     │   │ElastiCache│   │ Secrets  │
                        │PostgreSQL│   │  Redis   │   │ Manager  │
                        │ Multi-AZ│   │          │   │          │
                        └─────────┘   └──────────┘   └──────────┘
```

### Componentes AWS

| Servicio | Uso | Configuración |
|----------|-----|---------------|
| **ECS Fargate** | Backend API | 2 tareas mínimo, auto-scaling por CPU/memoria |
| **RDS PostgreSQL** | Base de datos | Multi-AZ, encrypted at rest, backups diarios |
| **ElastiCache Redis** | Sesiones, caché, rate limit | Cluster mode, encrypted |
| **ALB** | Load balancer | HTTPS only, health checks, sticky sessions deshabilitadas |
| **CloudFront** | CDN + WAF | Caché de assets, reglas WAF personalizadas |
| **S3** | Frontend estático, backups | Versioning, encryption SSE-S3 |
| **Secrets Manager** | Claves de cifrado | Rotación automática JWT keys |
| **CloudWatch** | Logs y métricas | Retención 90 días, alertas |
| **Route 53** | DNS | Health checks, failover |

---

## 8.5 Variables de Entorno

### Obligatorias

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `production` |
| `DATABASE_URL` | URL de PostgreSQL | `postgresql://...` |
| `REDIS_URL` | URL de Redis | `redis://...` |
| `JWT_PRIVATE_KEY` | Clave privada RS256 (PEM) | `-----BEGIN PRIVATE KEY-----...` |
| `JWT_PUBLIC_KEY` | Clave pública RS256 (PEM) | `-----BEGIN PUBLIC KEY-----...` |
| `MFA_ENCRYPTION_KEY` | Clave AES-256 para MFA | `base64:32bytes` |
| `CONFIG_ENCRYPTION_KEY` | Clave AES-256 para config | `base64:32bytes` |
| `EMAIL_SERVICE` | Proveedor de email | `aws-ses` o `sendgrid` |
| `EMAIL_API_KEY` | API key del servicio de email | `SG.xxx` |
| `EMAIL_FROM` | Remitente de emails | `no-reply@proteccion-infantil.org` |

### Opcionales

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto del servidor |
| `LOG_LEVEL` | `info` | Nivel de logging |
| `CORS_ORIGIN` | `*` | Orígenes permitidos |
| `RATE_LIMIT_ENABLED` | `true` | Activar rate limiting |
| `METRICS_ENABLED` | `true` | Exponer métricas Prometheus |

---

## 8.6 Estrategia de Backup

| Componente | Frecuencia | Retención | Método |
|------------|-----------|-----------|--------|
| PostgreSQL | Diaria + continua (PITR) | 30 días | RDS automated backups + snapshots manuales |
| PostgreSQL | Semanal | 1 año | Snapshot exportado a S3 Glacier |
| Redis | No aplica | N/A | Datos efímeros, recreable |
| Logs CloudWatch | Continua | 90 días | CloudWatch Logs |
| Logs auditoría | Exportación diaria | 5 años | S3 + Glacier Deep Archive |

### Procedimiento de Recuperación (RTO < 4h)

1. **BD principal caída:** Failover automático a standby Multi-AZ (< 2 min).
2. **Región completa caída:** Restaurar snapshot en región secundaria, actualizar DNS.
3. **Corrupción de datos:** Restaurar a punto en el tiempo (PITR) desde RDS.