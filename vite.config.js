import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';

const base = '/chess-station/';

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = loadEnv(mode, process.cwd(), 'API_PROXY_');

  return {
    base,
    server: {
      host: '127.0.0.1',
      proxy: {
        [`${base}api/v1`]: {
          target: API_PROXY_TARGET || 'http://127.0.0.1:3001',
          rewrite: path => path.replace(base, '/'),
        },
      },
    },
  };
});
