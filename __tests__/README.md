# Test Suite

This directory contains end-to-end tests for the infrastructure components.

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Prerequisites

1. **Database**: Ensure PostgreSQL is running and `DATABASE_URL` is set in your `.env` file
   ```bash
   # Example DATABASE_URL
   DATABASE_URL="postgresql://user:password@localhost:5432/trading_playground"
   ```

2. **Environment Variables**: Make sure all required environment variables are set in `.env`:
   - `DATABASE_URL` - PostgreSQL connection string (required for database tests)
   - `NEXTAUTH_SECRET` - Secret for NextAuth
   - `NEXTAUTH_URL` - URL of your application
   - `SENTRY_DSN` - Sentry DSN (optional for tests)

3. **Database Setup**: Run Prisma migrations to set up the database schema:
   ```bash
   npx prisma migrate dev
   # or
   npx prisma db push
   ```

**Note**: If the database is not available, tests that require database access will be skipped with a warning. All other tests (Zod validation, Logger, Sentry config) will still run.

## Test Coverage

The test suite verifies:

1. **Database (Prisma)**
   - Database connection
   - Trade creation and retrieval
   - User model operations

2. **Authentication (NextAuth)**
   - Auth configuration
   - User model operations
   - Session management

3. **Zod Validation**
   - Invalid data rejection
   - Valid data acceptance
   - Field validation

4. **API Routes**
   - POST /api/trades - Trade creation with validation
   - GET /api/trades - Trade retrieval
   - Error handling

5. **Logging (Pino)**
   - Logger initialization
   - Logging functionality

6. **Monitoring (Sentry)**
   - Sentry configuration
   - DSN setup

## Notes

- Tests use a test database (configure via `DATABASE_URL`)
- Test data is cleaned up after each test
- Tests run in sequence (`--runInBand`) to avoid database conflicts

