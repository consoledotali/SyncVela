# SyncVela

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black?style=for-the-badge&logo=socket.io)
![Prisma](https://img.shields.io/badge/Prisma-ORM-blue?style=for-the-badge&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-blue?style=for-the-badge&logo=docker)

SyncVela is a real-time team collaboration platform for multi-tenant workspaces.
It combines channel messaging, direct messaging, role-based authorization, and file attachments with a Next.js + Node.js architecture.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [Repository Structure](#repository-structure)
- [Technology Stack](#technology-stack)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Docker Development](#docker-development)
- [Production Build and Runtime](#production-build-and-runtime)
- [Database and Prisma Operations](#database-and-prisma-operations)
- [Security Notes](#security-notes)
- [Operational Checklist](#operational-checklist)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

SyncVela is designed around three production priorities:

- Real-time reliability: Socket.IO-powered collaboration and message fan-out.
- Tenant isolation: workspace-scoped data access and RBAC controls.
- Deployment readiness: Dockerized frontend/backend with PostgreSQL.

## Architecture

### High-level Flow

```mermaid
flowchart LR
    A[Next.js Frontend :3000] -->|REST + Cookies| B[Express API :5000]
    A -->|Socket.IO| C[Socket Server]
    B --> D[(PostgreSQL)]
    B --> E[S3/DO Spaces]
    C --> D
```

### Backend

- Runtime: Node.js + Express (TypeScript).
- API prefix: `/api/*`.
- Health endpoint: `/api/health`.
- Realtime: Socket.IO handlers under domain-focused modules.
- Persistence: Prisma ORM on PostgreSQL.

### Frontend

- Next.js App Router.
- React 19.
- Zustand for client state management.
- Socket client initialization in provider layer.

## Core Features

- Multi-tenant workspaces with invite-driven collaboration.
- Channel messaging and direct messaging.
- Role matrix with `OWNER`, `ADMIN`, `MEMBER`, `GUEST`.
- Threaded communication patterns.
- File upload flow via object storage (S3-compatible).
- Auth with JWT access/refresh patterns and OAuth support.

## Repository Structure

```text
chat-app-nextjs/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── sockets/
│   │   └── server.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── providers/
│   │   └── store/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Technology Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- Socket.IO client

### Backend

- Node.js 20+
- Express 5
- TypeScript
- Socket.IO
- Prisma
- PostgreSQL
- AWS SDK (S3 presigned URLs)

### Infrastructure

- Docker + Docker Compose
- PostgreSQL 15 (containerized in local/dev compose)

## Environment Variables

Keep secrets out of source control. Use environment-specific secret stores in production.

Bootstrap local env files from samples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.local.example frontend/.env.local
```

### Backend (`backend/.env`)

```env
# Core
PORT=5000
DATABASE_URL="postgresql://postgres:rootpassword@postgres:5432/syncvela?schema=public"
CLIENT_URL="http://localhost:3000"

# Auth
JWT_SECRET="replace_with_strong_secret"
JWT_REFRESH_SECRET="replace_with_strong_refresh_secret"

# OAuth
GOOGLE_CLIENT_ID="replace_with_google_client_id"

# Email
RESEND_API_KEY="replace_with_resend_api_key"

# S3 / DigitalOcean Spaces
DO_SPACES_ENDPOINT="region.digitaloceanspaces.com"
DO_SPACES_KEY="replace_with_access_key"
DO_SPACES_SECRET="replace_with_secret_key"
DO_SPACES_BUCKET="replace_with_bucket_name"
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:5000"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="replace_with_google_client_id"
```

## Local Development

### 1. Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (recommended for Postgres)

### 2. Install Dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Start Database

```bash
docker compose up -d postgres
```

### 4. Prisma Setup

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

If you are initializing from scratch in local-only workflows, use:

```bash
npx prisma db push
```

### 5. Run Applications

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

## Docker Development

Start full stack:

```bash
docker compose up --build
```

Stop stack:

```bash
docker compose down
```

Stop and remove volumes:

```bash
docker compose down -v
```

## Production Build and Runtime

### Backend

```bash
cd backend
npm run build
npm run start
```

### Frontend

```bash
cd frontend
npm run build
npm run start
```

### Docker Images

Both backend and frontend Dockerfiles are multi-stage and intended for production-ready image builds.

Recommended production practices:

- Use managed PostgreSQL instead of local container DB.
- Inject secrets via secret manager (not plain `.env` files).
- Put frontend/backend behind TLS termination and reverse proxy.
- Use structured logs and centralized log aggregation.
- Configure health checks and restart policies in your orchestrator.

## Database and Prisma Operations

Common commands (run in `backend`):

```bash
# Generate Prisma client
npx prisma generate

# Apply existing migrations (recommended for shared/prod environments)
npx prisma migrate deploy

# Create and apply a new migration in development
npx prisma migrate dev --name your_change_name

# View migration state
npx prisma migrate status
```

## Security Notes

- Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` regularly.
- Restrict CORS to trusted origins (`CLIENT_URL`).
- Use HTTPS in all non-local environments.
- Enable secure cookie settings in production (`Secure`, `SameSite`, `HttpOnly`).
- Enforce upload constraints (size/type validation) and malware scanning where needed.
- Add API rate limits and abuse protection at edge + app layers.

## Operational Checklist

Before promoting to production:

- Environment variables are configured via secret manager.
- Prisma migrations are applied with `migrate deploy`.
- `npm run build` passes for both frontend and backend.
- `/api/health` is integrated with monitoring/alerting.
- Logs and metrics are captured centrally.
- Backup and restore strategy exists for PostgreSQL.
- Incident rollback plan is documented.

## Troubleshooting

### Frontend cannot connect to backend

- Verify `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.
- Verify backend is reachable on port `5000`.
- Check CORS origin config (`CLIENT_URL`) on backend.

### Socket authentication errors

- Validate access token lifecycle and refresh route behavior.
- Ensure auth cookies/headers are preserved across domains.

### Prisma connection issues

- Validate `DATABASE_URL` format and credentials.
- Ensure PostgreSQL container/service is healthy.
- Run `npx prisma migrate status` for migration state.

## License

This project is licensed under the MIT License.
