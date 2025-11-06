import { NextResponse } from 'next/server';
import { getPortfolio, updatePortfolio, Portfolio } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model');

    if (!model) {
      return NextResponse.json(
        { error: 'Model parameter is required' },
        { status: 400 }
      );
    }

    const portfolio = await getPortfolio(model);

    if (!portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model, ...portfolioData } = body;

    if (!model) {
      return NextResponse.json(
        { error: 'Model parameter is required' },
        { status: 400 }
      );
    }

    await updatePortfolio(model, portfolioData as Partial<Portfolio>);

    const updated = await getPortfolio(model);

    return NextResponse.json({
      success: true,
      portfolio: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating portfolio:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
