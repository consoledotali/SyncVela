<div align="center">

# ⚡ SyncVela

**Enterprise-Grade, Multi-Tenant Real-Time Collaboration & Team Messaging Platform**

_Engineered with Next.js 15, Node.js 22, Socket.IO, Redis Pub/Sub, PostgreSQL, Prisma ORM, and MinIO/S3._

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio)](https://socket.io/)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

<p align="center">
  <a href="#-system-architecture">System Architecture</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-repository-structure">Repository Structure</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-environment-variables">Environment Variables</a> •
  <a href="#-real-time-websocket-protocol">WebSocket Protocol</a> •
  <a href="#-security--governance">Security & RBAC</a> •
  <a href="#-production--deployment">Production & CI/CD</a>
</p>

</div>

---

## 📖 Executive Overview

**SyncVela** is an open-source, production-hardened team collaboration platform designed for low-latency real-time communication, enterprise multi-tenancy, and high concurrency. Built to provide a robust open-source alternative to Slack and Discord, SyncVela enforces strict tenant isolation, distributed real-time state synchronization, and scalable asynchronous file processing.

The platform is architected as a decoupled system featuring a **Next.js 15 App Router** frontend leveraging a clean, domain-modular production architecture (`components`, `hooks`, `store`, `types`, `utils`), communicating via authenticated REST APIs and duplex **Socket.IO** connections backed by a **Redis Pub/Sub** distributed adapter on a high-throughput **Node.js/Express** backend.

---

## 🏛 System Architecture

SyncVela separates the presentation, API gateway, distributed real-time event bus, relational persistence, and object storage into modular layers:

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js 15 App Router)"]
        UI["React 19 UI / Tailwind CSS"]
        State["Zustand Slices (Messages, UI, Workspace)"]
        Query["TanStack Query Cache"]
        SocketClient["Socket.IO Client Runtime"]
    end

    subgraph Gateway ["Application Gateway & API (Node.js 22 + Express)"]
        HTTP["Express REST Endpoints"]
        AuthMid["JWT & RBAC Middleware"]
        RateLimit["Distributed Redis Rate Limiter"]
        SocketServer["Socket.IO Server Engine"]
    end

    subgraph DistributedBus ["Distributed Real-Time Bus"]
        RedisPubSub["Redis 7 Pub/Sub & Socket Adapter"]
        PresenceStore["Redis Presence & Typing Key-Value Store"]
    end

    subgraph Persistence ["Persistence & Storage Layer"]
        Prisma["Prisma ORM 6"]
        Postgres[(PostgreSQL 16 Multi-Tenant Store)]
        S3Storage[(MinIO / AWS S3 Object Storage)]
    end

    UI --> State
    UI --> Query
    UI --> SocketClient

    Query -- "REST (JSON / Bearer JWT)" --> HTTP
    SocketClient -- "WSS (Socket.IO Handshake)" --> SocketServer

    HTTP --> AuthMid
    HTTP --> RateLimit
    AuthMid --> Prisma
    SocketServer --> RedisPubSub
    SocketServer --> PresenceStore
    SocketServer --> AuthMid

    Prisma --> Postgres
    HTTP -- "Generate Presigned URL" --> S3Storage
    UI -- "Direct PUT (Binary Upload)" --> S3Storage
```

### Architectural Principles

- **Zero-Trust Multi-Tenancy**: Every workspace is strictly isolated. All database queries, socket rooms, channel lookups, and direct messages enforce tenant boundaries (`workspaceId`) at both the API and database levels.
- **Horizontal Scalability via Redis Pub/Sub**: Socket.IO nodes are stateless. The `@socket.io/redis-adapter` relays real-time events across any number of clustered backend instances.
- **Direct-to-S3 Presigned Media Pipeline**: Files and avatars bypass backend application memory entirely. The server generates cryptographically signed, short-lived PUT URLs, allowing the browser to stream media directly to S3/MinIO with MIME validation.
- **Graceful Optimistic UI**: Frontend chat interactions (messages, reactions, status updates) apply optimistically to local Zustand state while syncing with TanStack Query and Socket.IO fallbacks.

---

## ✨ Key Features

### 🏢 Multi-Tenant Workspace Isolation

- Dynamic workspace creation with unique slugs, member roles, and avatar branding.
- Secure, shareable workspace invitation links with cryptographic verification.
- **Enterprise Governance**: Workspace ownership transfer, role modification (`OWNER`, `ADMIN`, `MEMBER`, `GUEST`), and member eviction protocols.

### 💬 Real-Time Channels & Direct Messaging

- **Public & Private Channels**: Fine-grained access control ensuring private channels are strictly restricted to invited members.
- **1:1 Direct Messages**: Workspace-scoped peer-to-peer messaging preventing cross-workspace contamination.
- **Message Threading**: Nested discussion threads with real-time reply counters and parent message context preservation.
- **Rich Emoji Reactions**: Instant multi-user emoji reactions with real-time add/remove attribution counters.
- **Real-Time Presence & Typing Indicators**: Ephemeral user typing states and presence heartbeats backed by Redis TTL-expiry.

### 📦 Media Upload & Object Storage

- Direct client-to-storage uploads using **AWS S3 / MinIO** presigned URLs.
- Dual-bucket segregation: Public bucket for user/workspace avatars; private bucket for secure channel attachments.
- Automatic image lightbox previews, download links, and inline document renderers.

### 🛡️ Enterprise Security & Resilience

- **Authentication**: Email/Password with Resend OTP email verification, Google OAuth 2.0 integration, and HttpOnly SameSite JWT refresh token rotation.
- **Rate Limiting**: Distributed Redis token-bucket rate limiting defending authentication endpoints and socket event emitters against abuse.
- **Data Integrity**: Prisma schema migrations guaranteeing foreign-key cascading and composite indexing for high-speed lookups.

---

## 📂 Repository Structure

The project follows a clean, decoupled monorepo architecture:

```
Syncvela/
├── .github/
│   └── workflows/
│       └── deploy.yml            # Automated CI/CD pipeline (Lint, Build, Trivy Security Scan, Docker)
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # Multi-tenant PostgreSQL relational data models
│   ├── src/
│   │   ├── config/               # Infrastructure, Redis, DB, CORS & rate limit configurations (corsConfig, dbConfig, rateLimitConfig, rbacConfig, redisConfig)
│   │   ├── controllers/          # HTTP request orchestrators (Auth, Channel, Error, Message, Upload, User, Workspace)
│   │   ├── middlewares/          # Route authentication & authorization guards (authMiddleware, rbacMiddleware)
│   │   ├── routes/               # Express modular route definitions & centralized API router
│   │   ├── services/             # Core business logic layer (Auth, Email, Storage)
│   │   ├── sockets/              # Real-time WebSocket server, presence, and domain handlers (handlers/, socketSecurity, socketServer)
│   │   ├── types/                # Domain-modular TypeScript contracts (authTypes, channelTypes, commonTypes, rbacTypes, socketTypes, storageTypes, workspaceTypes)
│   │   ├── validators/           # Centralized Zod request & real-time socket payload validation
│   │   ├── app.ts                # Express application factory & middleware pipeline
│   │   └── server.ts             # HTTP server bootstrap, Socket.IO binding & graceful shutdown
│   ├── Dockerfile                # Production multi-stage Docker build
│   ├── package.json              # Backend dependencies & scripts
│   └── tsconfig.json             # TypeScript compiler settings
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js 15 App Router pages & layouts
│   │   │   ├── auth/             # Login, Signup, Forgot Password, Verify OTP
│   │   │   ├── create-workspace/ # Workspace onboarding wizard
│   │   │   ├── invite/[code]/    # Workspace invite acceptance route
│   │   │   └── page.tsx          # Main authenticated chat application hub
│   │   ├── components/           # Domain-modular UI components
│   │   │   ├── auth/             # Authentication screen (AuthScreen)
│   │   │   ├── channels/         # Channel list, creation & invite modals
│   │   │   ├── chat/             # Message bubbles, composer, thread drawer, header & direct messages list
│   │   │   ├── profile/          # AvatarUploader & SetPasswordCard (profile modal)
│   │   │   ├── ui/               # Reusable Shadcn UI primitives & ThemeToggle
│   │   │   └── workspace/        # WorkspaceHub, Sidebar, CurrentUserFooter, dropdown & member management
│   │   ├── hooks/                # Custom React hooks (realtime, auth, upload, channels)
│   │   ├── providers/            # React Query, Theme, Toast & Socket context providers
│   │   ├── store/                # Zustand root store & domain state slices
│   │   ├── types/                # Domain-modular TypeScript contracts (authTypes, channelTypes, messageTypes, workspaceTypes, storeTypes)
│   │   └── utils/                # Pure stateless utilities (apiUtils, attachmentUtils, avatarUtils, inviteUtils, otpUtils, socketUtils, styleUtils)
│   ├── Dockerfile                # Pinned Alpine Next.js 15 standalone container
│   ├── package.json              # Frontend dependencies & scripts
│   └── tsconfig.json             # TypeScript compiler configuration
├── docker-compose.yml            # Local development infrastructure (PostgreSQL, Redis, MinIO)
├── .gitignore                    # Root git exclusion rules
└── README.md                     # Platform documentation
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: `v22.x` or later
- **npm**: `v10.x` or later
- **Docker & Docker Compose**: For running PostgreSQL, Redis, and MinIO locally

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/consoledotali/SyncVela.git
cd SyncVela
```

### Step 2: Spin Up Infrastructure Containers

Start local PostgreSQL (port 5432), Redis (port 6379), and MinIO (ports 9000/9001) with automatic bucket initialization:

```bash
docker compose up -d
```

> **MinIO Console**: Accessible at `http://localhost:9001` (Username: `syncvela_local_minio`, Password: `SyncVelaMinIO!2026Local`).

---

### Step 3: Configure Environment Variables

Copy the template files for both the backend and frontend:

```bash
# Backend environment configuration
cp backend/.env.example backend/.env

# Frontend environment configuration
cp frontend/.env.example frontend/.env.local
```

_(See [Environment Variables](#-environment-variables) below for field descriptions)._

---

### Step 4: Setup & Run Backend

In your first terminal:

```bash
cd backend

# Install dependencies
npm ci

# Run database migrations against PostgreSQL
npx prisma migrate deploy

# (Optional) Open Prisma Studio to inspect the database
# npx prisma studio

# Start backend in development mode
npm run dev
```

The backend server will start on `http://localhost:5000`.

---

### Step 5: Setup & Run Frontend

In your second terminal:

```bash
cd frontend

# Install dependencies
npm ci

# Start frontend in development mode
npm run dev
```

The Next.js application will open on `http://localhost:3000`.

---

## ⚙️ Environment Variables

### Backend Configuration (`backend/.env`)

| Variable                          | Description                                             | Default / Example                                                          | Required |
| --------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- | :------: |
| `PORT`                            | Port number for the Express server                      | `5000`                                                                     |    No    |
| `NODE_ENV`                        | Runtime environment mode                                | `development`                                                              |   Yes    |
| `CLIENT_URL`                      | Allowed origin for CORS & cookie credentials            | `http://localhost:3000`                                                    |   Yes    |
| `FRONTEND_URL`                    | Application URL used for generated email invite links   | `http://localhost:3000`                                                    |   Yes    |
| `CORS_ORIGINS`                    | Comma-delimited list of accepted origins                | `http://localhost:3000`                                                    |   Yes    |
| `DATABASE_URL`                    | PostgreSQL connection string                            | `postgresql://postgres:rootpassword@localhost:5432/syncvela?schema=public` |   Yes    |
| `DATABASE_POOL_MAX`               | Maximum connections in PostgreSQL pool                  | `20`                                                                       |    No    |
| `REDIS_URL`                       | Redis connection URL for Pub/Sub & rate limiting        | `redis://localhost:6379`                                                   |   Yes    |
| `JWT_SECRET`                      | Secret key for signing Access Tokens (min 32 chars)     | `your-jwt-access-secret-32-chars`                                          |   Yes    |
| `JWT_REFRESH_SECRET`              | Secret key for signing Refresh Tokens (min 32 chars)    | `your-jwt-refresh-secret-32-chars`                                         |   Yes    |
| `GOOGLE_CLIENT_ID`                | Google OAuth 2.0 Client ID for server validation        | `your-client-id.apps.googleusercontent.com`                                |    No    |
| `RESEND_API_KEY`                  | Resend API Key for sending transactional OTPs & invites | `re_xxxxxxxxxxxxxxxx`                                                      |    No    |
| `OBJECT_STORAGE_ENDPOINT`         | S3 API endpoint for direct file access                  | `http://localhost:9000`                                                    |   Yes    |
| `OBJECT_STORAGE_PUBLIC_ENDPOINT`  | S3 public URL exposed to client browsers                | `http://localhost:9000`                                                    |   Yes    |
| `OBJECT_STORAGE_REGION`           | S3 region identifier                                    | `us-east-1`                                                                |   Yes    |
| `OBJECT_STORAGE_ACCESS_KEY`       | S3 access key / MinIO root user                         | `syncvela_local_minio`                                                     |   Yes    |
| `OBJECT_STORAGE_SECRET_KEY`       | S3 secret key / MinIO root password                     | `SyncVelaMinIO!2026Local`                                                  |   Yes    |
| `OBJECT_STORAGE_BUCKET`           | Private bucket for channel attachments                  | `syncvela-attachments`                                                     |   Yes    |
| `OBJECT_STORAGE_PUBLIC_BUCKET`    | Public bucket for user/workspace avatars                | `syncvela-avatars`                                                         |   Yes    |
| `OBJECT_STORAGE_FORCE_PATH_STYLE` | Path-style routing for S3/MinIO (`true`/`false`)        | `true`                                                                     |   Yes    |

### Frontend Configuration (`frontend/.env.local`)

| Variable                       | Description                                      | Default / Example                           | Required |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------- | :------: |
| `NEXT_PUBLIC_API_URL`          | Public backend API & WebSocket base URL          | `http://localhost:5000`                     |   Yes    |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID for OAuth buttons | `your-client-id.apps.googleusercontent.com` |    No    |

---

## 📡 Real-Time WebSocket Protocol

SyncVela establishes an authenticated duplex WebSocket connection via Socket.IO:

| Socket Event       |    Direction    | Payload Parameters                                                      | Description                                                              |
| ------------------ | :-------------: | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `join_workspace`   | Client ➔ Server | `{ workspaceId: string }`                                               | Joins user to the workspace broadcast room after RBAC validation.        |
| `join_channel`     | Client ➔ Server | `{ channelId: string }`                                                 | Joins a public or private channel room if membership check passes.       |
| `send_message`     | Client ➔ Server | `{ channelId?, recipientId?, content, attachments?, parentMessageId? }` | Emits a channel message, direct message, or thread reply.                |
| `new_message`      | Server ➔ Client | `MessageObject`                                                         | Broadcasts new message to active room participants with sender metadata. |
| `add_reaction`     | Client ➔ Server | `{ messageId: string, emoji: string }`                                  | Records an emoji reaction and broadcasts update to conversation room.    |
| `reaction_updated` | Server ➔ Client | `{ messageId: string, reactions: Reaction[] }`                          | Notifies clients to optimistically sync reaction counters.               |
| `typing_start`     | Client ➔ Server | `{ conversationId: string, isChannel: boolean }`                        | Triggers typing indicator to other room members via Redis TTL store.     |
| `typing_stop`      | Client ➔ Server | `{ conversationId: string, isChannel: boolean }`                        | Clears active typing status for current user.                            |
| `user_presence`    | Server ➔ Client | `{ userId: string, status: "online" \| "offline" }`                     | Emitted when a user disconnects or heartbeat expires.                    |

---

## 🔒 Security & Governance

### Role-Based Access Control (RBAC) Matrix

Permissions are strictly evaluated on both the REST API layer and the WebSocket gateway:

| Capability                       | Workspace OWNER | Workspace ADMIN | Workspace MEMBER |       Workspace GUEST       |
| -------------------------------- | :-------------: | :-------------: | :--------------: | :-------------------------: |
| Transfer Workspace Ownership     |       ✅        |       ❌        |        ❌        |             ❌              |
| Delete Workspace                 |       ✅        |       ❌        |        ❌        |             ❌              |
| Evict Members / Manage Roles     |       ✅        |       ✅        |        ❌        |             ❌              |
| Create / Delete Public Channels  |       ✅        |       ✅        |        ❌        |             ❌              |
| Create / Manage Private Channels |       ✅        |       ✅        |        ✅        |             ❌              |
| Send Messages & File Attachments |       ✅        |       ✅        |        ✅        | ✅ (Assigned channels only) |
| Add / Remove Emoji Reactions     |       ✅        |       ✅        |        ✅        |             ✅              |

### Zero-Trust Hardening

1. **Payload Schema Validation**: All socket emissions and REST payloads are validated at runtime against strict schemas (rejecting prototype pollution and unexpected parameters).
2. **Distributed Rate Limiting**: Redis token buckets prevent brute-force login attempts and socket message floods.
3. **CORS & Cookie Policies**: Express uses strict origin checking with `credentials: true` and `SameSite: Lax` / `SameSite: None` flags matching production deployment topologies.

---

## 🚢 Production & CI/CD

The repository includes a hardened continuous delivery pipeline in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

```mermaid
flowchart LR
    A[git push to main] --> B[Quality & Security Gates]
    B -->|npm ci & npm run build| C[Audit Gate: High & Critical Failures]
    C --> D[Docker Buildx: Multi-Arch Build]
    D --> E[Trivy Vulnerability Scan]
    E -->|0 CVE Blockers| F[Publish Immutable Image Tags]
    F --> G[Automated Server Deployment via SSH]
```

### Verification Commands

To test service compilation, type safety, and security audits locally before submitting changes:

```bash
# Verify backend quality gates
cd backend
npm run build
npm audit --omit=dev --audit-level=high

# Verify frontend quality gates
cd ../frontend
npx tsc --noEmit
npm run build
npm audit --omit=dev --audit-level=high
```

---

## 🤝 Contributing

We welcome contributions to SyncVela! Please follow these standards:

1. Follow **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
2. Ensure all TypeScript builds pass (`npm run build`) without compilation or linter errors.
3. Submit feature branches targeting the `develop` branch via pull requests.

---

## 📄 License

SyncVela is distributed under the **MIT License**. See [LICENSE](LICENSE) for details.
