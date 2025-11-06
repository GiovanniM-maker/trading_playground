import { NextResponse } from 'next/server';

interface Position {
  coin: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  entry: number;
  current: number;
  unrealized_pnl: number;
  date: string;
}

interface Portfolio {
  model: string;
  total_equity: number;
  available_cash: number;
  unrealized_pnl: number;
  positions: Position[];
}

const MOCK_PORTFOLIOS: Portfolio[] = [
  {
    model: 'GPT 5',
    total_equity: 10876.45,
    available_cash: 2345.12,
    unrealized_pnl: 534.12,
    positions: [
      {
        coin: 'BTC',
        side: 'LONG',
        leverage: 10,
        entry: 50321,
        current: 51200,
        unrealized_pnl: 879.0,
        date: new Date().toISOString(),
      },
      {
        coin: 'ETH',
        side: 'SHORT',
        leverage: 5,
        entry: 3045,
        current: 3050,
        unrealized_pnl: -25.0,
        date: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  },
  {
    model: 'Claude Sonnet',
    total_equity: 9920.34,
    available_cash: 3100.00,
    unrealized_pnl: -210.50,
    positions: [
      {
        coin: 'SOL',
        side: 'LONG',
        leverage: 4,
        entry: 172.3,
        current: 165.9,
        unrealized_pnl: -60.0,
        date: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
  },
  {
    model: 'Gemini 2.5',
    total_equity: 11250.78,
    available_cash: 1500.00,
    unrealized_pnl: 750.78,
    positions: [
      {
        coin: 'BTC',
        side: 'LONG',
        leverage: 8,
        entry: 49800,
        current: 51200,
        unrealized_pnl: 1120.0,
        date: new Date(Date.now() - 10800000).toISOString(),
      },
      {
        coin: 'ETH',
        side: 'LONG',
        leverage: 6,
        entry: 3000,
        current: 3050,
        unrealized_pnl: 300.0,
        date: new Date(Date.now() - 14400000).toISOString(),
      },
      {
        coin: 'SOL',
        side: 'SHORT',
        leverage: 3,
        entry: 140,
        current: 138,
        unrealized_pnl: 42.9,
        date: new Date(Date.now() - 18000000).toISOString(),
      },
    ],
  },
  {
    model: 'Grok 4',
    total_equity: 9543.21,
    available_cash: 4200.00,
    unrealized_pnl: -456.79,
    positions: [
      {
        coin: 'ETH',
        side: 'SHORT',
        leverage: 7,
        entry: 3100,
        current: 3050,
        unrealized_pnl: 350.0,
        date: new Date(Date.now() - 21600000).toISOString(),
      },
      {
        coin: 'SOL',
        side: 'LONG',
        leverage: 5,
        entry: 150,
        current: 138,
        unrealized_pnl: -60.0,
        date: new Date(Date.now() - 25200000).toISOString(),
      },
    ],
  },
  {
    model: 'DeepSeek Chat',
    total_equity: 10234.56,
    available_cash: 2800.00,
    unrealized_pnl: 234.56,
    positions: [
      {
        coin: 'BTC',
        side: 'LONG',
        leverage: 12,
        entry: 49500,
        current: 51200,
        unrealized_pnl: 2040.0,
        date: new Date(Date.now() - 28800000).toISOString(),
      },
      {
        coin: 'SOL',
        side: 'SHORT',
        leverage: 4,
        entry: 145,
        current: 138,
        unrealized_pnl: 193.33,
        date: new Date(Date.now() - 32400000).toISOString(),
      },
    ],
  },
  {
    model: 'Qwen 3 Max',
    total_equity: 9876.54,
    available_cash: 3500.00,
    unrealized_pnl: -123.46,
    positions: [
      {
        coin: 'BTC',
        side: 'SHORT',
        leverage: 6,
        entry: 51000,
        current: 51200,
        unrealized_pnl: -200.0,
        date: new Date(Date.now() - 36000000).toISOString(),
      },
    ],
  },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (modelId) {
      // Return single model portfolio
      const model = MOCK_PORTFOLIOS.find(p => 
        p.model.toLowerCase().replace(/\s+/g, '-').includes(modelId.toLowerCase())
      );
      if (model) {
        return NextResponse.json(model);
      }
    }

    // Return all portfolios
    return NextResponse.json(MOCK_PORTFOLIOS);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return NextResponse.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
  }
}
