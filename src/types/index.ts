export interface MetalPrice {
  name: string;
  nameZh: string;
  symbol: string;
  price: number;
  prevPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  currency: string;
  unit: string;
  updatedAt: string;
}

export interface PriceHistoryPoint {
  time: string;
  timestamp: number;
  price: number;
}

export interface PriceAlert {
  symbol: string;
  nameZh: string;
  type: 'up' | 'down';
  percent: number;
  price: number;
  refPrice: number;
}

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y';
