import type { MetalPrice, PriceHistoryPoint, PriceAlert } from '../types';

// ============================================================
// 融通金 — 国内贵金属实时回购/销售价格（完全免费，无需 Key）
// POST http://www.beijingrtj.com/admin/get_price5.php
// 返回: CSV 格式 — 黄金/白银/铂金/钯金 回购+销售价 CNY/克
//
// 字段: price,金回购,金销售,银回购,银销售,铂回购,铂销售,钯回购,钯销售,
//        0,0,基础金价,18K金,铂基础,钯基础,银基础,时间
// ============================================================

// 开发环境走 Vite proxy，生产环境走阿里云 Nginx 代理
const isDev = import.meta.env.DEV;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';
const API_URL = isDev
  ? '/api/rtj/admin/get_price5.php'
  : `${SERVER_URL}/api/rtj`;

// ============================================================
// 价格追踪器：保留 5 分钟历史，支持 1 分钟涨跌幅检测
// ============================================================
const HISTORY_DURATION_MS = 5 * 60 * 1000;
const ALERT_WINDOW_MS = 60 * 1000;
const ALERT_THRESHOLD = 0.01;

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
export function initCnTrackerFromServer(symbol: string, points: PriceHistoryPoint[]): void {
  if (points.length === 0) return;
  const tracker = getTracker(symbol);
  if (tracker.history.length > 0) return;

  tracker.history = [...points];
  tracker.firstPrice = points[0].price;
  tracker.high = Math.max(...points.map((p) => p.price));
  tracker.low = Math.min(...points.map((p) => p.price));
}

function pruneHistory(tracker: PriceTracker): void {
  const cutoff = Date.now() - HISTORY_DURATION_MS;
  tracker.history = tracker.history.filter((p) => p.timestamp >= cutoff);
}

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

function checkAlert(symbol: string, nameZh: string): PriceAlert | null {
  const tracker = getTracker(symbol);
  if (tracker.history.length < 2) return null;

  const cutoff = Date.now() - ALERT_WINDOW_MS;
  const oldPoint = tracker.history.find((p) => p.timestamp >= cutoff);
  if (!oldPoint) return null;

  const currentPrice = tracker.history[tracker.history.length - 1].price;
  const refPrice = oldPoint.price;
  if (refPrice === 0) return null;

  const changePercent = (currentPrice - refPrice) / refPrice;

  if (Math.abs(changePercent) >= ALERT_THRESHOLD) {
    return {
      symbol,
      nameZh,
      type: changePercent > 0 ? 'up' : 'down',
      percent: +(changePercent * 100).toFixed(2),
      price: +currentPrice.toFixed(2),
      refPrice: +refPrice.toFixed(2),
    };
  }

  return null;
}

export function checkCnGoldAlert(): PriceAlert | null {
  return checkAlert('CN_AU', '国内黄金');
}

export function checkCnSilverAlert(): PriceAlert | null {
  return checkAlert('CN_AG', '国内白银');
}

// ============================================================
// 解析融通金返回的 CSV 数据
// ============================================================
interface RtjData {
  goldBuy: number;    // 黄金回购价
  goldSell: number;   // 黄金销售价
  silverBuy: number;  // 白银回购价
  silverSell: number; // 白银销售价
  baseGold: number;   // 基础金价
  baseSilver: number; // 基础银价
  time: string;       // 更新时间 HH:mm:ss
}

function parseRtjResponse(text: string): RtjData {
  // 格式: price,金回购,金销售,银回购,银销售,铂回购,铂销售,钯回购,钯销售,0,0,基础金价,18K金,铂基础,钯基础,银基础,时间
  const parts = text.trim().split(',');
  if (parts.length < 17 || parts[0] !== 'price') {
    throw new Error('融通金: 返回格式异常');
  }

  return {
    goldBuy: parseFloat(parts[1]),
    goldSell: parseFloat(parts[2]),
    silverBuy: parseFloat(parts[3]),
    silverSell: parseFloat(parts[4]),
    baseGold: parseFloat(parts[11]),
    baseSilver: parseFloat(parts[15]),
    time: parts[16],
  };
}

// ============================================================
// 获取国内黄金 + 白银实时价格
// ============================================================
export async function fetchCnPrices(): Promise<MetalPrice[]> {

  const res = await fetch(API_URL, { method: 'POST' });
  if (!res.ok) throw new Error(`融通金: HTTP ${res.status}`);

  const text = await res.text();
  const d = parseRtjResponse(text);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const updatedAt = `${todayStr} ${d.time}`;

  // 用回购价作为行情价格（更贴近市场价）
  const cnGoldPrice = d.goldBuy;
  const cnSilverPrice = d.silverBuy;

  const results: MetalPrice[] = [];

  // 国内黄金
  const auTracker = updateTracker('CN_AU', cnGoldPrice);
  const auChange = +(cnGoldPrice - auTracker.firstPrice).toFixed(2);
  results.push({
    name: 'CN Gold Spot',
    nameZh: '国内黄金',
    symbol: 'CN_AU',
    price: +cnGoldPrice.toFixed(2),
    prevPrice: +auTracker.firstPrice.toFixed(2),
    change: auChange,
    changePercent: auTracker.firstPrice ? +((auChange / auTracker.firstPrice) * 100).toFixed(2) : 0,
    high: +auTracker.high.toFixed(2),
    low: +auTracker.low.toFixed(2),
    currency: 'CNY',
    unit: '克',
    updatedAt,
  });

  // 国内白银
  const agTracker = updateTracker('CN_AG', cnSilverPrice);
  const agChange = +(cnSilverPrice - agTracker.firstPrice).toFixed(3);
  results.push({
    name: 'CN Silver Spot',
    nameZh: '国内白银',
    symbol: 'CN_AG',
    price: +cnSilverPrice.toFixed(3),
    prevPrice: +agTracker.firstPrice.toFixed(3),
    change: +agChange.toFixed(3),
    changePercent: agTracker.firstPrice ? +((agChange / agTracker.firstPrice) * 100).toFixed(2) : 0,
    high: +agTracker.high.toFixed(3),
    low: +agTracker.low.toFixed(3),
    currency: 'CNY',
    unit: '克',
    updatedAt,
  });

  return results;
}

// ============================================================
// 获取 5 分钟内的价格历史
// ============================================================
export function getCnHistory(symbol: string): PriceHistoryPoint[] {
  const tracker = getTracker(symbol);
  pruneHistory(tracker);
  return [...tracker.history];
}
