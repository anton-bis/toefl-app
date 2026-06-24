import { defineConfig } from 'vite';
import path from 'path';

// 检查是否为Electron环境
const isElectron = process.env.ELECTRON === 'true';

export default defineConfig({
  // 使用 MPA 模式以支持 tpo/ 目录下的多个独立 HTML 页面
  appType: 'mpa',

  // 项目根目录
  root: '.',

  // 基础路径 - Electron使用相对路径
  base: isElectron ? './' : '/',

  // 开发服务器配置
  server: {
    port: 3000,
    open: !isElectron, // Electron环境下不自动打开浏览器
    host: true, // 允许局域网访问
    cors: true,

    // 热更新
    hmr: {
      overlay: true
    }
  },

  // 构建配置
  build: {
    outDir: 'dist',
    sourcemap: isElectron ? false : true, // Electron生产环境关闭sourcemap以增加安全性
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: isElectron, // Electron生产环境移除console
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          // 将核心框架代码单独打包
          core: [
            'src/core/loader.js',
            'src/core/parser.js',
            'src/core/store.js',
            'src/core/utils.js'
          ],
          // 将组件单独打包
          components: ['src/components/FillBlank.js']
        }
      },
      external: isElectron ? [] : [] // 可在此处添加Electron特有的外部依赖
    },
    // 构建后清空dist目录
    emptyOutDir: true,
    // 资源文件处理
    assetsInlineLimit: 4096, // 4kb以下资源内联
    chunkSizeWarningLimit: 1000 // 块大小警告限制
  },

  // 插件配置
  plugins: [
    // 开发模式下 /dist/index.html 302 重定向到 /
    {
      name: 'dist-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/dist/index.html' || req.url === '/dist/') {
            res.statusCode = 302;
            res.setHeader('Location', '/');
            res.end();
            return;
          }
          next();
        });
      }
    },
    {
      name: 'remove-crossorigin',
      transformIndexHtml(html) {
        return html
          .replace(/\s*crossorigin(?:\s*=\s*"[^"]*")?\s*/g, ' ')
          .replace(/<link\s+rel="modulepreload"\s+crossorigin\s+href="[^"]*">/g, '');
      },
      enforce: 'post'
    }
  ],

  // 解析配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@assets': path.resolve(__dirname, 'assets'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@electron': path.resolve(__dirname, 'electron')
    }
  },

  // 优化配置
  optimizeDeps: {
    include: [], // 预构建的依赖
    exclude: isElectron ? [] : [] // Electron环境下排除某些依赖
  },

  // 环境变量
  define: {
    __IS_ELECTRON__: JSON.stringify(isElectron),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  },

  // CSS配置
  css: {
    devSourcemap: !isElectron, // Electron开发环境关闭CSS sourcemap
    preprocessorOptions: {
      scss: {
        additionalData: `$is-electron: ${isElectron};`
      }
    }
  }
});
