import { NextResponse } from 'next/server';
import { getPortfolio, updatePortfolio, Portfolio } from '@/lib/db';
import { PortfolioUpdateSchema, handleValidationError } from '@/lib/validation';
import { appLogger } from '@/lib/logger';
import { monitorApiResponse } from '@/lib/monitor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model');

    if (!model) {
      const duration = Date.now() - startTime;
      monitorApiResponse('GET', '/api/portfolio', 400, duration);
      return NextResponse.json(
        { error: 'Model parameter is required' },
        { status: 400 }
      );
    }

    const portfolio = await getPortfolio(model);
    const duration = Date.now() - startTime;

    if (!portfolio) {
      monitorApiResponse('GET', '/api/portfolio', 404, duration);
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    const response = NextResponse.json(portfolio);
    monitorApiResponse('GET', '/api/portfolio', 200, duration);
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    appLogger.error('Error fetching portfolio', error, { service: 'api', route: 'portfolio' });
    monitorApiResponse('GET', '/api/portfolio', 500, duration, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const data = PortfolioUpdateSchema.parse(body);
    const { model, ...portfolioData } = data;

    await updatePortfolio(model, portfolioData as Partial<Portfolio>);

    const updated = await getPortfolio(model);
    const duration = Date.now() - startTime;

    const response = NextResponse.json({
      success: true,
      portfolio: updated,
      timestamp: new Date().toISOString(),
    });

    monitorApiResponse('POST', '/api/portfolio', 200, duration);
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    const validationError = handleValidationError(error);
    if (validationError) {
      monitorApiResponse('POST', '/api/portfolio', 400, duration);
      return validationError;
    }

    appLogger.error('Error updating portfolio', error, { service: 'api', route: 'portfolio' });
    monitorApiResponse('POST', '/api/portfolio', 500, duration, error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
