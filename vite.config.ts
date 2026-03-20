import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')
  
  // 从环境变量读取服务器地址，默认使用本地开发地址
  const serverUrl = env.VITE_SERVER_URL || ''
  
  return {
    plugins: [react()],
    base: process.env.NODE_ENV === 'production' ? '/kyo-metal/' : '/',
    server: {
      proxy: {
        // 融通金实时价格
        '/api/rtj': {
          target: 'http://www.beijingrtj.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/rtj/, ''),
        },
        // 价格采集服务（本地开发走阿里云 Nginx 代理）
        '/api/history': {
          target: serverUrl,
          changeOrigin: true,
          secure: false, // 自签名证书
        },
      },
    },
  }
})
