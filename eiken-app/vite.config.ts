import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_EIKEN_');
  const base = process.env.EIKEN_BASE_PATH || '/';
  const rewriteAssets: Plugin = {
    name: 'eiken-isolated-assets',
    transform(code, id) {
      if (base === '/' || !id.includes('/src/') || !/\.(tsx?|css)$/.test(id)) return;
      return code.replace(/(["'`])\/(brand|mascots|icons|sfx|eiken_audio)\//g, `$1${base}$2/`);
    },
    generateBundle(_, bundle) {
      const modules = Object.values(bundle).flatMap(item => item.type === 'chunk' ? Object.keys(item.modules) : []);
      this.emitFile({ type: 'asset', fileName: 'build-modules.json', source: JSON.stringify(modules.filter(id => id.includes('/src/')).map(id => id.split('/src/')[1]), null, 2) });
    },
    transformIndexHtml(html) {
      const cloud = env.VITE_EIKEN_ENABLE_CLOUD === 'true';
      const project = env.VITE_EIKEN_FIREBASE_PROJECT_ID || '';
      const connect = cloud ? "'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com" : "'self'";
      const csp = `default-src 'self'; script-src 'self'${cloud ? ' https://apis.google.com https://www.gstatic.com' : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; font-src 'self' data:; media-src 'self' blob: data:; connect-src ${connect}; frame-src 'self'${cloud ? ` https://${project}.firebaseapp.com https://accounts.google.com` : ''}; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'`;
      return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  };
  return {
    base,
    plugins: [rewriteAssets, react(), tailwind()],
    resolve: { alias: { '@': path.resolve(process.cwd(), '.') } },
    define: { __KIT_BUILD__: JSON.stringify('英検版 2026-11-08') },
    build: { minify: false, cssMinify: false, reportCompressedSize: false, sourcemap: false, rollupOptions: { maxParallelFileOps: 2, output: { manualChunks(id) { if (id.includes('node_modules')) { if (id.includes('/firebase/') || id.includes('/@firebase/') || id.includes('/@capacitor')) return 'vendor-firebase'; if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react'; if (id.includes('/motion') || id.includes('/framer-motion')) return 'vendor-motion'; if (id.includes('/lucide-react/')) return 'vendor-icons'; return 'vendor'; } } } } },
  };
});
