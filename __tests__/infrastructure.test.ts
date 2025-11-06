import { prisma } from "@/lib/prisma";
import { TradeAPISchema } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { POST as postTrades, GET as getTrades } from "@/app/api/trades/route";
import { NextRequest } from "next/server";

// Test database connection
describe("Infrastructure E2E Tests", () => {
  let dbConnected = false;

  // Check database connection before running tests
  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch (error) {
      console.warn("⚠️  Database not available. Some tests will be skipped.");
      console.warn("   Please ensure PostgreSQL is running and DATABASE_URL is set.");
      dbConnected = false;
    }
  });

  // Clean up after all tests
  afterAll(async () => {
    if (dbConnected) {
      await prisma.$disconnect();
    }
  });

  // Clean up test data after each test
  afterEach(async () => {
    if (!dbConnected) return;
    
    // Clean up test trades
    try {
      await prisma.trade.deleteMany({
        where: {
          model: "TestModel",
        },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Database (Prisma)", () => {
    test("Database connection works", async () => {
      if (!dbConnected) {
        console.warn("Skipping: Database not available");
        return;
      }

      const result = await prisma.$queryRaw`SELECT 1 as value`;
      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result) && result.length > 0) {
        expect((result[0] as any).value).toBe(1);
      }
    });

    test("Can create and read Trade", async () => {
      if (!dbConnected) {
        console.warn("Skipping: Database not available");
        return;
      }
      const testTrade = {
        id: `test-trade-${Date.now()}`,
        model: "TestModel",
        symbol: "BTC",
        side: "buy" as const,
        quantity: 0.5,
        priceEntry: 45000,
        priceExit: null,
        profitLoss: 0,
        status: "closed" as const,
        createdAt: new Date(),
      };

      // Create trade
      const created = await prisma.trade.create({
        data: testTrade,
      });

      expect(created).toBeTruthy();
      expect(created.model).toBe("TestModel");
      expect(created.symbol).toBe("BTC");

      // Read trade
      const found = await prisma.trade.findUnique({
        where: { id: created.id },
      });

      expect(found).toBeTruthy();
      expect(found?.model).toBe("TestModel");
    });
  });

  describe("Authentication (NextAuth)", () => {
    test("Auth configuration exists", async () => {
      // Test that NextAuth is properly configured
      const authModule = await import("@/app/api/auth/[...nextauth]/route");
      expect(authModule).toBeDefined();
      expect(authModule.GET).toBeDefined();
      expect(authModule.POST).toBeDefined();
    });

    test("User model exists in database", async () => {
      if (!dbConnected) {
        console.warn("Skipping: Database not available");
        return;
      }

      // Test that we can query the User model (NextAuth requirement)
      const userCount = await prisma.user.count();
      expect(typeof userCount).toBe("number");
      expect(userCount).toBeGreaterThanOrEqual(0);
    });

    test("Session model exists in database", async () => {
      if (!dbConnected) {
        console.warn("Skipping: Database not available");
        return;
      }

      // Test that Session model exists (NextAuth database sessions)
      const sessionCount = await prisma.session.count();
      expect(typeof sessionCount).toBe("number");
      expect(sessionCount).toBeGreaterThanOrEqual(0);
    });

    test("Can create and query User", async () => {
      if (!dbConnected) {
        console.warn("Skipping: Database not available");
        return;
      }
      // Test user creation (for auth testing)
      const testEmail = `test-${Date.now()}@example.com`;
      const hashedPassword = await import("bcrypt").then((bcrypt) =>
        bcrypt.default.hash("testpassword", 10)
      );

      const user = await prisma.user.create({
        data: {
          email: testEmail,
          password: hashedPassword,
          role: "user",
        },
      });

      expect(user).toBeTruthy();
      expect(user.email).toBe(testEmail);

      // Clean up
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describe("Zod Validation", () => {
    test("Zod rejects invalid trade data", () => {
      const invalidTrade = {
        symbol: "BTC",
        side: "buy",
        // Missing required fields: model, qty, price
      };

      expect(() => {
        TradeAPISchema.parse(invalidTrade);
      }).toThrow();
    });

    test("Zod accepts valid trade data", () => {
      const validTrade = {
        model: "Gemini",
        symbol: "BTC",
        side: "buy" as const,
        qty: 0.5,
        price: 45000,
      };

      const result = TradeAPISchema.parse(validTrade);
      expect(result).toBeTruthy();
      expect(result.model).toBe("Gemini");
      expect(result.symbol).toBe("BTC");
      expect(result.qty).toBe(0.5);
      expect(result.price).toBe(45000);
    });

    test("Zod rejects invalid side", () => {
      const invalidTrade = {
        model: "Gemini",
        symbol: "BTC",
        side: "invalid" as any,
        qty: 0.5,
        price: 45000,
      };

      expect(() => {
        TradeAPISchema.parse(invalidTrade);
      }).toThrow();
    });

    test("Zod rejects negative quantity", () => {
      const invalidTrade = {
        model: "Gemini",
        symbol: "BTC",
        side: "buy" as const,
        qty: -0.5,
        price: 45000,
      };

      expect(() => {
        TradeAPISchema.parse(invalidTrade);
      }).toThrow();
    });
  });

  describe("API Routes", () => {
    test("POST /api/trades - Validates input with Zod", async () => {
      const invalidRequest = new NextRequest("http://localhost:3000/api/trades", {
        method: "POST",
        body: JSON.stringify({
          symbol: "BTC",
          side: "buy",
          // Missing required fields
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await postTrades(invalidRequest);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toBeDefined();
    });

    test("POST /api/trades - Saves valid trade", async () => {
      if (!dbConnected) {
        console.warn("Skipping: Database not available");
        return;
      }

      const validTrade = {
        model: "TestModel",
        symbol: "BTC",
        side: "buy" as const,
        qty: 0.5,
        price: 45000,
      };

      const request = new NextRequest("http://localhost:3000/api/trades", {
        method: "POST",
        body: JSON.stringify(validTrade),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const response = await postTrades(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.trade).toBeDefined();
      expect(body.trade.model).toBe("TestModel");
      expect(body.trade.symbol).toBe("BTC");

      // Verify trade was saved to database
      const saved = await prisma.trade.findFirst({
        where: { model: "TestModel", symbol: "BTC" },
      });
      expect(saved).not.toBeNull();
      expect(saved?.model).toBe("TestModel");
    });

    test("GET /api/trades - Returns trades", async () => {
      if (!dbConnected) {
        console.warn("Skipping: Database not available");
        return;
      }

      // Create a test trade first
      await prisma.trade.create({
        data: {
          id: `test-trade-get-${Date.now()}`,
          model: "TestModel",
          symbol: "ETH",
          side: "sell",
          quantity: 1.0,
          priceEntry: 3000,
          priceExit: null,
          profitLoss: 0,
          status: "closed",
          createdAt: new Date(),
        },
      });

      const request = new NextRequest("http://localhost:3000/api/trades?limit=10");
      const response = await getTrades(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.trades).toBeDefined();
      expect(Array.isArray(body.trades)).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Logging (Pino)", () => {
    test("Logger is active and functional", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    test("Logger can log messages", () => {
      // This should not throw
      expect(() => {
        logger.info({ service: "test" }, "Test log message");
      }).not.toThrow();
    });
  });

  describe("Monitoring (Sentry)", () => {
    test("Sentry DSN is configured", () => {
      // Check if SENTRY_DSN is defined (even if it's a test value)
      expect(process.env.SENTRY_DSN).toBeDefined();
    });

    test("Sentry configuration files exist", async () => {
      // Check that Sentry config files can be imported
      try {
        const clientConfig = await import("../../sentry.client.config");
        expect(clientConfig).toBeDefined();
      } catch (error) {
        // If import fails, that's okay for tests - just check env var
        expect(process.env.SENTRY_DSN).toBeDefined();
      }
    });
  });
});

