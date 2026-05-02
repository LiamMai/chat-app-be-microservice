# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (hot-reload)
pnpm start:dev          # all 4 services (also runs docker:init)
pnpm start:gateway      # API Gateway only (port 3000)
pnpm start:users        # Users microservice
pnpm start:auth         # Auth microservice
pnpm start:chat         # Chat microservice

# Build / Lint / Format
pnpm build
pnpm lint               # ESLint + auto-fix
pnpm format             # Prettier

# Tests
pnpm test               # unit tests (Jest)
pnpm test:watch
pnpm test:cov
pnpm test:e2e

# Infrastructure (Docker)
pnpm docker:build       # build custom Postgres + MongoDB images
pnpm docker:run         # start Redis, RabbitMQ, MongoDB, Postgres
pnpm docker:init        # build + run (first-time setup)

# PostgreSQL migrations (TypeORM — auto-run when users service starts)
pnpm migration:run      # manual run for CI/CD or production deploy
pnpm migration:revert   # roll back last applied migration
pnpm migration:show     # list applied vs pending migrations
pnpm migration:generate database/migrations/AddSomeThing  # generate from entity diff
pnpm migration:create   database/migrations/ManualChange  # empty migration shell

# MongoDB (one-time index setup)
pnpm migrate:chat

# Seeds
pnpm seed:super-admin   # create super admin from .env creds
pnpm seed:user          # 31 test users with friend graph
pnpm seed:chat          # chat rooms + messages
```

Swagger UI: `http://localhost:3000/api/docs`  
WebSocket playground: `http://localhost:3000/api/ws-playground`

## Architecture

**NestJS monorepo** (`nest-cli.json`) with 4 microservices + 1 shared library:

```
apps/
  api-gateway/   — HTTP + WebSocket entry point (port 3000)
    src/
      cloudinary/  — Cloudinary upload provider + service
      users/       — Users REST endpoints, avatar/cover upload
      auth/        — Auth forwarding, JWT/API-key guards
  auth/          — JWT & API key management
  users/         — Profiles, roles, friend system
  chat/          — Rooms, messages, real-time broadcast
libs/
  common/        — Shared decorators, guards, interceptors, RMQ setup
config/          — Typed env configuration (configuration.ts)
database/
  data-source.ts            — TypeORM DataSource for CLI (migration:generate etc.)
  migrations/
    index.ts                — Barrel: register every migration class here in order
    1700000000000-InitSchema.ts
    1746000000000-AddProfileFields.ts
    1746500000000-RenameNameToFirstLastName.ts
scripts/         — Seed scripts
docker/          — Custom Postgres/MongoDB images + shell scripts
```

Path alias: `@app/common` → `libs/common/src`

## Service Communication

**Gateway → Microservices: RPC over RabbitMQ**

- Three queues: `auth_queue`, `users_queue`, `chat_queue`
- Gateway uses `ClientProxy.send()` + `firstValueFrom()` (async RPC)
- Microservices consume via `@MessagePattern()` decorators
- Message patterns defined in `libs/common/src/message-patterns/`

**Real-time chat: Socket.IO + Redis Pub/Sub**

- Chat service publishes to Redis channel `chat:room:<roomId>`
- Gateway subscribes via `pmessage` on pattern `chat:room:*`, broadcasts to Socket.IO clients

## Data Storage Split

| Data | Store |
|------|-------|
| Users, friends, auth, API keys | PostgreSQL 15 + TypeORM |
| Chat rooms, messages | MongoDB 9 (replica set) + Mongoose |
| Session cache, presence | Redis 7 (ioredis) |
| File uploads (avatar, cover) | Cloudinary (external) |
| Service messages | RabbitMQ (AMQP) |

## Auth

- **JWT RS256** — 15 min access token, 7d refresh token
- **API keys** — alternative auth for non-browser clients
- Keys stored as `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64` (base64 PEM)
- Guards in `@app/common`: `JwtAuthGuard`, `ApiKeyGuard`, `RolesGuard`, `PermissionsGuard`
- Decorators: `@CurrentUser()`, `@Roles()`, `@Permissions()`

## RBAC

Three roles: `SUPER_ADMIN` > `ADMIN` > `USER`  
- `SUPER_ADMIN` — all permissions, excluded from friend system  
- `ADMIN` — read users, ban, moderate  
- `USER` — messaging, rooms, friends  
Constants in `libs/common/src/constants/`

## User Profile Fields

`auth_users` table columns (entity: `apps/users/src/entities/user.entity.ts`):

| Property | Column | Type | Notes |
|----------|--------|------|-------|
| `firstName` | `first_name` | varchar(50) | required |
| `lastName` | `last_name` | varchar(50) | optional, default `''` |
| `username` | `username` | varchar(50) unique | nullable, `@handle` |
| `bio` | `bio` | varchar(200) | nullable |
| `gender` | `gender` | enum(male,female,other) | nullable, `gender_enum` |
| `birthdate` | `birthdate` | date | nullable |
| `location` | `location` | varchar(100) | nullable |
| `website` | `website` | varchar(255) | nullable |
| `avatarUrl` | `avatar_url` | varchar(500) | nullable, Cloudinary URL |
| `coverUrl` | `cover_url` | varchar(500) | nullable, Cloudinary URL |

**TypeORM gotcha**: nullable string columns typed as `string | null` must have explicit `type: 'varchar'` in `@Column()`. Without it, TypeScript's reflect-metadata reflects the union as `Object`, crashing TypeORM at startup.

## TypeORM Migration Workflow

Migrations auto-run when the **users service** starts (`migrationsRun: true` in `apps/users/src/users.module.ts`). The users service owns all PostgreSQL schema changes. Auth service has `migrationsRun: false`.

**Adding a new migration:**

```bash
# 1. Change entity fields, then generate
pnpm migration:generate database/migrations/AddUserLastSeen

# 2. Review generated SQL in the new .ts file

# 3. Register it in the barrel (ORDER MATTERS)
# database/migrations/index.ts — append import + add class to array
```

Team members get the change automatically on next service restart after `git pull`.

**CLI data source:** `database/data-source.ts` — exports one default `DataSource`. Uses entity globs, imports migrations from the same barrel as the module.

**`tsconfig.json` has `ts-node.require: ["tsconfig-paths/register"]`** — this is required for `typeorm-ts-node-commonjs` (migration CLI) to resolve the `@app/common` path alias. Do not remove it.

## Cloudinary (Avatar / Cover Upload)

Module: `apps/api-gateway/src/cloudinary/`

- `CloudinaryProvider` — registers Cloudinary v2 SDK from env on module init
- `CloudinaryService.uploadImage(file, folder)` — streams `Express.Multer.File` buffer to Cloudinary, returns `UploadApiResponse`

Upload endpoints use `FileInterceptor` (multer memory storage) + `ParseFilePipe` for size validation. MIME type is validated manually against `/^image\/(jpeg|png|webp)$/` after multer processes the file.

Folders: `chat-app/avatars` (avatar), `chat-app/covers` (cover photo).

## At-Rest Encryption (Messages)

Chat messages are stored AES-256-GCM-encrypted at rest. Server holds the
key (encVersion 1) — this is **not E2EE**: it protects against DB dumps,
not against the server itself.

| Field | Meaning |
|-------|---------|
| `content` | Plaintext (legacy / encVersion 0). Null after migration. |
| `ciphertext` | base64 AES-GCM body + 16-byte tag. |
| `iv` | base64 12-byte IV. |
| `encVersion` | `0` plaintext, `1` server AES-GCM, `2` reserved for client E2EE. |

### Key

`MESSAGE_AT_REST_KEY_BASE64` — 32 raw bytes, base64-encoded.

```bash
# generate
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# add to encrypted .env
dotenvx set MESSAGE_AT_REST_KEY_BASE64 <value> -f .env
```

The chat service logs the key fingerprint (SHA-256 first 8 hex) on boot:

```
[MessageCrypto] at-rest encryption enabled — key fingerprint=4f3a92b1 strict=true
```

`pnpm migrate:encrypt-messages` and `pnpm migrate:diagnose-messages` print
the same fingerprint. **All three must match** — a different fingerprint
means a different key, and existing ciphertext won't decrypt.

### Workflow

```bash
# encrypt legacy plaintext rows (idempotent)
pnpm migrate:encrypt-messages

# verify decrypt works against current key
pnpm migrate:diagnose-messages
```

### Strict mode

`MESSAGE_DECRYPT_STRICT` (default `true`) — when true, decrypt failures
raise the real error so the API returns a 500 instead of silently nulling
`content`. Set `false` only in prod where you'd rather degrade than 500.

### Backup

Lose the key → legacy ciphertext is unrecoverable. Keep the value in a
secret manager (KMS / Vault / 1Password) and never commit it.

## API Response Envelope

All responses use `TransformInterceptor` (in `@app/common`):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "meta": { "total": 0, "page": 1, "limit": 20, "totalPages": 0, "hasPrevPage": false, "hasNextPage": false },
  "error": null,
  "timestamp": "..."
}
```

## Environment

Uses `@dotenvx/dotenvx` (encrypted `.env`). Required vars:

```
JWT_PRIVATE_KEY_BASE64
JWT_PUBLIC_KEY_BASE64
SUPER_ADMIN_EMAIL
SUPER_ADMIN_PASSWORD
SUPER_ADMIN_FIRST_NAME       # default: "Super"
SUPER_ADMIN_LAST_NAME        # default: "Admin"
POSTGRES_USERNAME / PASSWORD / PRIMARY_HOST / PRIMARY_HOST_PORT
MONGODB_USERNAME / PASSWORD / PRIMARY_HOST / PRIMARY_HOST_PORT
REDIS_PASSWORD / HOST / HOST_PORT / DB
RABBITMQ_USER / PASSWORD / HOST / HOST_PORT
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
```

All env vars parsed and typed in `config/configuration.ts`.

## Seed Test Data

- 31 users, password: `Seed@12345`
- Emails: `seed-user-{01..30}@chat.dev`, `seed-admin@chat.dev`
- User names: `firstName: "Seed"`, `lastName: "User 01"` … `"User 30"`
- Friend clusters: A (01-05), B (06-10), C (11-15); bridges at 01↔06, 06↔11
- Isolated users: 21-30 (no friends, useful for testing suggestions)

## Commit Messages

Use **Conventional Commits** format:

```
<type>(<scope>): <subject>

[optional body — only when "why" is non-obvious]
```

- **Subject**: ≤ 50 chars, imperative mood, no period
- **Scope**: app or lib name — `gateway`, `auth`, `users`, `chat`, `common`, `migrations`, `scripts`, `docker`
- **Types**: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`
- **Body**: wrap at 72 chars; explain motivation, not mechanics

Examples:
```
feat(users): add avatar upload endpoint
fix(migrations): add explicit varchar type on nullable columns
chore(docker): bump postgres image to 15.6
```

## Key Patterns

- **Pagination** — common helpers in `@app/common` for TypeORM, Mongoose, and Redis cursors
- **Exception handling** — `AllExceptionsFilter` (HTTP) and `RpcExceptionFilter` (RMQ) catch all errors
- **No docker-compose** — infrastructure runs via `docker/docker-run.sh` shell script
- **MongoDB runs as replica set** — required for transactions; initialized by `docker/mongodb/` scripts
- **`Gender` enum** lives in `@app/common` (alongside `Role`, `Permission`) so both services and gateway share it
