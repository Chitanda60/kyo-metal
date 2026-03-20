import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MetalPrice } from '../types';
import { getPriceHistory } from '../api/metalPrice';
import { getCnHistory } from '../api/cnGoldPrice';
import {
  fetchCnGoldHistory,
  fetchCnSilverHistory,
  fetchIntlGoldHistory,
  fetchIntlSilverHistory,
  type HistoryDayPrice,
} from '../api/cnHistoryPrice';
import './PriceChart.css';

/** 大数据量抽样，保留首尾 + 均匀采样 */
function sampleData(data: HistoryDayPrice[], maxPoints: number): HistoryDayPrice[] {
  if (data.length <= maxPoints) return data;
  const step = (data.length - 1) / (maxPoints - 1);
  const result: HistoryDayPrice[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(data[Math.round(i * step)]);
  }
  return result;
}

interface PriceChartProps {
  metal: MetalPrice;
}

type TimeRange = '5M' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

const RANGES: { key: TimeRange; label: string }[] = [
  { key: '5M', label: '5分钟' },
  { key: '1W', label: '1周' },
  { key: '1M', label: '1月' },
  { key: '3M', label: '3月' },
  { key: '1Y', label: '1年' },
  { key: 'ALL', label: '全部' },
];

// symbol → 历史数据获取函数
const HISTORY_FETCHER: Record<string, (range: string) => Promise<HistoryDayPrice[]>> = {
  XAU: fetchIntlGoldHistory,
  XAG: fetchIntlSilverHistory,
  CN_AU: fetchCnGoldHistory,
  CN_AG: fetchCnSilverHistory,
};

interface ChartPoint {
  label: string;
  price: number;
}

export default function PriceChart({ metal }: PriceChartProps) {
  const hasHistory = metal.symbol in HISTORY_FETCHER;

  const [range, setRange] = useState<TimeRange>('5M');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isCNY = metal.currency === 'CNY';
  const currencySign = isCNY ? '¥' : '$';

  // 切换品种时回到 5 分钟
  useEffect(() => {
    setRange('5M');
    setChartData([]);
  }, [metal.symbol]);

  // 实时 5 分钟数据
  useEffect(() => {
    if (range === '5M') {
      const data = isCNY ? getCnHistory(metal.symbol) : getPriceHistory(metal.symbol);
      setChartData(data.map((d) => ({ label: d.time, price: d.price })));
    }
  }, [metal.symbol, metal.price, isCNY, range]);

  // 加载历史数据
  const loadHistory = useCallback(
    async (r: TimeRange) => {
      if (r === '5M') return;
      const fetcher = HISTORY_FETCHER[metal.symbol];
      if (!fetcher) return;

      setHistoryLoading(true);
      try {
        const data = await fetcher(r);
        const sampled = sampleData(data, 200);
        setChartData(sampled.map((d) => ({
          label: d.date, // YYYY-MM-DD
          price: d.close,
        })));
      } catch (e) {
        console.error('历史数据加载失败:', e);
        setChartData([]);
      } finally {
        setHistoryLoading(false);
      }
    },
    [metal.symbol]
  );

  const handleRangeChange = (r: TimeRange) => {
    setRange(r);
    if (r !== '5M') {
      loadHistory(r);
    }
  };

  const isRealtime = range === '5M';

  // 图表颜色
  const isUp = isRealtime
    ? metal.change >= 0
    : chartData.length > 1
      ? chartData[chartData.length - 1].price >= chartData[0].price
      : true;
  const strokeColor = isUp ? '#00c853' : '#ff1744';
  const gradientColor = isUp ? '0, 200, 83' : '255, 23, 68';

  const prices = chartData.map((d) => d.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const padding = (maxPrice - minPrice) * 0.1 || 1;

  const hasData = chartData.length > 1;
  const loading = isRealtime ? !hasData : historyLoading;

  const rangeLabel = isRealtime
    ? '最近 5 分钟走势'
    : `最近${RANGES.find((r) => r.key === range)?.label}走势`;

  const getSource = (): string => {
    if (isRealtime) return isCNY ? '融通金' : 'Gold-API.com';
    if (isCNY) return 'AKShare · 上海黄金交易所（缓存至今日 23:59:59）';
    return 'AKShare · COMEX（缓存至今日 23:59:59）';
  };

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div className="chart-title">
          <span className="chart-metal-name">{metal.nameZh}</span>
          <span className="chart-range-label">{rangeLabel}</span>
        </div>

        <div className="chart-ranges">
          {RANGES.map((r) => {
            if (r.key !== '5M' && !hasHistory) return null;
            return (
              <button
                key={r.key}
                className={`chart-range-btn ${range === r.key ? 'chart-range-btn--active' : ''}`}
                onClick={() => handleRangeChange(r.key)}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="chart-data-count">
          {chartData.length} 个数据点
        </div>
      </div>

      <div className="chart-body">
        {loading ? (
          <div className="chart-loading">
            <div className="chart-spinner" />
            {isRealtime ? '等待数据采集中...每 10 秒自动记录' : '加载历史数据中...'}
          </div>
        ) : !hasData ? (
          <div className="chart-loading">
            {isRealtime ? '等待数据采集中...' : '暂无历史数据'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${metal.symbol}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`rgb(${gradientColor})`} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={`rgb(${gradientColor})`} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="label"
                stroke="rgba(255,255,255,0.2)"
                fontSize={11}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="rgba(255,255,255,0.2)"
                fontSize={11}
                tickLine={false}
                domain={[minPrice - padding, maxPrice + padding]}
                tickFormatter={(v: number) => v.toFixed(2)}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(30, 30, 48, 0.95)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '13px',
                }}
                formatter={(value) => [
                  `${currencySign}${Number(value).toFixed(2)}`,
                  '价格',
                ]}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#gradient-${metal.symbol}-${range})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-footer">
        <span className="chart-update-time">更新时间: {metal.updatedAt}</span>
        <span className="chart-unit">
          数据来源: {getSource()} · 单位: {metal.currency}/{metal.unit}
        </span>
      </div>
    </div>
  );
}
