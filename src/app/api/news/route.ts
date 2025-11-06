import { fetchCryptoNews } from '@/lib/news/aggregator';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get('refresh') === 'true';
  
  try {
    const data = await fetchCryptoNews(force);
    return Response.json({ 
      count: data.length, 
      articles: data, 
      cached: !force,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return Response.json(
      { 
        error: 'Failed to fetch news',
        message: error instanceof Error ? error.message : 'Unknown error',
        count: 0,
        articles: [],
      },
      { status: 500 }
    );
  }
}

