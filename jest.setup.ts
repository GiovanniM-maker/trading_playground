import "@testing-library/jest-dom";

// Polyfills for Node.js globals (required for Prisma)
import { TextEncoder, TextDecoder } from "util";
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Set test timeout
jest.setTimeout(15000);

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret-key-for-jest";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
process.env.SENTRY_DSN = process.env.SENTRY_DSN || "https://test@test.ingest.sentry.io/test";

// Suppress console errors in tests (optional - comment out if you want to see them)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

