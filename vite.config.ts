import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
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
        target: 'https://47.110.128.239:8443',
        changeOrigin: true,
        secure: false, // 自签名证书
      },
    },
  },
})
