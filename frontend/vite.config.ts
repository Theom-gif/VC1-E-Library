import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiProxyTarget = String(
    env.VITE_BACKEND_PROXY_TARGET || env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
  ).replace(/\/+$/, '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/storage': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/login': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/register': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/logout': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/me': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/author': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
