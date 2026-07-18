import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'fs';
import path from 'path';
import { RUNTIME_CONTENT_EXTENSIONS } from './electron/services/runtime-content.js';

const isElectron = process.env.ELECTRON === 'true';
const assetsRoot = path.resolve(import.meta.dirname, 'assets');
const vocabularyRuntimeFiles = new Set(
  [
    'manifest.json',
    'reading-words.json',
    'listening-words.json',
    'writing-words.json',
    'speaking-words.json'
  ].map(file => `questions/vocabulary/${file}`)
);

export function isRuntimeAsset(source, sourceRoot = assetsRoot) {
  const relative = path.relative(sourceRoot, source).split(path.sep).join('/');
  if (!relative) return true;
  if (fs.statSync(source).isDirectory()) {
    if (relative === 'images' || relative.startsWith('images/')) return false;
    return true;
  }
  if (relative.startsWith('questions/vocabulary/')) {
    return vocabularyRuntimeFiles.has(relative);
  }
  if (!RUNTIME_CONTENT_EXTENSIONS.has(path.extname(relative).toLowerCase())) return false;
  return (
    relative.startsWith('questions/') ||
    relative.startsWith('audio/vocab/') ||
    relative.startsWith('icons/')
  );
}

export function copyRuntimeContent(sourceRoot, destinationRoot) {
  function copyDirectory(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (!isRuntimeAsset(source, sourceRoot)) continue;
      if (entry.isDirectory()) {
        copyDirectory(source);
        continue;
      }
      const destination = path.join(destinationRoot, path.relative(sourceRoot, source));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }

  copyDirectory(sourceRoot);
}

export default defineConfig({
  base: isElectron ? './' : '/',
  server: {
    port: 3000,
    open: !isElectron,
    host: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) return 'vue';
          if (id.includes('node_modules/pinia') || id.includes('node_modules/vue-router')) {
            return 'navigation';
          }
        }
      }
    },
    chunkSizeWarningLimit: 100
  },
  plugins: [
    vue(),
    {
      name: 'remove-crossorigin',
      enforce: 'post',
      transformIndexHtml: html => html.replace(/\s*crossorigin(?:\s*=\s*"[^"]*")?\s*/g, ' ')
    },
    {
      name: 'copy-runtime-content',
      closeBundle() {
        copyRuntimeContent(assetsRoot, path.resolve(import.meta.dirname, 'dist/assets'));
      }
    }
  ],
  esbuild: {
    drop: isElectron ? ['console', 'debugger'] : ['debugger']
  },
  css: {
    devSourcemap: !isElectron
  }
});
