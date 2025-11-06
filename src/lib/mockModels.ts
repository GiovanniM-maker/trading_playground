export interface Model {
  id: string;
  name: string;
  color: string;
  icon: string;
  initialBalance: number;
  currentBalance: number;
  equityHistory: Array<{ time: number; value: number }>;
  totalPnL: number;
  returnPercent: number;
  fees: number;
  winRate: number;
  biggestWin: number;
  biggestLoss: number;
  sharpe: number;
  totalTrades: number;
  openPositions: Position[];
}

export interface Position {
  id: string;
  side: 'long' | 'short';
  coin: string;
  leverage: number;
  notional: number;
  unrealizedPnL: number;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
}

export interface CompletedTrade {
  id: string;
  modelId: string;
  modelName: string;
  modelIcon: string;
  modelColor: string;
  side: 'long' | 'short';
  coin: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  holdingTime: string;
  pnl: number;
  timestamp: Date;
}

export interface EquityPoint {
  time: number;
  value: number;
}

const MODELS_CONFIG = [
  { name: 'GPT 5', color: '#00b686', icon: '🤖' },
  { name: 'Claude Sonnet', color: '#ff6b35', icon: '☀️' },
  { name: 'Gemini 2.5', color: '#3b82f6', icon: '✦' },
  { name: 'Grok 4', color: '#111111', icon: '🌀' },
  { name: 'DeepSeek Chat', color: '#6366f1', icon: '🐋' },
  { name: 'Qwen 3 Max', color: '#a855f7', icon: '⚙️' },
];

const ASSETS = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT'];

export function generateInitialModels(): Model[] {
  const initialBalance = 10000;
  const now = Date.now();
  
  return MODELS_CONFIG.map((config, index) => {
    // Generate initial equity history with some variation
    const equityHistory: EquityPoint[] = [];
    let currentValue = initialBalance;
    
    for (let i = 0; i < 50; i++) {
      const change = (Math.random() - 0.45) * 0.02; // Slight upward bias
      currentValue = currentValue * (1 + change);
      equityHistory.push({
        time: now - (50 - i) * 3000,
        value: currentValue,
      });
    }
    
    const currentBalance = equityHistory[equityHistory.length - 1].value;
    const totalPnL = currentBalance - initialBalance;
    const returnPercent = (totalPnL / initialBalance) * 100;
    
    return {
      id: `model-${index + 1}`,
      name: config.name,
      color: config.color,
      icon: config.icon,
      initialBalance,
      currentBalance,
      equityHistory,
      totalPnL,
      returnPercent,
      fees: Math.random() * 50 + 10,
      winRate: Math.random() * 30 + 50, // 50-80%
      biggestWin: Math.random() * 500 + 200,
      biggestLoss: -(Math.random() * 300 + 100),
      sharpe: Math.random() * 2 + 0.5,
      totalTrades: Math.floor(Math.random() * 100) + 20,
      openPositions: generateRandomPositions(config.name, config.icon, config.color),
    };
  });
}

function generateRandomPositions(modelName: string, modelIcon: string, modelColor: string): Position[] {
  const numPositions = Math.floor(Math.random() * 3);
  const positions: Position[] = [];
  
  for (let i = 0; i < numPositions; i++) {
    const coin = ASSETS[Math.floor(Math.random() * ASSETS.length)];
    const basePrice = coin === 'BTC' ? 50000 : coin === 'ETH' ? 3000 : 100;
    const entryPrice = basePrice * (1 + (Math.random() - 0.5) * 0.1);
    const currentPrice = entryPrice * (1 + (Math.random() - 0.5) * 0.05);
    const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
    
    positions.push({
      id: `pos-${Date.now()}-${i}`,
      side: Math.random() > 0.5 ? 'long' : 'short',
      coin,
      leverage: Math.floor(Math.random() * 5) + 1,
      notional: Math.random() * 5000 + 1000,
      unrealizedPnL: pnlPercent * (Math.random() * 100 + 50),
      entryPrice,
      currentPrice,
      quantity: Math.random() * 10 + 0.1,
    });
  }
  
  return positions;
}

export function updateModelEquity(model: Model, pnl: number): Model {
  const newBalance = model.currentBalance + pnl;
  const now = Date.now();
  
  // Add new equity point
  const newEquityHistory = [
    ...model.equityHistory.slice(-99),
    { time: now, value: newBalance },
  ];
  
  const totalPnL = newBalance - model.initialBalance;
  const returnPercent = (totalPnL / model.initialBalance) * 100;
  
  // Update open positions with price changes
  const updatedPositions = model.openPositions.map(pos => {
    const priceChange = (Math.random() - 0.5) * 0.05;
    const newCurrentPrice = pos.currentPrice * (1 + priceChange);
    const pnlPercent = pos.side === 'long' 
      ? ((newCurrentPrice - pos.entryPrice) / pos.entryPrice) * 100
      : ((pos.entryPrice - newCurrentPrice) / pos.entryPrice) * 100;
    const newUnrealizedPnL = (pnlPercent / 100) * pos.notional;
    
    return {
      ...pos,
      currentPrice: newCurrentPrice,
      unrealizedPnL: newUnrealizedPnL,
    };
  });
  
  // Randomly close some positions (10% chance)
  const filteredPositions = updatedPositions.filter(() => Math.random() > 0.1);
  
  // Randomly add new positions (5% chance)
  let finalPositions = filteredPositions;
  if (Math.random() > 0.95) {
    const newPos = generateRandomPositions(model.name, model.icon, model.color)[0];
    if (newPos) {
      finalPositions = [...finalPositions, newPos];
    }
  }
  
  return {
    ...model,
    currentBalance: newBalance,
    equityHistory: newEquityHistory,
    totalPnL,
    returnPercent,
    totalTrades: model.totalTrades + 1,
    openPositions: finalPositions,
  };
}

export function generateCompletedTrade(model: Model): CompletedTrade {
  const coin = ASSETS[Math.floor(Math.random() * ASSETS.length)];
  const basePrice = coin === 'BTC' ? 50000 : coin === 'ETH' ? 3000 : 100;
  const entryPrice = basePrice * (1 + (Math.random() - 0.5) * 0.1);
  const exitPrice = entryPrice * (1 + (Math.random() - 0.5) * 0.15);
  const quantity = Math.random() * 1000 + 100;
  const pnl = (exitPrice - entryPrice) * quantity * (Math.random() > 0.5 ? 1 : -1);
  const holdingHours = Math.floor(Math.random() * 400) + 1;
  const holdingMinutes = Math.floor(Math.random() * 60);
  
  return {
    id: `trade-${Date.now()}-${Math.random()}`,
    modelId: model.id,
    modelName: model.name,
    modelIcon: model.icon,
    modelColor: model.color,
    side: Math.random() > 0.5 ? 'long' : 'short',
    coin,
    entryPrice,
    exitPrice,
    quantity,
    holdingTime: `${holdingHours}H ${holdingMinutes}M`,
    pnl,
    timestamp: new Date(),
  };
}

