import { useEffect, useState, useCallback } from 'react';
import Header from './components/Header';
import PriceCard from './components/PriceCard';
import PriceChart from './components/PriceChart';
import Toast from './components/Toast';
import { fetchMetalPrices, checkPriceAlert, initTrackerFromServer } from './api/metalPrice';
import {
  fetchCnPrices,
  checkCnGoldAlert,
  checkCnSilverAlert,
  initCnTrackerFromServer,
} from './api/cnGoldPrice';
import { preloadHistory } from './api/historyPreload';
import { SHOP_MARKUP } from './config/shopMarkup';
import type { MetalPrice, PriceAlert } from './types';
import './App.css';

/** 根据国内价格 + 加价生成店铺价格 */
function buildShopMetals(cnMetals: MetalPrice[]): MetalPrice[] {
  const results: MetalPrice[] = [];

  const cnGold = cnMetals.find((m) => m.symbol === 'CN_AU');
  if (cnGold) {
    results.push({
      ...cnGold,
      name: 'Shop Gold',
      nameZh: '店铺黄金',
      symbol: 'SHOP_AU',
      price: +(cnGold.price + SHOP_MARKUP.gold).toFixed(2),
      prevPrice: +(cnGold.prevPrice + SHOP_MARKUP.gold).toFixed(2),
      high: +(cnGold.high + SHOP_MARKUP.gold).toFixed(2),
      low: +(cnGold.low + SHOP_MARKUP.gold).toFixed(2),
    });
  }

  const cnSilver = cnMetals.find((m) => m.symbol === 'CN_AG');
  if (cnSilver) {
    results.push({
      ...cnSilver,
      name: 'Shop Silver',
      nameZh: '店铺白银',
      symbol: 'SHOP_AG',
      price: +(cnSilver.price + SHOP_MARKUP.silver).toFixed(3),
      prevPrice: +(cnSilver.prevPrice + SHOP_MARKUP.silver).toFixed(3),
      high: +(cnSilver.high + SHOP_MARKUP.silver).toFixed(3),
      low: +(cnSilver.low + SHOP_MARKUP.silver).toFixed(3),
    });
  }

  return results;
}

const REFRESH_INTERVAL = 10_000; // 每 10 秒查询一次

export default function App() {
  const [intlMetals, setIntlMetals] = useState<MetalPrice[]>([]);
  const [cnMetals, setCnMetals] = useState<MetalPrice[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('XAU');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [alerts, setAlerts] = useState<(PriceAlert & { id: number })[]>([]);

  // 页面加载时，从服务器预加载 5 分钟历史
  useEffect(() => {
    preloadHistory().then((data) => {
      if (!data) return;
      if (data.XAU?.length) initTrackerFromServer('XAU', data.XAU);
      if (data.XAG?.length) initTrackerFromServer('XAG', data.XAG);
      if (data.CN_AU?.length) initCnTrackerFromServer('CN_AU', data.CN_AU);
      if (data.CN_AG?.length) initCnTrackerFromServer('CN_AG', data.CN_AG);
    });
  }, []);

  const loadPrices = useCallback(async () => {
    try {
      // 国际数据
      const intlData = await fetchMetalPrices();
      setIntlMetals(intlData);

      // 国内数据（融通金，直接返回金价银价）
      const cnData = await fetchCnPrices().catch((e) => {
        console.warn('融通金请求失败:', e);
        return [] as MetalPrice[];
      });
      setCnMetals(cnData);

      setLastUpdate(new Date());
      setError('');
      setLoading(false);

      // 检测涨跌幅异动
      const newAlerts: (PriceAlert & { id: number })[] = [];
      for (const metal of intlData) {
        const alert = checkPriceAlert(metal.symbol);
        if (alert) newAlerts.push({ ...alert, id: Date.now() + Math.random() });
      }
      const cnGoldAlert = checkCnGoldAlert();
      if (cnGoldAlert) newAlerts.push({ ...cnGoldAlert, id: Date.now() + Math.random() });
      const cnSilverAlert = checkCnSilverAlert();
      if (cnSilverAlert) newAlerts.push({ ...cnSilverAlert, id: Date.now() + Math.random() });

      if (newAlerts.length > 0) {
        setAlerts((prev) => [...prev, ...newAlerts]);
      }
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      setError('获取数据失败，将自动重试...');
    }
  }, []);

  useEffect(() => {
    loadPrices();
    const timer = setInterval(loadPrices, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [loadPrices]);

  const removeAlert = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const shopMetals = buildShopMetals(cnMetals);
  const allMetals: MetalPrice[] = [...intlMetals, ...cnMetals, ...shopMetals];
  const selectedMetal = allMetals.find((m) => m.symbol === selectedSymbol);

  return (
    <div className="app">
      <Header />

      {alerts.map((alert) => (
        <Toast key={alert.id} alert={alert} onClose={() => removeAlert(alert.id)} />
      ))}

      <main className="main">
        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner" />
            <p>正在获取实时行情...</p>
          </div>
        ) : (
          <>
            {/* 国际行情 */}
            <div className="section">
              <div className="status-bar">
                <div className="status-indicator">
                  <span className={`status-dot ${error ? 'status-dot--error' : ''}`} />
                  {error || '国际行情 · Gold-API.com'}
                </div>
                {lastUpdate && (
                  <span className="status-time">
                    {lastUpdate.toLocaleTimeString('zh-CN')} · 每{REFRESH_INTERVAL / 1000}秒刷新
                  </span>
                )}
              </div>

              <div className="price-grid price-grid--2col">
                {intlMetals.map((metal) => (
                  <PriceCard
                    key={metal.symbol}
                    metal={metal}
                    selected={metal.symbol === selectedSymbol}
                    onClick={() => setSelectedSymbol(metal.symbol)}
                  />
                ))}
              </div>
            </div>

            {/* 国内行情 */}
            {cnMetals.length > 0 && (
              <div className="section">
                <div className="status-bar">
                  <div className="status-indicator">
                    <span className="status-dot" />
                    国内行情 · 融通金
                  </div>
                </div>

                <div className="price-grid price-grid--2col">
                  {cnMetals.map((metal) => (
                    <PriceCard
                      key={metal.symbol}
                      metal={metal}
                      selected={metal.symbol === selectedSymbol}
                      onClick={() => setSelectedSymbol(metal.symbol)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 店铺行情 */}
            {cnMetals.length > 0 && (
              <div className="section">
                <div className="status-bar">
                  <div className="status-indicator">
                    <span className="status-dot" />
                    店铺行情 · 金价+{SHOP_MARKUP.gold} 银价+{SHOP_MARKUP.silver}
                  </div>
                </div>

                <div className="price-grid price-grid--2col">
                  {shopMetals.map((metal) => (
                    <PriceCard
                      key={metal.symbol}
                      metal={metal}
                      selected={metal.symbol === selectedSymbol}
                      onClick={() => setSelectedSymbol(metal.symbol)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 走势图 */}
            {selectedMetal && <PriceChart metal={selectedMetal} />}

            <div className="market-info">
              <div className="market-info__item">
                <span className="market-info__label">国际数据</span>
                <span className="market-info__value">
                  <a href="https://gold-api.com" target="_blank" rel="noreferrer">
                    Gold-API.com
                  </a>
                </span>
              </div>
              <div className="market-info__item">
                <span className="market-info__label">国内数据</span>
                <span className="market-info__value">
                  <a href="http://www.beijingrtj.com/phone.html" target="_blank" rel="noreferrer">
                    融通金
                  </a>
                </span>
              </div>
              <div className="market-info__item">
                <span className="market-info__label">刷新频率</span>
                <span className="market-info__value">{REFRESH_INTERVAL / 1000} 秒</span>
              </div>
              <div className="market-info__item">
                <span className="market-info__label">异动提醒</span>
                <span className="market-info__value">1分钟内涨跌 ≥ 1%</span>
              </div>
            </div>

            <footer className="footer">
              <p>数据仅供参考，不构成投资建议。实际交易价格以交易所为准。</p>
              <p className="footer-hint">
                历史数据保留 5 分钟 · 异动提示 2 秒消失
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
