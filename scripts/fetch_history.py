#!/usr/bin/env python3
"""
贵金属历史数据获取脚本
支持按类型获取国内/国际黄金白银历史数据

用法:
  python fetch_history.py --type cn_gold --output ./history/data
  python fetch_history.py --type cn_silver --output ./history/data
  python fetch_history.py --type intl_gold --output ./history/data
  python fetch_history.py --type intl_silver --output ./history/data

品种：
  - cn_gold     国内黄金 Au99.99（CNY/克）— 上海黄金交易所
  - cn_silver   国内白银 Ag(T+D)（CNY/克）— 上海黄金交易所
  - intl_gold   COMEX黄金（USD/盎司）— 东方财富/新浪财经
  - intl_silver COMEX白银（USD/盎司）— 东方财富/新浪财经
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime
from typing import Callable, Any, Optional

# 必须在导入 akshare 前禁用代理（东方财富 API 在代理环境下可能连接失败）
for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 
            'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy']:
    os.environ.pop(key, None)

import akshare as ak

# 默认输出目录
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'history', 'data')

# 重试配置
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


def save_json(data: dict, filepath: str):
    """保存 JSON 文件（紧凑格式，无换行和空格）"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    print(f'  ✓ 已保存: {filepath} ({data["count"]} 条记录)')


def fetch_cn_gold(output_dir: str):
    """获取国内黄金 Au99.99 历史数据"""
    print('正在拉取 Au99.99 (上海黄金交易所) ...')
    
    def _fetch():
        return ak.spot_hist_sge(symbol='Au99.99')
    
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
    
    data = {
        'symbol': 'Au99.99',
        'name': '国内黄金',
        'currency': 'CNY',
        'unit': '克',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }
    
    filepath = os.path.join(output_dir, 'cn_gold_history.json')
    save_json(data, filepath)
    return data


def fetch_cn_silver(output_dir: str):
    """获取国内白银 Ag(T+D) 历史数据"""
    print('正在拉取 Ag(T+D) (上海黄金交易所) ...')
    
    def _fetch():
        return ak.spot_hist_sge(symbol='Ag(T+D)')
    
    df = retry_on_error(_fetch)
    
    records = []
    for _, row in df.iterrows():
        date_str = str(row['date'])[:10]
        # Ag(T+D) 单位是 CNY/千克，转换为 CNY/克
        records.append({
            'date': date_str,
            'open': round(float(row['open']) / 1000.0, 2),
            'close': round(float(row['close']) / 1000.0, 2),
            'high': round(float(row['high']) / 1000.0, 2),
            'low': round(float(row['low']) / 1000.0, 2),
        })
    
    data = {
        'symbol': 'Ag(T+D)',
        'name': '国内白银',
        'currency': 'CNY',
        'unit': '克',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }
    
    filepath = os.path.join(output_dir, 'cn_silver_history.json')
    save_json(data, filepath)
    return data


def fetch_intl_gold_em(output_dir: str):
    """获取 COMEX 黄金历史数据（东方财富接口）"""
    print('正在拉取 COMEX黄金 [东方财富] ...')
    
    def _fetch():
        return ak.futures_global_hist_em(symbol='GC00Y')
    
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
    
    data = {
        'symbol': 'GC00Y',
        'name': 'COMEX黄金',
        'currency': 'USD',
        'unit': '盎司',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }
    
    filepath = os.path.join(output_dir, 'intl_gold_history.json')
    save_json(data, filepath)
    return data


def fetch_intl_gold_sina(output_dir: str):
    """获取 COMEX 黄金历史数据（新浪财经接口）"""
    print('正在拉取 COMEX黄金 [新浪财经] ...')
    
    def _fetch():
        return ak.futures_foreign_hist(symbol='GC')
    
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
    
    data = {
        'symbol': 'GC',
        'name': 'COMEX黄金',
        'currency': 'USD',
        'unit': '盎司',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }
    
    filepath = os.path.join(output_dir, 'intl_gold_history.json')
    save_json(data, filepath)
    return data


def fetch_intl_silver_em(output_dir: str):
    """获取 COMEX 白银历史数据（东方财富接口）"""
    print('正在拉取 COMEX白银 [东方财富] ...')
    
    def _fetch():
        return ak.futures_global_hist_em(symbol='SI00Y')
    
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
    
    data = {
        'symbol': 'SI00Y',
        'name': 'COMEX白银',
        'currency': 'USD',
        'unit': '盎司',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }
    
    filepath = os.path.join(output_dir, 'intl_silver_history.json')
    save_json(data, filepath)
    return data


def fetch_intl_silver_sina(output_dir: str):
    """获取 COMEX 白银历史数据（新浪财经接口）"""
    print('正在拉取 COMEX白银 [新浪财经] ...')
    
    def _fetch():
        return ak.futures_foreign_hist(symbol='SI')
    
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
    
    data = {
        'symbol': 'SI',
        'name': 'COMEX白银',
        'currency': 'USD',
        'unit': '盎司',
        'count': len(records),
        'updatedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': records,
    }
    
    filepath = os.path.join(output_dir, 'intl_silver_history.json')
    save_json(data, filepath)
    return data


def fetch_intl_gold(output_dir: str):
    """获取 COMEX 黄金（带备选接口）"""
    try:
        return fetch_intl_gold_em(output_dir)
    except Exception as e:
        print(f'  ⚠ 东方财富接口失败，尝试新浪财经接口...')
        time.sleep(REQUEST_INTERVAL)
        try:
            return fetch_intl_gold_sina(output_dir)
        except Exception as e2:
            raise Exception(f'主接口: {e}; 备选接口: {e2}')


def fetch_intl_silver(output_dir: str):
    """获取 COMEX 白银（带备选接口）"""
    try:
        return fetch_intl_silver_em(output_dir)
    except Exception as e:
        print(f'  ⚠ 东方财富接口失败，尝试新浪财经接口...')
        time.sleep(REQUEST_INTERVAL)
        try:
            return fetch_intl_silver_sina(output_dir)
        except Exception as e2:
            raise Exception(f'主接口: {e}; 备选接口: {e2}')


def main():
    parser = argparse.ArgumentParser(description='贵金属历史数据获取脚本')
    parser.add_argument('--type', required=True, 
                        choices=['cn_gold', 'cn_silver', 'intl_gold', 'intl_silver', 'all'],
                        help='数据类型')
    parser.add_argument('--output', default=DEFAULT_OUTPUT_DIR,
                        help=f'输出目录 (默认: {DEFAULT_OUTPUT_DIR})')
    
    args = parser.parse_args()
    
    output_dir = os.path.abspath(args.output)
    os.makedirs(output_dir, exist_ok=True)
    
    print(f'输出目录: {output_dir}')
    print('')
    
    errors = []
    
    if args.type in ['cn_gold', 'all']:
        try:
            fetch_cn_gold(output_dir)
        except Exception as e:
            errors.append(f'国内黄金: {e}')
            print(f'  ✗ 国内黄金拉取失败: {e}')
        time.sleep(REQUEST_INTERVAL)
    
    if args.type in ['cn_silver', 'all']:
        try:
            fetch_cn_silver(output_dir)
        except Exception as e:
            errors.append(f'国内白银: {e}')
            print(f'  ✗ 国内白银拉取失败: {e}')
        time.sleep(REQUEST_INTERVAL)
    
    if args.type in ['intl_gold', 'all']:
        try:
            fetch_intl_gold(output_dir)
        except Exception as e:
            errors.append(f'COMEX黄金: {e}')
            print(f'  ✗ COMEX黄金拉取失败: {e}')
        time.sleep(REQUEST_INTERVAL)
    
    if args.type in ['intl_silver', 'all']:
        try:
            fetch_intl_silver(output_dir)
        except Exception as e:
            errors.append(f'COMEX白银: {e}')
            print(f'  ✗ COMEX白银拉取失败: {e}')
    
    print('')
    if errors:
        print(f'⚠ 完成，但有 {len(errors)} 个错误:')
        for err in errors:
            print(f'  - {str(err)[:150]}...')
        sys.exit(1)
    else:
        print('✓ 全部完成！')


if __name__ == '__main__':
    main()
