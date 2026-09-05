# License Protocol v1 — TOEFL 桌面端设备激活契约

> 本文件是桌面端（Electron）与 Web 服务端之间「序列号激活」的**唯一契约**。
> 服务端按本文实现，桌面端按本文调用。任何变更必须先改本文，再改两端代码。
>
> 版本：v1.0（定稿）｜日期：2026-08-24｜状态：定稿

---

## 1. 产品定位与模式

- 桌面端是**付费商品**（电商 + 微信销售），核心诉求 = **防安装包转发**。
- **无账号模式**：买家安装 → 输入序列号 → 激活本机（≤ 2 台），零注册摩擦。
- 全部 license 接口 **不使用 JWT**，凭「序列号 + 设备激活凭证」鉴权。

### 1.1 序列号

- 格式 `XXXX-XXXX-XXXX-XXXX`（4×4 大写字母 / 数字，第 16 位为校验位）。
- 字符集：A-Z **去掉 I/O** + 数字 **2-9**（共 32 字符，恒不含 `I/O/0/1`，避免手写混淆）。
- 由管理员在服务端生成，一个序列号 = 一次内容权益 + 2 台设备激活配额。
- **有效性判定以服务端为准**；客户端只做格式轻校验
  （`/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/`），**不做校验位计算**。
- 格式样例：`HHVV-V5K8-A7C8-3NYB`、`JA9Y-LXZ9-ADRC-DZMR`（仅演示格式，非可用码）。

### 1.2 设备指纹

```
deviceFingerprint = sha256(hostname + platform + arch + cpus[0].model + machineId)
```

- 只传 64 位 hex，**不传任何原始信息**。
- `machineId` 来自 `node-machine-id`（硬件级、跨重装稳定）。
- 指纹在同一台机器上应保持稳定；换机必然变化。

---

## 2. 端点到契约

### 2.1 激活设备

```
POST /v1/licenses/devices/activate
Content-Type: application/json
body: { "code": "XXXX-XXXX-XXXX-XXXX", "deviceFingerprint": "<64 hex>" }
```

成功 `200`：

```json
{
  "data": {
    "deviceId": "<string>",
    "activationToken": "<string>",
    "expiresAt": "2026-09-23T00:00:00.000Z",
    "devices": [
      {
        "deviceId": "<string>",
        "boundAt": "2026-08-24T00:00:00.000Z",
        "current": true,
        "expiresAt": "2026-09-23T00:00:00.000Z",
        "lastRefreshAt": "2026-08-24T00:00:00.000Z",
        "status": "active"
      }
    ],
    "deviceCount": 1
  }
}
```

语义：

- `expiresAt = now + 30 天`（离线宽限期）。
- **同 code + 同 fingerprint 重复激活 → 幂等**：不新增设备、不误触 `DEVICE_LIMIT`，返回**原
  `deviceId`**；`activationToken` 以**本次响应为准覆盖**（服务端只存 token 哈希，无法原样回吐
  旧明文 token，故重复激活可能返回**新 token** —— 客户端必须用响应值覆盖本地并持久化，见
  §4.2）。Electron 客户端在每次 `activate` 成功后已按此覆盖，无副作用。
- `devices[]` 每项：`deviceId`（公共 ID，与顶层 `deviceId` 一致）、`boundAt`（绑定时间）、
  `current`（**本次响应对应设备为 `true`，其余为 `false`**）；服务端可附带
  `expiresAt` / `lastRefreshAt` / `status` 等额外字段，**客户端忽略多余字段**。
- `deviceCount` = 当前有效设备数（≤ 2），供客户端设置页展示。

错误：

| HTTP | code                    | 说明                     |
| ---- | ----------------------- | ------------------------ |
| 404  | `LICENSE:INVALID`       | 码无效 / 已作废          |
| 409  | `LICENSE:DEVICE_LIMIT`  | 该序列号已绑定 2 台设备   |

### 2.2 周期续期

```
POST /v1/licenses/devices/refresh
Content-Type: application/json
body: { "deviceId": "<string>", "deviceFingerprint": "<64 hex>", "activationToken": "<string>" }
```

成功 `200`：

```json
{
  "data": {
    "deviceId": "<string>",
    "expiresAt": "2026-09-23T00:00:00.000Z",
    "devices": [
      {
        "deviceId": "<string>",
        "boundAt": "2026-08-24T00:00:00.000Z",
        "current": true,
        "expiresAt": "2026-09-23T00:00:00.000Z",
        "lastRefreshAt": "2026-08-24T00:00:00.000Z",
        "status": "active"
      }
    ],
    "deviceCount": 1
  }
}
```

语义：

- 成功即把 `expiresAt` 续期为 `now + 30 天`。
- `devices[]` 形状与 activate 一致（`deviceId` / `boundAt` / `current`，可含额外字段，客户端忽略）。
- 客户端**距上次成功 ≥ 7 天**才调用。
- `expiresAt ≤ now` 且 refresh 失败 → 客户端锁定，提示「许可证已过期，请联网重新激活」。

错误：

| HTTP | code                  | 说明                                       |
| ---- | --------------------- | ------------------------------------------ |
| 401  | `LICENSE:DEVICE_INVALID` | 超期（离线 > 30 天）/ 凭证与指纹不匹配 |

### 2.3 解绑设备

```
POST /v1/licenses/devices/:deviceId/unbind
Content-Type: application/json
body: { "code": "XXXX-XXXX-XXXX-XXXX", "activationToken": "<string>" }
```

成功 `200`：

```json
{ "data": { "status": "ok" } }
```

语义：

- 只能解绑**本机持有的 deviceId**（凭证与 code 必须匹配）。
- 解绑后该序列号释放一个名额。
- 换机 / 丢机：若本机不可解绑，由卖家在管理后台解绑。

---

## 3. 统一错误响应

失败统一返回（与 tech-design 第 12 节一致）：

```json
{
  "error": {
    "code": "LICENSE:DEVICE_LIMIT",
    "message": "该序列号已达到 2 台设备上限",
    "requestId": "req_...",
    "details": {}
  }
}
```

### 3.1 客户端文案映射

| 场景                | 提示文案                             |
| ------------------- | ------------------------------------ |
| `LICENSE:INVALID`   | 序列号无效或已作废，请核对后重试     |
| `LICENSE:DEVICE_LIMIT` | 该序列号已达到 2 台设备上限        |
| `LICENSE:DEVICE_INVALID` | 许可证失效，请联网重新激活        |
| 网络失败 / 超时     | 无法连接服务器，请检查网络后重试     |
| 格式错误            | 请输入正确的序列号（XXXX-XXXX-XXXX-XXXX） |

---

## 4. 客户端行为约定

1. **本地存储**：`userData/license-state.json`，`activationToken` 与 `code` 用 Electron `safeStorage` 加密（Linux 无 keyring 时降级明文并打标记）。
2. **激活流程**：用户点击被锁定的官方真题 → 输入序列号 → `activate` → 成功写入本地并解锁。
3. **续期时机**：启动时 + 每 ~6h + 窗口恢复时检查；`距上次成功 ≥ 7 天` 且联网 → `refresh`。
4. **锁定判定**：`expiresAt ≤ now` → 尝试 `refresh`；失败（含断网 / `DEVICE_INVALID`）→ 锁定并提示重新激活。
5. **重新激活即恢复**：`activate` 同指纹幂等，恢复后 `expiresAt = now + 30 天`。
6. **内容解锁**：激活成功后，本端全部官方真题（date-id 型 tpoId）可用；未激活时 Practice / Skills 免费可用，官方真题锁定。
7. **服务器地址**：`TOEFL_API_BASE_URL` 环境变量 → `userData/web-config.json` → 默认常量（生产占位，开发 `http://localhost:3001`）。详见 `README.md`。

---

## 5. 状态机

```
                 activate(同指纹幂等)
  not-activated ───────────────────────▶ active ──┐
        ▲                                        │ 每 ≥7 天 refresh 续期
        │                                        │ (expiresAt 刷新为 now+30d)
        └───── 重新 activate(同指纹) ◀───────── 过期: expiresAt ≤ now
                                                │
                                                ▼
                                          locked（提示联网重新激活）
```

- `active`：`expiresAt > now`，内容可用。
- `locked`：`expiresAt ≤ now` 且 refresh 失败；官方真题锁定，引导重新激活。
- 换机 / 丢机：服务端管理后台解绑。

---

## 7. 联调记录（E7）

> Web 服务端就绪前的 mock 阶段联调结果。真实 Web API 就绪后，以同一套契约重新联调并更新本表。

### 7.1 Mock 环境

- `scripts/mock-license-server.js`：内存版契约实现，命令 `node scripts/mock-license-server.js`（默认 `PORT=3002`，避开可能被 toefl-web 占用的 3001）。
- 内置有效序列号：`TEST-0000-0000-0001`、`TEST-0000-0000-0004`。
- 客户端指向 mock：`TOEFL_API_BASE_URL=http://localhost:3002`（或 `userData/web-config.json`）。

### 7.2 手动冒烟（真实设备指纹，2026-08-24）

| 步骤 | 输入 | 结果 |
| ---- | ---- | ---- |
| 激活 | 紧凑码 `test000000000001`（自动补全连字符） | `status:active`，`deviceCount:1`，返回 `deviceId + expiresAt` |
| 周期校验 | 7 天内启动 | `status:active`，无 refresh 请求 |
| 离线超期 | 距上次成功 >30 天 | `status:locked`，提示「许可证已过期，请联网重新激活」 |
| 重新激活 | 同指纹同码 | 幂等恢复原绑定（同 `deviceId`），`status:active` |
| 解绑 | 本机 token + code | `status:none`，本地状态清空 |

### 7.3 自动化覆盖（`tests/electron/license-integration.test.js`，4 项）

- 激活 → 第 2 台 → 第 3 台被拒（`409 LICENSE:DEVICE_LIMIT`）→ 同设备幂等 → 解绑释放名额 → 新设备补位。
- 未知 / 作废码 → `404 LICENSE:INVALID`。
- 离线 31 天 → refresh `401` → 客户端锁定 → 同指纹重新激活幂等恢复。
- 解绑凭证不匹配 → `401 LICENSE:DEVICE_INVALID`。

### 7.4 服务端回传确认（2026-08-26）

toefl-web 服务端已实现接口并逐条回传确认，全部与本文契约一致：

- [x] 三接口均**无鉴权（无 JWT）**。
- [x] `expiresAt` 口径 = 最近成功（激活/续期）+ 30 天，activate / refresh 一致。
- [x] 离线超 30 天 = **软过期**：同 fingerprint 重新 activate **幂等返回原 deviceId**（旋转新 activationToken + 重置 30 天宽限），不新建绑定、不误触 `LICENSE:DEVICE_LIMIT`。
- [x] 字段名 / 错误码一致（`404 INVALID` / `409 DEVICE_LIMIT` / `401 DEVICE_INVALID`；信封 `{ error:{ code, message, requestId } }`）。
- [x] `unbind` → `{ data: { status:'ok' } }`。
- [x] activate / refresh 响应补齐 `devices[]`（`{ deviceId, boundAt, current, ... }`，`deviceId` 为公共 ID 与顶层一致、`current` 为本次响应设备）与 `deviceCount`（有效设备数 ≤ 2）。
- [x] 修复边界：换机「先解绑、再同 fingerprint 重激活」不再撞唯一索引（解绑后可重新激活）。
- 真实联调地址：`http://localhost:3001`（服务端全局前缀 `/v1`）；我方 `TOEFL_API_BASE_URL=http://localhost:3001`（**不带路径**，客户端自动拼 `/v1/licenses/...`）。
- 真实序列号由 `gen:licenses` 生成；**`TEST-0000-0000-0001` 等 mock 码不满足真实格式，真实服务端会 404**，联调必须使用真实码。

### 7.5 待真实 Web API 联调

- [x] Web 端三端点已实现（activate / refresh / unbind），语义与契约核对一致（2026-09-02 Web 回填）。
- [x] 生产 API 基址：开发 `http://localhost:3001`（API 根、不带 `/v1`）与客户端约定一致；生产域名待 Web 部署后提供。
- [x] 指纹大小写：客户端 `sha256(...).digest('hex')` 恒为小写 `[a-f0-9]{64}`；服务端当前按小写校验，兼容。
- [x] 换机「先解绑、再同指纹重激活」不撞唯一索引：已由 Web 端按 (license_id, fingerprint) 匹配验证。
- [x] refresh 不旋转 token；服务端不限最小续期间隔（客户端每 7 天调一次），另有 30 次/时/设备限频护栏。
- [x] Web 端错误语义：`404 LICENSE:INVALID` / `409 LICENSE:DEVICE_LIMIT` / `401 LICENSE:DEVICE_INVALID`，信封 `{ error:{ code, message, requestId } }` 一致。
- [x] 断网 30 天端到端：Web 端已支持可配置宽限期环境变量 `LICENSE_DEVICE_GRACE_DAYS`（默认 30，支持小数，如 0.01 ≈ 14 分钟），临时调小即可快速验证「软过期 → 同指纹重新 activate 恢复」，验证后改回 30；测试已覆盖。客户端无需改动（服务端 commit 4342fb0）。
- [ ] 拿到 2 张真实序列号后执行完整链路：Web 兑换 → Electron 激活 → 绑 2 台 → 换机解绑 → 断网语义。真实码示例（Web 已提供）：`V4Q8-4Q2V-KHNU-6GCS` / `UXSD-87NS-LXND-SF48`（`TEST-0000-0000-0001` 无校验位，真实服务端 404）。

---

## 8. 待办 / 依赖

- [x] **Web 端正式域名：`https://www.justtofu.com`**（已上线，2026-09 确认规范值；裸域 justtofu.com 待 DNS 后可选 301）。已切换：
  - `electron/services/license-config.js` 的 `DEFAULT_API_BASE_URL` → `https://www.justtofu.com`（不带 /v1，客户端自拼；开发可用 `TOEFL_API_BASE_URL` 覆盖）。
  - `src/vue/platform/promoConfig.js`：`WEB_BASE_URL` = `https://www.justtofu.com`、`PROMO_JUMP_ENABLED` = `true`（首页「前往网页版」横幅可点击跳转）。
- [x] 服务端软过期语义：已确认（同指纹重新 activate 幂等返回原 deviceId，不误触 `DEVICE_LIMIT`；token 以响应为准覆盖）。
- [x] 联调基址语义：已确认（`TOEFL_API_BASE_URL` 为 API 根、不含 `/v1`，客户端自拼）。
- [x] 序列号签发/交付：Web 端脚本 `gen:licenses` 批发生成 → 卖家人工发码；DB 只存 `sha256(code)+code_tail`，明文一次性输出。「支付成功自动发码」排入 Web 下一轮，暂未上线。
- [x] Web 能力补充（2026-09 上线确认）：序列号 Web/桌面**双端通用**；购买 Web 权益自动发桌面码（¥30 捆绑），退款连带作废；Web 权益页含「下载桌面版」卡（Win EXE / macOS DMG，指向阿里云 OSS 稳定 latest 直链）。
- [ ] 桌面更新源迁阿里云 OSS：feed 目标 `https://justtofu-downloads.oss-cn-hangzhou.aliyuncs.com/releases/latest/`；镜像 workflow（`oss-mirror.yml`）+ 清单改写脚本（`scripts/rewrite-update-metadata.js`）已建；待 OSS RAM AccessKey 进 secrets + 首次镜像跑通后，随下一版把 `build.publish.url` 切到 OSS。
