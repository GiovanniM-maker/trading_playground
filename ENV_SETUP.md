# Environment Variables Setup

Create a `.env.local` file in the root directory with the following content:

```
CRYPTOPANIC_API_KEY=0dd6eb49e5b72d5af431984ffed73d5a7f98d9ad
CRYPTOPANIC_PLAN=developer
```

## Steps:

1. Create `.env.local` in the project root (same level as `package.json`)
2. Add the variables above
3. Restart the development server (`npm run dev`)

The CryptoPanic API key is already provided. The app will work with mock data if the API key is missing or invalid.

