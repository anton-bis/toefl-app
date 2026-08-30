# macOS 安装支持 — "已损坏"处理（Tofu Practice）

> 面向 Mac 用户安装后报 "已损坏" 的官方处理文案。
> ⚠️ 核心事实：**"已损坏" 与文件名/应用名无关**，是 **macOS 对未签名应用（未 Apple 签名 + 公证）的拦截**。
> 本文件使用期间，若产品名/应用名再次修改，**必须同步更新本文档**（尤其方法 2 的命令）。

## 报错名 vs 命令名（先理解，别搞混）

| 名称 | 当前值 | 作用 |
| --- | --- | --- |
| 产品名 / `.app` 名 | `Tofu Practice.app` | 安装后出现在"应用程序"里的名字 |
| 可执行文件名（报错显示） | `toefl-practice` | macOS 报错时显示的标识，**不是命令要用的名字** |
| 安装包（dmg）文件名 | `TOEFL-iBT-Practice-<版本>-macos-<架构>.dmg` | 下载介质，与"已损坏"无关 |

> macOS 报错显示的 `toefl-practice` 是**可执行文件名**；`xattr` 命令清除的是**整个 `.app`** 的隔离属性，命令里要用 `.app` 名（如 `Tofu Practice.app`），不是 `toefl-practice`。

## 给用户的处理文案

> **macOS 安装报"已损坏"处理（Tofu Practice）**
>
> **方法 1：系统设置**
> 系统设置 → 隐私与安全性 → 看到 "已阻止打开'Tofu Practice'，因为来自身份不明的开发者" → 点击"仍要打开" → 确认"打开"
> 若没有该选项，先把 dmg 里的 **Tofu Practice.app** 拖到"应用程序"，再试一次
>
> **方法 2：终端命令（最快，先查名再执行）**
> ```
> ls /Applications | grep -i -E "tofu|toefl"
> sudo xattr -rd com.apple.quarantine "/Applications/<上一步看到的实际名>.app"
> ```
> 第二行的 `<实际名>` 替换成第一步 `ls` 看到的 `.app` 名（当前版本是 `Tofu Practice.app`，含空格必须加引号）。
>
> **方法 3：彻底关闭 Gatekeeper（不推荐长期开启）**
> ```
> sudo spctl --master-disable
> ```
> 恢复：
> ```
> sudo spctl --master-enable
> ```
>
> **推荐方法 2。** 若"允许任何来源"后仍报损坏，一般是安装包未签名且下载不完整 / 架构不匹配，请重新下载 **arm64（Apple 芯片）或 x64（Intel）** 对应的安装包。

## 运营备忘

- 本软件 Mac 包**未做 Apple 签名 + 公证**，任何网上下载都会触发 macOS 拦截 → 每个新用户都要按方法 1/2 绕一次。
- **根治办法**：Apple Developer Program（¥688/年）→ Developer ID 证书 → CI（`release.yml`）配置 5 个 `MAC_*` secrets 自动签名 + 公证。签名后用户开箱即用，不再出现"已损坏"。
- 改名联动：`package.json` 的 `productName`（`.app` 名）若改动，**必须**回来更新本文档方法 2 的命令名。
