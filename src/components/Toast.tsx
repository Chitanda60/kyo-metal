import { useEffect } from 'react';
import type { PriceAlert } from '../types';
import './Toast.css';

interface ToastProps {
  alert: PriceAlert;
  onClose: () => void;
}

export default function Toast({ alert, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isUp = alert.type === 'up';

  return (
    <div className={`toast ${isUp ? 'toast--up' : 'toast--down'}`} onClick={onClose}>
      <div className="toast__icon">{isUp ? '▲' : '▼'}</div>
      <div className="toast__content">
        <div className="toast__title">
          {alert.nameZh}（{alert.symbol}）1分钟内{isUp ? '上涨' : '下跌'}{' '}
          <strong>{Math.abs(alert.percent).toFixed(2)}%</strong>
        </div>
        <div className="toast__detail">
          ${alert.refPrice} → ${alert.price}
        </div>
      </div>
    </div>
  );
}
