import type { MetalPrice, PriceHistoryPoint, PriceAlert } from '../types';

// ============================================================
// Gold-API.com — 完全免费，无需注册，无请求限制
// GET https://api.gold-api.com/price/{symbol}
// ============================================================
const API_BASE = 'https://api.gold-api.com';

const METAL_CONFIG = {
  XAU: { nameZh: '国际现货黄金' },
  XAG: { nameZh: '国际现货白银' },
} as const;

type MetalSymbol = keyof typeof METAL_CONFIG;
const SYMBOLS: MetalSymbol[] = ['XAU', 'XAG'];

interface GoldApiResponse {
  name: string;
  price: number;
  symbol: string;
  updatedAt: string;
  updatedAtReadable: string;
}

// ============================================================
// 价格追踪器：保留 5 分钟历史，支持 1 分钟涨跌幅检测
// ============================================================
const HISTORY_DURATION_MS = 5 * 60 * 1000; // 5 分钟
const ALERT_WINDOW_MS = 60 * 1000;         // 1 分钟窗口
const ALERT_THRESHOLD = 0.01;              // 1% 涨跌幅阈值

interface PriceTracker {
  firstPrice: number;
  high: number;
  low: number;
  history: PriceHistoryPoint[];
}

const trackers: Record<string, PriceTracker> = {};

function getTracker(symbol: string): PriceTracker {
  if (!trackers[symbol]) {
    trackers[symbol] = { firstPrice: 0, high: 0, low: Infinity, history: [] };
  }
  return trackers[symbol];
}

/** 从服务端历史数据初始化 tracker（仅首次） */
export function initTrackerFromServer(symbol: string, points: PriceHistoryPoint[]): void {
  if (points.length === 0) return;
  const tracker = getTracker(symbol);
  if (tracker.history.length > 0) return; // 已有数据，不覆盖

  tracker.history = [...points];
  tracker.firstPrice = points[0].price;
  tracker.high = Math.max(...points.map((p) => p.price));
  tracker.low = Math.min(...points.map((p) => p.price));
}

/** 清理超过 5 分钟的历史记录 */
function pruneHistory(tracker: PriceTracker): void {
  const cutoff = Date.now() - HISTORY_DURATION_MS;
  tracker.history = tracker.history.filter((p) => p.timestamp >= cutoff);
}

/** 记录价格并返回追踪器 */
function updateTracker(symbol: string, price: number): PriceTracker {
  const tracker = getTracker(symbol);

  if (tracker.firstPrice === 0) {
    tracker.firstPrice = price;
    tracker.high = price;
    tracker.low = price;
  }

  if (price > tracker.high) tracker.high = price;
  if (price < tracker.low) tracker.low = price;

  const now = Date.now();
  tracker.history.push({
    time: new Date(now).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    timestamp: now,
    price,
  });

  pruneHistory(tracker);
  return tracker;
}

/** 检测 1 分钟内是否有 ≥1% 的涨跌 */
export function checkPriceAlert(symbol: string): PriceAlert | null {
  const tracker = getTracker(symbol);
  if (tracker.history.length < 2) return null;

  const now = Date.now();
  const cutoff = now - ALERT_WINDOW_MS;

  // 找到 1 分钟前最早的那个点
  const oldPoint = tracker.history.find((p) => p.timestamp >= cutoff);
  if (!oldPoint) return null;

  const currentPrice = tracker.history[tracker.history.length - 1].price;
  const refPrice = oldPoint.price;
  if (refPrice === 0) return null;

  const changePercent = (currentPrice - refPrice) / refPrice;

  if (Math.abs(changePercent) >= ALERT_THRESHOLD) {
    return {
      symbol,
      nameZh: METAL_CONFIG[symbol as MetalSymbol]?.nameZh ?? symbol,
      type: changePercent > 0 ? 'up' : 'down',
      percent: +(changePercent * 100).toFixed(2),
      price: +currentPrice.toFixed(2),
      refPrice: +refPrice.toFixed(2),
    };
  }

  return null;
}

// ============================================================
// 获取实时价格
// ============================================================
export async function fetchMetalPrices(): Promise<MetalPrice[]> {
  const results = await Promise.all(
    SYMBOLS.map(async (symbol): Promise<MetalPrice> => {
      const res = await fetch(`${API_BASE}/price/${symbol}`);
      if (!res.ok) throw new Error(`Gold-API.com ${symbol}: HTTP ${res.status}`);

      const data: GoldApiResponse = await res.json();
      const price = data.price;
      const tracker = updateTracker(symbol, price);

      const change = +(price - tracker.firstPrice).toFixed(2);
      const changePercent = tracker.firstPrice
        ? +((change / tracker.firstPrice) * 100).toFixed(2)
        : 0;

      return {
        name: data.name,
        nameZh: METAL_CONFIG[symbol].nameZh,
        symbol: data.symbol,
        price: +price.toFixed(2),
        prevPrice: +tracker.firstPrice.toFixed(2),
        change,
        changePercent,
        high: +tracker.high.toFixed(2),
        low: +tracker.low.toFixed(2),
        currency: 'USD',
        unit: '盎司',
        updatedAt: new Date(data.updatedAt).toLocaleString('zh-CN'),
      };
    })
  );

  return results;
}

// ============================================================
// 获取 5 分钟内的价格历史
// ============================================================
export function getPriceHistory(symbol: string): PriceHistoryPoint[] {
  const tracker = getTracker(symbol);
  pruneHistory(tracker);
  return [...tracker.history];
}
