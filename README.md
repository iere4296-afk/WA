# WA Intelligence Platform

WA Intelligence Platform is a multi-tenant WhatsApp operations SaaS built with Next.js, Express, Supabase, BullMQ, and Baileys. The platform uses real Supabase data only, org-scoped access control, cursor pagination, Supabase Realtime, and JWT auth stored in httpOnly cookies.

## Monorepo Structure

```text
wa-intelligence-platform/
|-- frontend/
|-- backend/
|-- supabase/
|   `-- migrations/
|-- docker-compose.yml
`-- README.md
```

## Prerequisites

- Node.js 22 or newer
- npm or pnpm
- Docker Desktop or another Docker runtime
- A Supabase account and project
- A TCP Redis instance for BullMQ
- Optional: Groq API key
- Optional: OpenAI API key
- Optional: Stripe account for billing flows

## Local Development Setup

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Start Redis

Redis is provided locally through [docker-compose.yml](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/docker-compose.yml).

```bash
docker compose up -d redis
docker compose ps
```

The local Redis service uses `redis:7-alpine` on port `6379` with append-only persistence enabled.

### 3. Configure environment files

Backend:

```bash
copy backend\.env.example backend\.env
```

Frontend:

```bash
copy frontend\.env.local.example frontend\.env.local
```

### 4. Fill backend environment variables

[backend/.env.example](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/backend/.env.example) contains the full required template.

Required to boot:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_ANON_KEY`
- `ENCRYPTION_KEY`
- `JWT_SECRET`
- `TZ=UTC`

Optional but supported:

- `GROQ_API_KEY`
- `GROQ_MODEL_FAST`
- `GROQ_MODEL_SMART`
- `OPENAI_API_KEY`
- `REDIS_URL`
- `WORKER_CONCURRENCY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL`
- `CORS_ORIGINS`


Important runtime rules:

- `JWT` auth is cookie-only. Do not use localStorage or sessionStorage for auth.
- `REDIS_URL` must point to a TCP Redis instance for `ioredis` and BullMQ.
- `TZ` must stay `UTC`.

### 5. Fill frontend environment variables

[frontend/.env.local.example](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/frontend/.env.local.example) contains the four required public values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_NAME`

## Supabase Setup Guide

### 1. Create the Supabase project

Create a project in Supabase, then collect:

- Project URL
- Anon key
- Service role key

### 2. Enable required extensions

Run the required extensions in the Supabase SQL editor if they are not already enabled:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
```

### 3. Run migrations in order

Run these SQL files in this exact order:

1. [supabase/migrations/001_schema.sql](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/supabase/migrations/001_schema.sql)
2. [supabase/migrations/002_rls_policies.sql](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/supabase/migrations/002_rls_policies.sql)
3. [supabase/migrations/003_functions.sql](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/supabase/migrations/003_functions.sql)
4. [supabase/migrations/004_pgvector.sql](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/supabase/migrations/004_pgvector.sql)
5. [supabase/migrations/005_template_metadata.sql](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/supabase/migrations/005_template_metadata.sql)

If you use the Supabase CLI, the equivalent command is:

```bash
supabase db push
```

### 4. Enable Realtime tables

Enable Realtime for the following tables in the Supabase dashboard:

- `whatsapp_devices`
- `campaigns`
- `conversations`
- `messages`
- `contacts`

### 5. Confirm org-scoped access

The backend and frontend both assume org-scoped data access. Keep RLS enabled and ensure the policies from migration `002_rls_policies.sql` are applied.

## Start the Platform

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Setup status: `http://localhost:3001/api/v1/setup/status`
- Health check: `http://localhost:3001/api/v1/health`

## Verification Checklist

After both services are running:

1. Visit `http://localhost:3000` and confirm you are redirected to `/login`.
2. Request `GET /api/v1/setup/status` and confirm service flags are returned.
3. Request `GET /api/v1/health` and confirm the backend is healthy.
4. Confirm Redis is reachable from the backend.
5. Confirm Supabase migrations are present and applied in order.

## Environment Variable Reference

### Backend

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key for privileged backend access |
| `SUPABASE_ANON_KEY` | Anon key used for some auth flows and setup checks |
| `ENCRYPTION_KEY` | AES session encryption key, 64 hex chars minimum |
| `ENCRYPTION_KEY_OLD` | Previous encryption key used for rotation |
| `JWT_SECRET` | JWT signing secret for httpOnly auth cookies |
| `GROQ_API_KEY` | Primary AI provider key |
| `GROQ_MODEL_FAST` | Fast Groq model name |
| `GROQ_MODEL_SMART` | Higher quality Groq model name |
| `OPENAI_API_KEY` | OpenAI fallback AI key |
| `REDIS_URL` | TCP Redis connection string for BullMQ |
| `WORKER_CONCURRENCY` | BullMQ worker concurrency |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PORT` | Backend port |
| `NODE_ENV` | Environment name |
| `TZ` | Must be `UTC` |
| `FRONTEND_URL` | Primary frontend URL |
| `CORS_ORIGINS` | Comma-separated allowed origins |

### Frontend

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser anon key |
| `NEXT_PUBLIC_API_URL` | Backend base URL |
| `NEXT_PUBLIC_APP_NAME` | App display name |

## Deployment Guide

### Frontend to Vercel

1. Import the repo into Vercel.
2. Set the frontend environment variables from [frontend/.env.local.example](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/frontend/.env.local.example).
3. Set `NEXT_PUBLIC_API_URL` to the deployed backend URL.
4. Deploy the `frontend` project.

### Backend to Railway

1. Create a Railway service for the `backend` directory.
2. Set the backend environment variables from [backend/.env.example](/F:/0.2%20AI%20Whatsapp/wa-intelligence-platform/backend/.env.example).
3. Attach or reference a TCP Redis instance.
4. Deploy the `backend` project.
5. Update `FRONTEND_URL` and `CORS_ORIGINS` with the Vercel URL.

### Supabase

1. Keep your production project URL and keys in platform env vars only.
2. Apply migrations before deploying application changes that depend on new schema.
3. Enable Realtime for the production tables listed above.

## Notes

- Auth is enforced on all app routes except `/login` and `/api/v1/setup/status`.
- Pagination is cursor-based; do not add offset pagination to list endpoints.
- BullMQ uses Redis through `ioredis`; do not replace it with Upstash HTTP mode.
- Realtime updates are expected for devices, campaigns, inbox, and conversations.
- Enable Realtime for the production tables listed above.
