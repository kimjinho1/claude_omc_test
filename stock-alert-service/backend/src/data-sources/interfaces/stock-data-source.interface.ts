export interface StockQuote {
  symbol: string;
  price: string; // Decimal string for precision
  change: string;
  changePercent: string;
  volume?: number;
  timestamp: Date;
}

export interface StockFundamentals {
  per?: string;
  pbr?: string;
  dividendYield?: string;
  week52High?: string;
  week52Low?: string;
}

export interface OHLCVBar {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}

export interface IStockDataSource {
  getQuote(symbol: string): Promise<StockQuote>;
  getHistory(symbol: string, period: '1d' | '1w' | '1m' | '3m' | '1y'): Promise<OHLCVBar[]>;
  getFundamentals(symbol: string): Promise<StockFundamentals>;
}
