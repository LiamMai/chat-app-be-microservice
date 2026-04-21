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
| `api-gateway` | HTTP + WebSocket entry point, JWT/API-key guards, Swagger |
| `auth` | Register, login, JWT issue/refresh/revoke, API keys |
| `users` | User profiles, roles, ban, friend system |
| `chat` | Rooms, messages, real-time via Redis Pub/Sub |

### Shared library — `@app/common`

`libs/common` exports:

- **Auth** — `JwtPayload`, `RequestUser`, `Role`, `Permission`, `ROLE_PERMISSIONS`, `@CurrentUser`, `@Roles`, `@Permissions`
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

Defaults work for local Docker. Fill in the four required values:

| Variable | How |
|---|---|
| `JWT_PRIVATE_KEY_BASE64` | Step 3 below |
| `JWT_PUBLIC_KEY_BASE64` | Step 3 below |
| `SUPER_ADMIN_EMAIL` | Any email |
| `SUPER_ADMIN_PASSWORD` | Min 8 chars |

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

### 5. Run migrations

```bash
# Create friends table + enum type + indexes
pnpm migrate:friends

# Create MongoDB indexes for chat collections
pnpm migrate:chat
```

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
pnpm start:users     # users service
```

## API Documentation

| Tool | URL | Purpose |
|---|---|---|
| Swagger UI | `http://localhost:3000/api/docs` | REST API docs + testing |
| WS Playground | `http://localhost:3000/api/ws-playground` | Real-time WebSocket testing |

After login, Swagger auto-fills `Authorization` from the response `accessToken`. Paste the same token into the WS Playground to connect.

## Test Data

All seed accounts use password **`Seed@12345`**.

| Email | Role | Notes |
|---|---|---|
| _(SUPER_ADMIN_EMAIL from .env)_ | SUPER_ADMIN | Platform operator |
| `seed-admin@chat.dev` | ADMIN | Admin endpoint testing |
| `seed-user-01@chat.dev` | USER | Cluster A, bridge to cluster B |
| `seed-user-06@chat.dev` | USER | Cluster B, bridge to clusters A + C |
| `seed-user-11@chat.dev` | USER | Cluster C |
| `seed-user-16..18@chat.dev` | USER | Pending requests → users 01-03 |
| `seed-user-19@chat.dev` | USER | Declined request → user-04 |
| `seed-user-20@chat.dev` | USER | Blocked by user-01 |
| `seed-user-21..30@chat.dev` | USER | Isolated — fallback suggestion pool |

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
│   │       ├── users/          # User management forwarding
│   │       └── friends/        # Friend system forwarding
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
│           ├── auth/           # RBAC, decorators, JWT payload types
│           ├── pagination/     # PageDto, paginate(), paginateCachedList()
│           ├── redis/          # CacheService, CacheKey
│           ├── swagger/        # Reusable response schema builders
│           ├── exceptions/     # AppException
│           ├── filters/        # Global exception filters
│           ├── interceptors/   # TransformInterceptor, LoggingInterceptor
│           └── response/       # ApiResponse envelope DTO
├── config/
│   └── configuration.ts        # Typed env config
├── scripts/
│   ├── seed-super-admin.ts     # Idempotent super admin seeder
│   ├── seed-users.ts           # 31 test users + friend graph
│   └── migrate-friends-table.ts
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
| `user` | Messaging, rooms, friend system |

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
