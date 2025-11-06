export interface CoinConfig {
  id: string;
  symbol: string;
  name: string;
  color: string;
}

export const COINS: CoinConfig[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#F7931A' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627EEA' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#9945FF' },
  { id: 'binancecoin', symbol: 'BNB', name: 'Binance Coin', color: '#F3BA2F' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: '#C2A633' },
  { id: 'ripple', symbol: 'XRP', name: 'Ripple', color: '#23292F' },
];

export const COIN_IDS = COINS.map(coin => coin.id).join(',');

export function getCoinById(id: string): CoinConfig | undefined {
  return COINS.find(coin => coin.id === id);
}

export function getCoinBySymbol(symbol: string): CoinConfig | undefined {
  return COINS.find(coin => coin.symbol.toUpperCase() === symbol.toUpperCase());
}

