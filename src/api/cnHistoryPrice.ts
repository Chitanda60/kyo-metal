// ============================================================
// 贵金属历史价格（数据来源：AKShare 静态 JSON）
// 国内：上海黄金交易所 Au99.99 / Ag(T+D)
// 国际：COMEX GC00Y / SI00Y
// localStorage 缓存至当日 23:59:59
// ============================================================

export interface HistoryDayPrice {
  date: string;   // YYYY-MM-DD
  open: number;
  close: number;
  high: number;
  low: number;
}

interface HistoryJson {
  symbol: string;
  currency: string;
  unit: string;
  count: number;
  updatedAt: string;
  data: HistoryDayPrice[];
}

// 所有可用的历史数据文件
type HistoryKey = 'cn_gold' | 'cn_silver' | 'intl_gold' | 'intl_silver';

const FILE_MAP: Record<HistoryKey, string> = {
  cn_gold: 'cn_gold_history.json',
  cn_silver: 'cn_silver_history.json',
  intl_gold: 'intl_gold_history.json',
  intl_silver: 'intl_silver_history.json',
};

// ============================================================
// 缓存：有效期至当日 23:59:59
// ============================================================
interface CacheEntry {
  data: HistoryDayPrice[];
  expiresAt: number;
}

function getTodayExpiry(): number {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23, 59, 59, 999
  ).getTime();
}

function getFromCache(key: HistoryKey): HistoryDayPrice[] | null {
  try {
    const raw = localStorage.getItem(`history_${key}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`history_${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setToCache(key: HistoryKey, data: HistoryDayPrice[]): void {
  try {
    localStorage.setItem(`history_${key}`, JSON.stringify({
      data,
      expiresAt: getTodayExpiry(),
    }));
  } catch {
    // localStorage full
  }
}

// ============================================================
// 加载数据
// ============================================================
const BASE = import.meta.env.BASE_URL || '/';

async function loadHistory(key: HistoryKey): Promise<HistoryDayPrice[]> {
  const cached = getFromCache(key);
  if (cached) return cached;

  const url = `${BASE}data/${FILE_MAP[key]}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载 ${FILE_MAP[key]} 失败: HTTP ${res.status}`);

  const json: HistoryJson = await res.json();
  setToCache(key, json.data);
  return json.data;
}

/** 时间范围过滤 */
function filterByRange(data: HistoryDayPrice[], range: string): HistoryDayPrice[] {
  let daysBack: number;

  switch (range) {
    case '1W': daysBack = 7; break;
    case '1M': daysBack = 30; break;
    case '3M': daysBack = 90; break;
    case '1Y': daysBack = 365; break;
    case 'ALL': return data;
    default: daysBack = 30;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return data.filter((d) => d.date >= cutoffStr);
}

// ============================================================
// 公开接口
// ============================================================

/** 国内黄金历史 */
export async function fetchCnGoldHistory(range: string): Promise<HistoryDayPrice[]> {
  return filterByRange(await loadHistory('cn_gold'), range);
}

/** 国内白银历史 */
export async function fetchCnSilverHistory(range: string): Promise<HistoryDayPrice[]> {
  return filterByRange(await loadHistory('cn_silver'), range);
}

/** 国际黄金历史（COMEX） */
export async function fetchIntlGoldHistory(range: string): Promise<HistoryDayPrice[]> {
  return filterByRange(await loadHistory('intl_gold'), range);
}

/** 国际白银历史（COMEX） */
export async function fetchIntlSilverHistory(range: string): Promise<HistoryDayPrice[]> {
  return filterByRange(await loadHistory('intl_silver'), range);
}

// 向后兼容旧类型名
export type CnHistoryDayPrice = HistoryDayPrice;
