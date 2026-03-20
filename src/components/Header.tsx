import { useEffect, useState } from 'react';
import './Header.css';

export default function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">
            <span className="header-icon">◆</span>
            贵金属实时行情
          </h1>
          <span className="header-subtitle">Precious Metals Live</span>
        </div>
        <div className="header-right">
          <div className="header-time">
            {time.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              weekday: 'short',
            })}
          </div>
          <div className="header-clock">
            {time.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
