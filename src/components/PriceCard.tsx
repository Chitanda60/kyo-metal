import type { MetalPrice } from '../types';
import './PriceCard.css';

interface PriceCardProps {
  metal: MetalPrice;
  selected: boolean;
  onClick: () => void;
}

export default function PriceCard({ metal, selected, onClick }: PriceCardProps) {
  const isUp = metal.change >= 0;
  const isCNY = metal.currency === 'CNY';
  const currencySign = isCNY ? '¥' : '$';

  return (
    <div
      className={`price-card ${selected ? 'price-card--selected' : ''} ${
        isUp ? 'price-card--up' : 'price-card--down'
      }`}
      onClick={onClick}
    >
      <div className="price-card__header">
        <div className="price-card__name-group">
          <span className="price-card__name">{metal.nameZh}</span>
          <span className="price-card__symbol">
            {isCNY ? 'CNY/克' : `${metal.symbol}/USD`}
          </span>
        </div>
      </div>

      <div className="price-card__price">
        <span className="price-card__currency">{currencySign}</span>
        {metal.price.toLocaleString(isCNY ? 'zh-CN' : 'en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </div>

      <div className="price-card__change-row">
        <span className={`price-card__change ${isUp ? 'up' : 'down'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(metal.change).toFixed(2)}
        </span>
        <span className={`price-card__percent ${isUp ? 'up' : 'down'}`}>
          {isUp ? '+' : ''}
          {metal.changePercent.toFixed(2)}%
        </span>
      </div>

      <div className="price-card__details">
        <div className="price-card__detail">
          <span className="price-card__label">最高</span>
          <span className="price-card__value">{currencySign}{metal.high.toFixed(2)}</span>
        </div>
        <div className="price-card__detail">
          <span className="price-card__label">最低</span>
          <span className="price-card__value">{currencySign}{metal.low.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
