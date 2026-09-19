# Korean Vocab

Private flashcards for Korean vocabulary and grammar with spaced repetition.

This app is a Next.js server that talks to PostgreSQL through Prisma. It is designed to run locally and on Vercel. There is no authentication yet.

## Required environment variables

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | App connection string. In production, use a pooled URL (Neon/Supabase/Vercel Postgres pooler). |
| `DIRECT_URL` | Direct (non-pooled) connection string used by Prisma Migrate. |

Local example:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/korean_vocab?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@localhost:5432/korean_vocab?schema=public"
```

Production pooled example (shape only):

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST/korean_vocab?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/korean_vocab"
```

Do not commit `.env`.

## Local setup

1. Install [PostgreSQL](https://www.postgresql.org/download/) and create an empty database named `korean_vocab`.
2. Install dependencies and apply migrations:

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open http://localhost:3000

`npm run db:seed` loads sample vocabulary/grammar for development only. It will refuse to run when `NODE_ENV` or `VERCEL_ENV` is `production`.

## Test

```bash
npm test
```

## Production (Vercel)

Do not add secrets to the repo. In the Vercel project:

1. Set `DATABASE_URL` and `DIRECT_URL`.
2. Use build command `prisma generate && prisma migrate deploy && next build` (this repo’s `vercel.json` already sets that).
3. Deploy the Next.js app. Prisma Migrate runs during build; the app uses serverless route handlers and does not need a long-running Node process.

Seed is not part of production deploy.
