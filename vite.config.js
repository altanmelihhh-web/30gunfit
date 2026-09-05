import fs from 'fs';
import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

// CRA projesi JSX'i .jsx değil .js dosyalarında kullanıyor. Vite/Rollup'ın import
// analizi .js içeriğini düz JS sanıp JSX görünce patlıyor - src/ altındaki .js
// dosyalarını Rollup görmeden önce esbuild ile JSX olarak transform ediyoruz.
const loadJsFilesAsJsx = {
  name: 'load-js-files-as-jsx',
  async load(id) {
    if (!id.match(/\/src\/.*\.js$/)) return null;
    const code = await fs.promises.readFile(id, 'utf-8');
    return transformWithEsbuild(code, id, { loader: 'jsx' });
  }
};

// Firebase Hosting "build" klasörünü beklediği için outDir'i CRA ile aynı tutuyoruz
export default defineConfig({
  plugins: [
    { ...loadJsFilesAsJsx, enforce: 'pre' },
    react()
  ],
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' }
    }
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'firebase-vendor';
          }
        }
      }
    }
  },
  server: {
    port: 3000
  }
});
