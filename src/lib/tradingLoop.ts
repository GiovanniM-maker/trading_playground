import { addTrade, updatePortfolio, getPortfolio, Trade } from '@/lib/db';
import { getMarket } from '@/lib/db';
import { randomUUID } from 'crypto';
import { logger } from './logger';

const MODELS = ['GPT 5', 'Claude Sonnet', 'Gemini 2.5', 'Grok 4', 'DeepSeek Chat', 'Qwen 3 Max'];
const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'XRP'];

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

export async function startTradingLoop(): Promise<void> {
  if (isRunning) {
    logger.info({ service: 'trading-loop' }, 'Trading loop is already running');
    return;
  }

  isRunning = true;
  logger.info({ service: 'trading-loop' }, 'Starting mock trading loop...');

  // Run immediately on start
  await executeTradingCycle();

  // Then run every 30 seconds
  intervalId = setInterval(async () => {
    await executeTradingCycle();
  }, 30000);
}

export function stopTradingLoop(): void {
  if (!isRunning) {
    logger.info({ service: 'trading-loop' }, 'Trading loop is not running');
    return;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  isRunning = false;
  logger.info({ service: 'trading-loop' }, 'Trading loop stopped');
}

export function getTradingLoopStatus(): { running: boolean } {
  return { running: isRunning };
}

async function executeTradingCycle(): Promise<void> {
  try {
    // Randomly select a subset of models to trade (not all at once)
    const modelsToTrade = MODELS.filter(() => Math.random() > 0.5);
    
    if (modelsToTrade.length === 0) {
      // Ensure at least one model trades
      modelsToTrade.push(MODELS[Math.floor(Math.random() * MODELS.length)]);
    }

    for (const model of modelsToTrade) {
      try {
        // Randomly select a symbol
        const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        
        // Get current market price
        const market = await getMarket(symbol);
        const basePrice = market?.price || (50000 + Math.random() * 50000);
        
        // Generate realistic price variation (±2%)
        const priceVariation = 1 + (Math.random() - 0.5) * 0.04;
        const price = Math.round(basePrice * priceVariation * 100) / 100;
        
        // Determine trade side
        const side = Math.random() > 0.5 ? 'buy' : 'sell' as 'buy' | 'sell';
        
        // Generate realistic quantity (small positions)
        const qty = Math.round(Math.random() * 0.1 * 1000) / 1000;
        
        // Calculate PnL based on price movement
        const priceChange = (Math.random() - 0.45) * 0.02; // Slight bullish bias
        const pnl = Math.round(price * qty * priceChange * 100) / 100;
        
        // Create trade
        const trade: Trade = {
          id: `trade_${Date.now()}_${randomUUID().substring(0, 8)}`,
          model,
          symbol,
          side,
          qty,
          price,
          timestamp: new Date().toISOString(),
          pnl,
          status: Math.random() > 0.8 ? 'open' : 'closed',
        };

        // Save trade
        await addTrade(trade);

        // Update portfolio
        const portfolio = await getPortfolio(model);
        const currentBalance = portfolio?.balance || 10000;
        const newBalance = Math.round((currentBalance + pnl) * 100) / 100;

        // Update or create positions
        const existingPositions = portfolio?.positions || [];
        const positionIndex = existingPositions.findIndex(p => p.symbol === symbol);
        
        let updatedPositions = [...existingPositions];
        
        if (positionIndex >= 0) {
          // Update existing position
          const existing = updatedPositions[positionIndex];
          const totalQty = side === 'buy' 
            ? existing.qty + qty 
            : Math.max(0, existing.qty - qty);
          
          if (totalQty > 0) {
            const newAvgPrice = side === 'buy'
              ? (existing.avg_price * existing.qty + price * qty) / (existing.qty + qty)
              : existing.avg_price;
            
            const newPnL = (price - newAvgPrice) * totalQty;
            
            updatedPositions[positionIndex] = {
              symbol,
              qty: totalQty,
              avg_price: Math.round(newAvgPrice * 100) / 100,
              pnl: Math.round(newPnL * 100) / 100,
            };
          } else {
            // Position closed
            updatedPositions.splice(positionIndex, 1);
          }
        } else if (side === 'buy') {
          // Create new position
          updatedPositions.push({
            symbol,
            qty,
            avg_price: price,
            pnl: 0,
          });
        }

        // Update portfolio
        await updatePortfolio(model, {
          balance: newBalance,
          positions: updatedPositions,
          last_update: new Date().toISOString(),
        });

        logger.info({ service: 'trading-loop', model, side, qty, symbol, price, pnl }, `Trade generated: ${model} ${side} ${qty} ${symbol} @ $${price} (PnL: $${pnl.toFixed(2)})`);
      } catch (error) {
        logger.error({ service: 'trading-loop', model, error: error instanceof Error ? error.message : 'Unknown error' }, `Error generating trade for ${model}`);
        const { sendAlert } = await import('./alert');
        await sendAlert('Trading Loop', `Error generating trade for ${model}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    logger.error({ service: 'trading-loop', error: error instanceof Error ? error.message : 'Unknown error' }, 'Trading loop error');
    const { sendAlert } = await import('./alert');
    await sendAlert('Trading Loop', `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Don't stop the loop on individual errors
  }
}

// Auto-start in development mode only
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  // Small delay to ensure Redis is ready
  setTimeout(() => {
    startTradingLoop().catch((error) => {
      logger.error({ service: 'trading-loop', error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start trading loop');
    });
  }, 2000);
}

