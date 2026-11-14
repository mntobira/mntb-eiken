import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_EIKEN_');
  const base = process.env.EIKEN_BASE_PATH || '/';
  const isBuildOnly = command === 'build' && !process.env.VITEST;
  const rewriteAssets: Plugin = {
    name: 'eiken-isolated-assets',
    transform(code, id) {
      if (base === '/' || !id.includes('/src/') || !/\.(tsx?|css)$/.test(id)) return;
      return code.replace(/(["'`])\/(brand|mascots|icons|sfx|eiken_audio)\//g, `$1${base}$2/`);
    },
    generateBundle(_, bundle) {
      const modules = Object.values(bundle).flatMap(item => item.type === 'chunk' ? Object.keys(item.modules) : []);
      const forbidden = /\/src\/(?:data\/(?:englishListening(?:Data|Q)|englishGrammar(?:Data|Problems)|toeic|reading)|battle\/data\/(?:pool\.|answer\.))/;
      if (modules.some(id => forbidden.test(id))) this.error('大学入試・TOEIC問題バンクが英検版の配信対象に入りました。ビルドを停止します。');
      this.emitFile({ type: 'asset', fileName: 'build-modules.json', source: JSON.stringify(modules.filter(id => id.includes('/src/')).map(id => id.split('/src/')[1]), null, 2) });
    },
    transformIndexHtml(html) {
      const cloud = env.VITE_EIKEN_ENABLE_CLOUD === 'true';
      const project = env.VITE_EIKEN_FIREBASE_PROJECT_ID || '';
      const connect = cloud ? `'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://asia-northeast1-${project}.cloudfunctions.net` : "'self'";
      const csp = `default-src 'self'; script-src 'self'${cloud ? ' https://apis.google.com https://www.gstatic.com' : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.googleusercontent.com; font-src 'self' data:; media-src 'self' blob: data:; connect-src ${connect}; frame-src 'self'${cloud ? ` https://${project}.firebaseapp.com https://accounts.google.com` : ''}; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'`;
      return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  };
  const seqManifestPath = path.resolve(process.cwd(), '.vite-seq-cache/manifest.json');
  const seqBundle: {
    materials: Record<string, { key: string; exports: string[] }>;
    aliases: Record<string, string>;
  } = isBuildOnly && existsSync(seqManifestPath)
    ? JSON.parse(readFileSync(seqManifestPath, 'utf-8'))
    : { materials: {}, aliases: {} };

  const sequentialCachePlugin: Plugin = {
    name: 'sequential-precompiled-materials',
    load(id) {
      if (!isBuildOnly) return null;
      const cleanId = id.split('?')[0];
      const entry = seqBundle.materials[cleanId];
      if (!entry) return null;
      return entry.exports
        .map(exp => `export const ${exp} = "__MANATOBI_SEQ_DATA__:${entry.key}:${exp}__";`)
        .join('\n');
    },
  };
  return {
    base,
    plugins: [rewriteAssets, ...(isBuildOnly ? [sequentialCachePlugin] : []), react(), tailwind()],
    resolve: {
      alias: [
        ...(isBuildOnly
          ? Object.entries(seqBundle.aliases).map(([find, replacement]) => ({
              find: new RegExp(`^${find}$`),
              replacement,
            }))
          : []),
        { find: '@', replacement: path.resolve(process.cwd(), '.') },
      ],
    },
    define: { __KIT_BUILD__: JSON.stringify('英検版 2026-11-08') },
    build: {
      target: 'esnext',
      copyPublicDir: false,
      minify: false,
      cssMinify: false,
      reportCompressedSize: false,
      sourcemap: false,
      rollupOptions: {
        maxParallelFileOps: 1,
        output: {
          manualChunks(id) {
            const matMatch = id.match(/\/src\/eiken\/materials\/([^/.]+)/);
            if (matMatch) return `eiken-mat-${matMatch[1]}`;
            if (id.includes('node_modules')) {
              if (id.includes('/firebase/firestore')) return 'vendor-firestore';
              if (id.includes('/firebase/auth')) return 'vendor-fireauth';
              if (id.includes('/firebase/') || id.includes('/@firebase/') || id.includes('/@capacitor')) return 'vendor-firebase';
              if (id.includes('/pdfjs-dist/')) return 'vendor-pdf';
              if (id.includes('/katex/')) return 'vendor-katex';
              if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
              if (id.includes('/motion') || id.includes('/framer-motion')) return 'vendor-motion';
              if (id.includes('/lucide-react/')) return 'vendor-icons';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
