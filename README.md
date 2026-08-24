# TOEFL iBT Practice (Electron)

桌面端托福刷题应用。主进程（Electron）+ 渲染进程（Vue 3 + Vite）。

## 内容与许可

- **Practice Tests / Typing / Vocabulary**：免费使用，无需激活。
- **Official Tests（真实真题，date-id 型 TPO）**：需输入序列号激活本机后才能使用（一个序列号最多绑定 2 台设备）。

激活相关契约见 `docs/license-protocol-v1.md`。

## 开发

```bash
npm install
npm run dev          # 浏览器模式（不启用桌面 license，全部内容可用）
npm run electron:dev # Electron 模式（先 build 再启动主进程）
```

测试 / 校验：

```bash
npm test             # node --test + vitest
npm run lint
npm run build
```

## 接入 Web 环境（license API 地址配置）

桌面端激活走服务端「序列号/许可证」服务。API 基址解析优先级：

1. **环境变量** `TOEFL_API_BASE_URL`
2. **配置文件** `userData/web-config.json`（见下）
3. **默认常量**（`electron/services/license-config.js` 中的 `DEFAULT_API_BASE_URL`）

### 开发联调

```bash
# 方法一：环境变量
$env:TOEFL_API_BASE_URL = "http://localhost:3001"
npm run electron:dev

# 方法二：配置文件（userData 目录下创建 web-config.json）
# Windows: %APPDATA%\toefl-practice\web-config.json
# macOS:   ~/Library/Application Support/toefl-practice/web-config.json
```

```json
{
  "apiBaseUrl": "http://localhost:3001"
}
```

### 生产发布

发布前把 `electron/services/license-config.js` 中的 `DEFAULT_API_BASE_URL` 替换为正式域名
（或使用 web-config.json / 环境变量指向），例如 `https://your-domain`。

### 接口清单（服务端实现）

| 方法 | 路径 | 用途 |
| ---- | ---- | ---- |
| POST | /v1/licenses/devices/activate | 激活设备（code + 指纹） |
| POST | /v1/licenses/devices/refresh | 周期续期 |
| POST | /v1/licenses/devices/:deviceId/unbind | 解绑本机 |

服务端地址未就绪时，客户端以 mock server（`tests/` 内）走通激活 / 续期 / 解绑 / 过期 / 限额主流程。
