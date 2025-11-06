import { NextResponse } from 'next/server';

interface HistoryPoint {
  time: string;
  value: number;
}

interface HistoryData {
  id: string;
  data: HistoryPoint[];
}

const VALID_IDS = ['bitcoin', 'ethereum', 'solana'];

function generateMockHistory(id: string): HistoryPoint[] {
  const basePrice = id === 'bitcoin' ? 50000 : id === 'ethereum' ? 3000 : 140;
  const now = Date.now();
  const points: HistoryPoint[] = [];
  
  // Generate 7 days of hourly data (168 points)
  for (let i = 168; i >= 0; i--) {
    const time = new Date(now - i * 60 * 60 * 1000);
    const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
    const trend = Math.sin((168 - i) / 20) * 0.02; // Slow trend
    const value = basePrice * (1 + variation + trend);
    
    points.push({
      time: time.toISOString(),
      value: Math.round(value * 100) / 100,
    });
  }
  
  return points;
}

async function fetchWithRetry(url: string, maxRetries = 1): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        next: { revalidate: 60 },
      });

      if (response.status === 429 && attempt < maxRetries) {
        // Rate limited - wait 1 second and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Max retries exceeded');
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id parameter. Use ?id=bitcoin|ethereum|solana' },
        { status: 400 }
      );
    }

    if (!VALID_IDS.includes(id.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid coin ID. Must be bitcoin, ethereum, or solana' },
        { status: 400 }
      );
    }

    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=7&interval=hourly`;

    try {
      const response = await fetchWithRetry(url);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`CoinGecko rate limit hit for ${id}, using fallback data`);
          return NextResponse.json({
            id,
            data: generateMockHistory(id),
            mock: true,
          });
        }
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform CoinGecko response (prices array with [timestamp, price])
      const historyData: HistoryPoint[] = (data.prices || []).map((point: [number, number]) => ({
        time: new Date(point[0]).toISOString(),
        value: point[1],
      }));

      if (historyData.length === 0) {
        throw new Error('No data returned from API');
      }

      return NextResponse.json({
        id,
        data: historyData,
        mock: false,
      });
    } catch (error) {
      console.error(`Error fetching history for ${id}:`, error);
      // Return fallback data
      return NextResponse.json({
        id,
        data: generateMockHistory(id),
        mock: true,
      });
    }
  } catch (error) {
    console.error('Error in history route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history data' },
      { status: 500 }
    );
  }
}

