#!/usr/bin/env python3
"""
从 AKShare 拉取贵金属历史数据，生成 JSON 供前端使用。

品种：
  - Au99.99     国内黄金现货（CNY/克）        — 上海黄金交易所
  - Ag(T+D)     国内白银延期（CNY/千克→CNY/克） — 上海黄金交易所
  - GC          COMEX黄金（USD/盎司）          — 新浪财经外盘期货
  - SI          COMEX白银（USD/盎司）          — 新浪财经外盘期货

输出：
  public/data/cn_gold_history.json
  public/data/cn_silver_history.json
  public/data/intl_gold_history.json
  public/data/intl_silver_history.json

可通过 GitHub Actions 定时自动执行。
"""

import os
import sys
import argparse

# 必须在导入 akshare 前禁用代理（东方财富 API 在代理环境下可能连接失败）
for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 
            'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy']:
    os.environ.pop(key, None)

import json
import time
from datetime import datetime
from typing import Callable, Any, Optional

import akshare as ak

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
MAX_RETRIES = 3
RETRY_DELAY = 5  # 秒
REQUEST_INTERVAL = 2  # 秒


def retry_on_error(func: Callable, max_retries: int = MAX_RETRIES, delay: int = RETRY_DELAY) -> Any:
    """带重试机制的函数包装器"""
    last_error = None
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            last_error = e
            error_msg = str(e)[:100]
            print(f'    ⚠ 第 {attempt + 1} 次尝试失败: {error_msg}...')
            if attempt < max_retries - 1:
                print(f'    ⏳ 等待 {delay} 秒后重试...')
                time.sleep(delay)
    raise last_error


def save_json(data: dict, filename: str):
    """保存 JSON 文件"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    print(f'  ✓ → {filepath} ({data["count"]} 条记录)')


def fetch_sge(symbol: str, output_name: str, price_divisor: float = 1.0):
    """拉取上海黄金交易所现货历史数据"""
    print(f'正在拉取 {symbol} (上海黄金交易所) ...')
    
    def _fetch():
        return ak.spot_hist_sge(symbol=symbol)
    
    df = retry_on_error(_fetch)

    records = []
    for _, row in df.iterrows():
        date_str = str(row['date'])[:10]
        records.append({
            'date': date_str,
            'open': round(float(row['open']) / price_divisor, 2),
            'close': round(float(row['close']) / price_divisor, 2),
            'high': round(float(row['high']) / price_divisor, 2),
            'low': round(float(row['low']) / price_divisor, 2),
        })

    save_json({
        'symbol': symbol,
        'currency': 'CNY',
        'unit': '克',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }, f'{output_name}.json')


def fetch_comex_em(symbol: str, name: str, output_name: str):
    """拉取东方财富外盘期货历史数据（主接口）"""
    print(f'正在拉取 {symbol} ({name}) [东方财富] ...')
    
    def _fetch():
        return ak.futures_global_hist_em(symbol=symbol)
    
    df = retry_on_error(_fetch)

    records = []
    for _, row in df.iterrows():
        date_str = str(row['日期'])[:10]
        records.append({
            'date': date_str,
            'open': round(float(row['开盘']), 2),
            'close': round(float(row['最新价']), 2),
            'high': round(float(row['最高']), 2),
            'low': round(float(row['最低']), 2),
        })

    save_json({
        'symbol': symbol,
        'currency': 'USD',
        'unit': '盎司',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }, f'{output_name}.json')


def fetch_comex_sina(symbol: str, name: str, output_name: str):
    """拉取新浪财经外盘期货历史数据（备选接口）"""
    print(f'正在拉取 {symbol} ({name}) [新浪财经] ...')
    
    def _fetch():
        return ak.futures_foreign_hist(symbol=symbol)
    
    df = retry_on_error(_fetch)

    records = []
    for _, row in df.iterrows():
        date_str = str(row['date'])[:10]
        records.append({
            'date': date_str,
            'open': round(float(row['open']), 2),
            'close': round(float(row['close']), 2),
            'high': round(float(row['high']), 2),
            'low': round(float(row['low']), 2),
        })

    save_json({
        'symbol': symbol,
        'currency': 'USD',
        'unit': '盎司',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }, f'{output_name}.json')


def fetch_comex_with_fallback(symbol_em: str, symbol_sina: str, name: str, output_name: str):
    """拉取 COMEX 数据，主接口失败时使用备选接口"""
    try:
        fetch_comex_em(symbol_em, name, output_name)
    except Exception as e:
        print(f'  ⚠ 东方财富接口失败，尝试新浪财经接口...')
        time.sleep(REQUEST_INTERVAL)
        try:
            fetch_comex_sina(symbol_sina, name, output_name)
        except Exception as e2:
            raise Exception(f'主接口: {e}; 备选接口: {e2}')


def fetch_domestic_data(errors: list):
    """获取国内黄金白银数据"""
    print('\n📊 开始获取国内数据...')
    
    # 国内黄金 Au99.99 — CNY/克
    try:
        fetch_sge('Au99.99', 'cn_gold_history', price_divisor=1.0)
    except Exception as e:
        errors.append(f'国内黄金: {e}')
        print(f'  ✗ 国内黄金拉取失败: {e}')
    
    time.sleep(REQUEST_INTERVAL)

    # 国内白银 Ag(T+D) — CNY/千克 → CNY/克
    try:
        fetch_sge('Ag(T+D)', 'cn_silver_history', price_divisor=1000.0)
    except Exception as e:
        errors.append(f'国内白银: {e}')
        print(f'  ✗ 国内白银拉取失败: {e}')


def fetch_international_data(errors: list):
    """获取国际黄金白银数据"""
    print('\n📊 开始获取国际数据...')
    
    # COMEX黄金 — USD/盎司（带备选接口）
    try:
        fetch_comex_with_fallback('GC00Y', 'GC', 'COMEX黄金', 'intl_gold_history')
    except Exception as e:
        errors.append(f'COMEX黄金: {e}')
        print(f'  ✗ COMEX黄金拉取失败: {e}')
    
    time.sleep(REQUEST_INTERVAL)

    # COMEX白银 — USD/盎司（带备选接口）
    try:
        fetch_comex_with_fallback('SI00Y', 'SI', 'COMEX白银', 'intl_silver_history')
    except Exception as e:
        errors.append(f'COMEX白银: {e}')
        print(f'  ✗ COMEX白银拉取失败: {e}')


def main():
    parser = argparse.ArgumentParser(description='拉取贵金属历史数据')
    parser.add_argument('--type', choices=['cn', 'intl', 'all'], default='all',
                        help='数据类型：cn=国内, intl=国际, all=全部（默认）')
    args = parser.parse_args()

    errors = []

    if args.type in ('cn', 'all'):
        fetch_domestic_data(errors)

    if args.type in ('intl', 'all'):
        fetch_international_data(errors)

    if errors:
        print(f'\n⚠ 完成，但有 {len(errors)} 个错误:')
        for err in errors:
            print(f'  - {str(err)[:150]}...')
        sys.exit(1)
    else:
        print('\n✓ 全部完成！')


if __name__ == '__main__':
    main()
