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

- 格式 `XXXX-XXXX-XXXX-XXXX`（大写字母 / 数字，末位为校验位）。
- 由管理员在服务端生成，一个序列号 = 一次内容权益 + 2 台设备激活配额。
- **有效性判定以服务端为准**；客户端只做格式轻校验（不做校验位计算）。

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
      { "deviceId": "<string>", "boundAt": "2026-08-24T00:00:00.000Z", "current": true }
    ],
    "deviceCount": 1
  }
}
```

语义：

- `expiresAt = now + 30 天`（离线宽限期）。
- **同 code + 同 fingerprint 重复激活 → 幂等，返回原绑定**（不新增设备、不重新签发 token）。
- `devices` + `deviceCount`：该序列号当前已绑定设备列表，供客户端设置页展示（≤ 2）。

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
    "devices": [{ "deviceId": "<string>", "boundAt": "...", "current": true }],
    "deviceCount": 1
  }
}
```

语义：

- 成功即把 `expiresAt` 续期为 `now + 30 天`。
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

- `scripts/mock-license-server.js`：内存版契约实现，命令 `node scripts/mock-license-server.js`（默认 `PORT=3001`）。
- 内置有效序列号：`TEST-0000-0000-0001`、`TEST-0000-0000-0004`。
- 客户端指向 mock：`TOEFL_API_BASE_URL=http://localhost:3001`（或 `userData/web-config.json`）。

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

### 7.4 待真实 Web API 联调

- [ ] 真实序列号：Web 兑换 → Electron 登录式激活（输入同一码）→ 绑 2 台 → 换机解绑 → 断网 30 天语义。
- [ ] 确认服务端「离线 >30 天」为软过期（同指纹重新激活幂等返回原绑定，不误触 `DEVICE_LIMIT`）。

---

## 8. 待服务端确认 / 依赖

- [ ] 生产环境服务器正式地址（当前默认常量占位，发布前替换）。
- [ ] 服务端「离线 > 30 天」后是否物理删除设备：建议**软过期**，同指纹重新 activate 幂等返回原绑定，避免误触 `DEVICE_LIMIT`。
