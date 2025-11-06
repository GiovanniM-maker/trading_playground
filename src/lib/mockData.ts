export interface Trader {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  strategy: string;
  leverage: number;
}

export interface PricePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Action {
  id: string;
  timestamp: Date;
  traderId: string;
  traderName: string;
  action: 'buy' | 'sell' | 'short';
  asset: string;
  amount: number;
  price: number;
  pnl?: number;
}

const STRATEGIES = [
  'Trend Follower',
  'News Driven',
  'Aggressive',
  'Mean Reversion',
  'Momentum',
  'Arbitrage',
];

const ASSETS = ['BTC', 'ETH', 'SOL'];

export function generateInitialTrader(id: number): Trader {
  const balance = 1000;
  return {
    id: `trader-${id}`,
    name: `AI Trader #${id}`,
    balance,
    initialBalance: balance,
    strategy: STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)],
    leverage: Math.floor(Math.random() * 10) + 1,
  };
}

export function generateInitialPrice(): PricePoint {
  const basePrice = 50000;
  const variation = (Math.random() - 0.5) * 2000;
  const price = basePrice + variation;
  
  return {
    time: Date.now(),
    open: price,
    high: price * (1 + Math.random() * 0.02),
    low: price * (1 - Math.random() * 0.02),
    close: price + (Math.random() - 0.5) * 500,
  };
}

export function generateNextPrice(previous: PricePoint, timeStep: number): PricePoint {
  const trend = Math.sin(timeStep / 100) * 0.01;
  const noise = (Math.random() - 0.5) * 0.02;
  const change = trend + noise;
  
  const newClose = previous.close * (1 + change);
  const volatility = Math.abs(change) * 0.5;
  
  return {
    time: previous.time + 3000,
    open: previous.close,
    high: newClose * (1 + volatility + Math.random() * 0.01),
    low: newClose * (1 - volatility - Math.random() * 0.01),
    close: newClose,
  };
}

export function generateRandomAction(traders: Trader[], currentPrice: number): Action {
  const trader = traders[Math.floor(Math.random() * traders.length)];
  const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)];
  const actions: ('buy' | 'sell' | 'short')[] = ['buy', 'sell', 'short'];
  const action = actions[Math.floor(Math.random() * actions.length)];
  const amount = Math.random() * 0.1 + 0.01;
  const priceVariation = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
  const pnl = (Math.random() - 0.5) * 20;
  
  return {
    id: `action-${Date.now()}-${Math.random()}`,
    timestamp: new Date(),
    traderId: trader.id,
    traderName: trader.name,
    action,
    asset,
    amount,
    price: priceVariation,
    pnl: Math.round(pnl * 100) / 100,
  };
}

export function updateTraderBalance(trader: Trader, pnl: number): Trader {
  const newBalance = trader.balance + pnl;
  return {
    ...trader,
    balance: Math.max(0, newBalance),
  };
}

