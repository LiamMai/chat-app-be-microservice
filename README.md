# Chat App — Backend Microservices

NestJS monorepo with four microservices communicating over RabbitMQ, behind a single HTTP API Gateway.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| Package manager | pnpm |
| Transport | RabbitMQ (AMQP) — `@nestjs/microservices` |
| Auth | RS256 JWT — access (15 min) + refresh (7 d) rotation |
| Primary DB | PostgreSQL 15 + TypeORM 0.3 |
| Document DB | MongoDB (replica set) + Mongoose |
| Cache | Redis 7 (ioredis) |
| File storage | Cloudinary (avatar + cover photo) |
| Validation | class-validator + class-transformer |
| API Docs | Swagger / OpenAPI (`@nestjs/swagger`) |
| Containers | Docker (custom images + shell scripts) |
| Env management | `@dotenvx/dotenvx` |

## Architecture

```
HTTP Client
    │
    ├── REST/WebSocket ──▶ api-gateway :3000
    │                           │ RabbitMQ
    │               ┌───────────┼───────────┐
    │               ▼           ▼           ▼
    │          ┌────────┐ ┌────────┐ ┌────────┐
    │          │  auth  │ │ users  │ │  chat  │
    │          └────────┘ └────────┘ └────────┘
    │           Postgres   Postgres   MongoDB
    │                      + Redis    + Redis
    │
    └── Browser ──────▶ /api/ws-playground  (WebSocket test UI)
                        /api/docs           (Swagger)
```

### Apps

| App | Responsibility |
|---|---|
| `api-gateway` | HTTP + WebSocket entry point, JWT/API-key guards, Swagger, Cloudinary uploads |
| `auth` | Register, login, JWT issue/refresh/revoke, API keys |
| `users` | User profiles, roles, ban, friend system, PostgreSQL migrations |
| `chat` | Rooms, messages, real-time via Redis Pub/Sub |

### Shared library — `@app/common`

`libs/common` exports:

- **Auth** — `JwtPayload`, `RequestUser`, `Role`, `Permission`, `Gender`, `ROLE_PERMISSIONS`, `@CurrentUser`, `@Roles`, `@Permissions`
- **Pagination** — `PageQueryDto`, `PageDto<T>`, `paginate()` (TypeORM), `paginateMongo()` (Mongoose), `paginateCachedList()` (Redis)
- **Redis** — `CacheService`, `CacheKey`, `REDIS_SUB_CLIENT`
- **Swagger** — `apiOkSchema()`, `apiPaginatedSchema()`, `apiCreatedSchema()`
- **Exceptions** — `AppException` (wraps HTTP status codes)
- **Filters** — `RpcExceptionFilter`, `AllExceptionsFilter`
- **Interceptors** — `TransformInterceptor` (wraps all responses in `ApiResponse` envelope), `LoggingInterceptor`

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 → `npm i -g pnpm`
- Docker Desktop
- Cloudinary account (free tier) — for avatar/cover photo uploads

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd chat-app-be-microservice
pnpm install
```

### 2. Environment

```bash
cp .env.example .env
```

Fill in the required values:

| Variable | How |
|---|---|
| `JWT_PRIVATE_KEY_BASE64` | Step 3 below |
| `JWT_PUBLIC_KEY_BASE64` | Step 3 below |
| `SUPER_ADMIN_EMAIL` | Any email |
| `SUPER_ADMIN_PASSWORD` | Min 8 chars |
| `SUPER_ADMIN_FIRST_NAME` | Optional, default `Super` |
| `SUPER_ADMIN_LAST_NAME` | Optional, default `Admin` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard → Settings → API Keys |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard → Settings → API Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard → Settings → API Keys |

All other variables (Postgres, Mongo, Redis, RabbitMQ) have working defaults for the local Docker setup.

### 3. Generate RS256 JWT keys

```bash
openssl genrsa -out private.pem 4096
openssl rsa -in private.pem -pubout -out public.pem

# Copy base64 output into .env
base64 -i private.pem | tr -d '\n'   # → JWT_PRIVATE_KEY_BASE64
base64 -i public.pem  | tr -d '\n'   # → JWT_PUBLIC_KEY_BASE64

rm private.pem public.pem
```

### 4. Start infrastructure

```bash
# Build custom Postgres + MongoDB images (first time only)
pnpm docker:build

# Start Redis, RabbitMQ, MongoDB, Postgres
pnpm docker:run
```

Wait ~5 s, then initialise:

```bash
# MongoDB replica set + Postgres schema
pnpm docker:init
```

### 5. Run MongoDB index migration

```bash
pnpm migrate:chat
```

> **PostgreSQL migrations run automatically** when the users service starts — no manual step needed. The users service checks for pending TypeORM migrations on every startup and applies them in order.

### 6. Seed data

```bash
# Super admin (uses SUPER_ADMIN_* vars from .env)
pnpm seed:super-admin

# 31 test users + realistic friend graph
pnpm seed:user

# Chat rooms + sample messages between seed users
pnpm seed:chat
```

## Running

```bash
# All four services with hot-reload
pnpm start:dev

# Individual services
pnpm start:gateway   # api-gateway  :3000  (HTTP + WebSocket /chat)
pnpm start:auth      # auth service
pnpm start:chat      # chat service
pnpm start:users     # users service (runs pending DB migrations on start)
```

## API Documentation

| Tool | URL | Purpose |
|---|---|---|
| Swagger UI | `http://localhost:3000/api/docs` | REST API docs + testing |
| WS Playground | `http://localhost:3000/api/ws-playground` | Real-time WebSocket testing |

After login, Swagger auto-fills `Authorization` from the response `accessToken`. Paste the same token into the WS Playground to connect.

### Default login (Swagger UI)

`POST /auth/login` is pre-filled with the chat seed dev account:

```json
{ "email": "seed-user-01@chat.dev", "password": "Seed@12345" }
```

This user owns DMs, group rooms (`Cluster A Chat`, `Dev Team`) and friend graph data created by `pnpm seed:chat`. Click **Try it out → Execute** to log in; the bearer token is auto-attached to all subsequent requests.

## User Profile

Registration accepts `firstName` (required) and `lastName` (optional). Profile fields can be updated individually via `PATCH /users/me`.

| Field | Type | Notes |
|---|---|---|
| `firstName` | string | Required on register |
| `lastName` | string | Optional, default `""` |
| `username` | string | Unique `@handle`, lowercase + numbers + underscores |
| `bio` | string | Max 200 chars |
| `gender` | `male` \| `female` \| `other` | |
| `birthdate` | ISO date string `YYYY-MM-DD` | |
| `location` | string | Max 100 chars |
| `website` | URL string | Max 255 chars |
| `avatarUrl` | string | Set via `PATCH /users/me/avatar` |
| `coverUrl` | string | Set via `PATCH /users/me/cover` |

### Avatar & cover upload

```
PATCH /users/me/avatar    multipart/form-data, field: file, max 5 MB
PATCH /users/me/cover     multipart/form-data, field: file, max 10 MB
```

Accepted formats: JPEG, PNG, WebP. Files are uploaded to Cloudinary and the resulting URL is stored in the database.

### User search

```
GET /users/search?q=john&page=1&limit=20
Authorization: Bearer <accessToken>
```

Searches across `firstName`, `lastName`, `email`, and `username`. Only returns active users. Available to all authenticated users.

## At-Rest Encryption (Chat Messages)

Chat message bodies are stored AES-256-GCM-encrypted at rest. The chat service holds the key — this is not E2EE; it protects against DB dumps, not against the server.

```bash
# 1. Generate the key (32 raw bytes, base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. Add to .env (use dotenvx set if .env is encrypted)
echo "MESSAGE_AT_REST_KEY_BASE64=<paste>" >> .env

# 3. Encrypt any pre-existing legacy plaintext rows (idempotent)
pnpm migrate:encrypt-messages

# 4. Verify same key decrypts existing rows
pnpm migrate:diagnose-messages
```

The chat service prints the key fingerprint (SHA-256 first 8 hex) on boot — it must match the fingerprint printed by the migration / diagnose scripts. If they differ, ciphertext from a different key is not recoverable.

| `encVersion` | Meaning |
|---|---|
| `0` (or unset) | Legacy plaintext (`content`) |
| `1` | Server AES-GCM (`ciphertext` + `iv`) |
| `2` | Reserved for client E2EE |

Use `pnpm db:migrate` to run all migrations in order: Postgres TypeORM → Mongo indexes → encrypt legacy messages. **Back up the key**: lose it, lose every encrypted message permanently.

## PostgreSQL Migration Workflow

Migrations live in `database/migrations/` and are tracked in the `typeorm_migrations` table.

```bash
# Check status
pnpm migration:show

# Apply pending (done automatically on users service startup)
pnpm migration:run

# Roll back last migration
pnpm migration:revert

# Generate from entity diff after changing an entity
pnpm migration:generate database/migrations/AddSomeField

# Create an empty migration for manual SQL
pnpm migration:create database/migrations/ManualChange
```

**Adding a migration:** generate the file → review SQL → add the import to `database/migrations/index.ts`. Team members get it automatically on next `git pull` + service restart.

## Test Data

All seed accounts use password **`Seed@12345`**.

| Email | Role | firstName | lastName | Notes |
|---|---|---|---|---|
| _(SUPER_ADMIN_EMAIL from .env)_ | SUPER_ADMIN | Super | Admin | Platform operator |
| `seed-admin@chat.dev` | ADMIN | Seed | Admin | Admin endpoint testing |
| `seed-user-01@chat.dev` | USER | Seed | User 01 | **Swagger default** — Cluster A, bridge to cluster B, owns seed DMs + groups |
| `seed-user-06@chat.dev` | USER | Seed | User 06 | Cluster B, bridge to clusters A + C |
| `seed-user-11@chat.dev` | USER | Seed | User 11 | Cluster C |
| `seed-user-16..18@chat.dev` | USER | Seed | User 16-18 | Pending requests → users 01-03 |
| `seed-user-19@chat.dev` | USER | Seed | User 19 | Declined request → user-04 |
| `seed-user-20@chat.dev` | USER | Seed | User 20 | Blocked by user-01 |
| `seed-user-21..30@chat.dev` | USER | Seed | User 21-30 | Isolated — fallback suggestion pool |

Friend graph:
- **Cluster A** users 01-05: fully connected
- **Cluster B** users 06-10: fully connected
- **Cluster C** users 11-15: fully connected
- Bridges: `01↔06`, `06↔11`

### Test friend suggestions

```bash
# 1. Login
POST /auth/login
{ "email": "seed-user-01@chat.dev", "password": "Seed@12345" }

# 2. Suggestions (paginated)
GET /friends/suggestions?page=1&limit=20
Authorization: Bearer <accessToken>

# Expected:
#   Mutual-friends tier → cluster B + C users
#   Fallback tier       → users 21-30
#   Excluded            → cluster A (already friends), user-20 (blocked)
```

## Testing

```bash
# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:cov

# E2E
pnpm test:e2e
```

## Project Structure

```
chat-app-be-microservice/
├── apps/
│   ├── api-gateway/
│   │   └── src/
│   │       ├── auth/           # Auth forwarding, JWT/API-key guards
│   │       ├── cloudinary/     # Cloudinary provider + upload service
│   │       ├── users/          # User management, avatar/cover upload endpoints
│   │       └── chat/           # Chat forwarding, WebSocket gateway
│   ├── auth/
│   │   └── src/
│   │       ├── token/          # JWT issue, refresh, revoke
│   │       └── api-key/        # API key CRUD + validation
│   └── users/
│       └── src/
│           ├── entities/       # TypeORM entities (UserEntity, FriendEntity)
│           └── friends/        # Friend service + RMQ controller
├── libs/
│   └── common/                 # @app/common shared library
│       └── src/
│           ├── auth/           # RBAC, decorators, JWT payload types, Gender enum
│           ├── pagination/     # PageDto, paginate(), paginateCachedList()
│           ├── redis/          # CacheService, CacheKey
│           ├── swagger/        # Reusable response schema builders
│           ├── exceptions/     # AppException
│           ├── filters/        # Global exception filters
│           ├── interceptors/   # TransformInterceptor, LoggingInterceptor
│           └── response/       # ApiResponse envelope DTO
├── config/
│   └── configuration.ts        # Typed env config (incl. Cloudinary)
├── database/
│   ├── data-source.ts          # TypeORM DataSource for CLI tools
│   └── migrations/
│       ├── index.ts            # Migration barrel — register new migrations here
│       ├── 1700000000000-InitSchema.ts
│       ├── 1746000000000-AddProfileFields.ts
│       └── 1746500000000-RenameNameToFirstLastName.ts
├── scripts/
│   ├── seed-super-admin.ts     # Idempotent super admin seeder
│   ├── seed-users.ts           # 31 test users + friend graph
│   ├── seed-chat.ts            # Chat rooms + messages
│   └── migrate-chat-indexes.ts # MongoDB index setup (one-time)
└── docker/
    ├── docker-run.sh
    ├── docker-build.sh
    ├── postgres/               # Custom image + init SQL
    └── mongodb/                # Custom image + replica set init
```

## RBAC

| Role | Key permissions |
|---|---|
| `super_admin` | All — manages API keys, assigns roles |
| `admin` | Read users, ban users, moderate content |
| `user` | Messaging, rooms, friend system, profile management |

Super admins are platform operators and cannot participate in the friend system.

## API Response Format

All endpoints return the same envelope:

```jsonc
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { ... },       // null on errors
  "meta": {              // only on paginated responses
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasPrevPage": false,
    "hasNextPage": true
  },
  "error": null,
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Environment Variables

See [.env.example](.env.example) for all variables with their defaults.

Key additions beyond infrastructure defaults:

```bash
# JWT
JWT_PRIVATE_KEY_BASE64=...
JWT_PUBLIC_KEY_BASE64=...

# Super admin seed
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=...
SUPER_ADMIN_FIRST_NAME=Super   # optional
SUPER_ADMIN_LAST_NAME=Admin    # optional

# Cloudinary (required for avatar/cover upload)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# At-rest encryption for chat messages (32 raw bytes, base64)
MESSAGE_AT_REST_KEY_BASE64=...
# Optional — set to "false" in prod to silently null content on decrypt fail
MESSAGE_DECRYPT_STRICT=true
```
