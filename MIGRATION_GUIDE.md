# PostgreSQL + Redis Hybrid Migration Guide

This guide explains the migration from Redis-only storage to PostgreSQL + Redis hybrid architecture.

## Overview

- **PostgreSQL**: Stores persistent data (Trades, Portfolios, Sentiment, Users, Sessions)
- **Redis**: Used only as a caching layer (live prices, error logs, API responses, temporary data)

## Prerequisites

1. Ensure `DATABASE_URL` is set in your `.env.local` file:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/trading_playground?schema=public"
   ```

2. For production (Vercel), add `DATABASE_URL` to your environment variables.

## Migration Steps

### 1. Generate Prisma Client

After schema changes, regenerate the Prisma client:

```bash
npm run db:generate
```

### 2. Apply Schema Changes

**For Development:**
```bash
npm run db:push
```

**For Production:**
```bash
npm run db:migrate
```

Or create a new migration:
```bash
npm run db:migrate:dev
```

### 3. Verify Migration

Check that all tables are created:
```bash
npm run db:studio
```

This opens Prisma Studio where you can view and manage your database.

## Schema Changes

### Trade Model
- Added `timestamp` field (trade execution timestamp)
- `createdAt` remains for record creation timestamp

### Portfolio Model
- Added `positions` JSON field to store positions array

### Sentiment Model
- Changed `coin` to `symbol` for consistency
- Added `timestamp` field (sentiment analysis timestamp)
- `createdAt` remains for record creation timestamp

## API Changes

### `/api/trades`
- Reads from PostgreSQL (with Redis cache)
- Writes to PostgreSQL
- Cache invalidated on write

### `/api/portfolio`
- Reads from PostgreSQL (with Redis cache)
- Writes to PostgreSQL with positions stored as JSON
- Cache invalidated on write

### `/api/sentiment`
- Analyzes sentiment and optionally saves to PostgreSQL
- Pass `symbol` and `source` in request body to save:
  ```json
  {
    "text": "Bitcoin is surging!",
    "symbol": "BTC",
    "source": "api"
  }
  ```

### `/api/market` and `/api/news`
- Continue to use Redis cache only (not persisted)

## Testing

1. **Test Trade Persistence:**
   ```bash
   # Insert a test trade
   curl -X POST http://localhost:3000/api/trades \
     -H "Content-Type: application/json" \
     -d '{
       "model": "test-model",
       "symbol": "BTC",
       "side": "buy",
       "qty": 0.1,
       "price": 50000,
       "pnl": 0
     }'
   
   # Restart server and verify trade persists
   # Check /live and /portfolio pages
   ```

2. **Test Portfolio Persistence:**
   ```bash
   # Update portfolio
   curl -X POST http://localhost:3000/api/portfolio \
     -H "Content-Type: application/json" \
     -d '{
       "model": "test-model",
       "balance": 10000,
       "positions": [{"symbol": "BTC", "qty": 0.1, "avg_price": 50000, "pnl": 0}]
     }'
   
   # Restart server and verify portfolio persists
   ```

3. **Test Sentiment Persistence:**
   ```bash
   # Analyze sentiment and save
   curl -X POST http://localhost:3000/api/sentiment \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Bitcoin is rising!",
       "symbol": "BTC",
       "source": "test"
     }'
   ```

## Troubleshooting

### Prisma Client Out of Sync

If you see TypeScript errors about missing fields:
```bash
npm run db:generate
```

### Migration Issues

If migrations fail:
```bash
# Reset database (WARNING: deletes all data)
npm run db:migrate:reset

# Or push schema directly (development only)
npm run db:push
```

### Redis Connection Issues

Redis is optional for caching. The app will work without Redis, but caching will be disabled. Ensure:
- `UPSTASH_REDIS_REST_URL` is set
- `UPSTASH_REDIS_REST_TOKEN` is set

## Architecture

```
┌─────────────┐
│   Next.js   │
│   API Routes│
└──────┬──────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌──────────┐
│ PostgreSQL  │  │   Redis   │
│ (Persistent)│  │  (Cache)  │
└─────────────┘  └──────────┘
```

- **PostgreSQL**: Trades, Portfolios, Sentiment, Users, Sessions
- **Redis**: Market data, News cache, API response cache, Error logs

## Next Steps

1. Run migrations on production
2. Monitor database performance
3. Set up database backups
4. Consider connection pooling for production

