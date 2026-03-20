/**
 * Vercel Serverless Function — 融通金接口代理
 *
 * 部署: cd proxy && npx vercel --prod
 * 访问: https://your-project.vercel.app/api/rtj
 */

import http from 'node:http';

const TARGET = {
  hostname: 'www.beijingrtj.com',
  port: 80,
  path: '/admin/get_price5.php',
};

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://chitanda60.github.io',
];

function fetchRtj() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: TARGET.hostname,
        port: TARGET.port,
        path: TARGET.path,
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 8000,
      },
      (resp) => {
        let data = '';
        resp.on('data', (chunk) => (data += chunk));
        resp.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const text = await fetchRtj();

    if (!text.startsWith('price,')) {
      return res.status(502).json({ error: 'Bad response', body: text.slice(0, 200) });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
