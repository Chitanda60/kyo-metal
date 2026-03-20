import type { PriceHistoryPoint } from '../types';

// ============================================================
// 从服务器预加载 5 分钟价格历史
// 页面打开时调用一次，将服务端积累的数据注入本地 tracker
// ============================================================

const isDev = import.meta.env.DEV;
const SERVER_BASE = isDev ? '' : (import.meta.env.VITE_SERVER_URL || '');
const HISTORY_URL = `${SERVER_BASE}/api/history`;

interface ServerHistory {
  XAU: PriceHistoryPoint[];
  XAG: PriceHistoryPoint[];
  CN_AU: PriceHistoryPoint[];
  CN_AG: PriceHistoryPoint[];
}

let loaded = false;

/**
 * 从服务器拉取 5 分钟历史数据（只拉一次）
 * 返回各品种的历史数据，供 tracker 初始化
 */
export async function preloadHistory(): Promise<ServerHistory | null> {
  if (loaded) return null;
  loaded = true;

  try {
    const res = await fetch(HISTORY_URL);
    if (!res.ok) return null;

    const data: ServerHistory = await res.json();
    return data;
  } catch (e) {
    console.warn('预加载历史数据失败:', e);
    return null;
  }
}
