import { z } from 'zod';
import { NextResponse } from 'next/server';

// Trade validation schema
export const TradeSchema = z.object({
  model: z.string().min(1, 'Model name is required'),
  symbol: z.string().min(1, 'Symbol is required').toUpperCase(),
  side: z.enum(['buy', 'sell'], {
    message: 'Side must be either "buy" or "sell"',
  }),
  qty: z.number().positive('Quantity must be positive'),
  price: z.number().positive('Price must be positive'),
  timestamp: z.string().optional(),
  pnl: z.number().optional(),
  status: z.enum(['open', 'closed']).optional(),
});

// Trade API schema (for POST requests)
export const TradeAPISchema = TradeSchema.extend({
  id: z.string().optional(),
});

// Portfolio update schema
export const PortfolioUpdateSchema = z.object({
  model: z.string().min(1, 'Model name is required'),
  balance: z.number().min(0, 'Balance cannot be negative').optional(),
  positions: z.array(z.object({
    symbol: z.string(),
    qty: z.number().min(0),
    avg_price: z.number().positive(),
    pnl: z.number().optional(),
  })).optional(),
  last_update: z.string().optional(),
});

// Portfolio validation schema (for GET requests)
export const PortfolioSchema = z.object({
  model: z.string().min(1, 'Model name is required'),
  balance: z.number().min(0, 'Balance cannot be negative').optional(),
  positions: z.array(z.object({
    symbol: z.string(),
    qty: z.number().min(0),
    avg_price: z.number().positive(),
    pnl: z.number().optional(),
  })).optional(),
  last_update: z.string().optional(),
});

// News validation schema
export const NewsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  url: z.string().url('Invalid URL'),
  source: z.string().min(1, 'Source is required'),
  published_at: z.string().or(z.number()),
  sentiment: z.object({
    label: z.enum(['positive', 'negative', 'neutral']),
    score: z.number().min(0).max(1),
  }).optional(),
});

// Sentiment validation schema
export const SentimentSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  model: z.string().optional(),
});

// History refresh validation schema
export const HistoryRefreshSchema = z.object({
  symbols: z.array(z.string()).min(1, 'At least one symbol is required'),
  days: z.number().int().min(1).max(365).optional(),
  force: z.boolean().optional(),
});

// History backfill validation schema
export const HistoryBackfillSchema = z.object({
  symbols: z.array(z.string()).optional(),
  days: z.number().int().min(1).max(365).optional(),
  force: z.boolean().optional(),
});

// History clear validation schema
export const HistoryClearSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
});

// History clear-all validation schema
export const HistoryClearAllSchema = z.object({
  confirm: z.literal('DELETE_ALL_HISTORY'),
});

// Helper function to validate and parse
export function validateAndParse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

// Helper function to safely validate (returns result or error)
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Helper to handle validation errors in API routes
export function handleValidationError(error: unknown): NextResponse | null {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation error',
        details: error.issues.map((e: z.ZodIssue) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }
  return null;
}
