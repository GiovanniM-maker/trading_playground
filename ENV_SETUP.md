# Environment Variables Setup

Create a `.env.local` file in the root directory with the following content:

```
CRYPTOPANIC_API_KEY=0dd6eb49e5b72d5af431984ffed73d5a7f98d9ad
CRYPTOPANIC_PLAN=developer
SENTRY_DSN="https://examplePublicKey@o0.ingest.sentry.io/0"
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/trading_playground?schema=public"

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32
```

## Steps:

1. Create `.env.local` in the project root (same level as `package.json`)
2. Add the variables above
3. Set up your PostgreSQL database and update `DATABASE_URL`
4. Generate a secure `NEXTAUTH_SECRET` using: `openssl rand -base64 32`
5. Run database migrations: `npx prisma migrate dev`
6. Generate Prisma client: `npx prisma generate`
7. Restart the development server (`npm run dev`)

The CryptoPanic API key is already provided. The app will work with mock data if the API key is missing or invalid.

## Authentication Setup

After setting up the database, you'll need to create an admin user. You can do this using Prisma Studio:

1. Run `npx prisma studio`
2. Navigate to the User model
3. Create a new user with:
   - Email: your admin email
   - Password: (hashed with bcrypt - see note below)
   - Role: "admin"

**Note:** Passwords must be hashed with bcrypt. You can create a simple script to hash passwords, or use an online bcrypt generator. The password should be hashed with at least 10 rounds.

