# 踩坑日志

## Git 操作：bash 在 Windows 上的路径陷阱（2026-06-16）

**症状：** `rm -rf .git/index` 在 bash 里执行，shell cwd 被重置到 `C:\Users\Administrator`，导致整个项目文件被删。

**根因：** bash (WSL/MSYS) 和 PowerShell 的 cwd 不互通。多个 `git -C` 命令之间 shell cwd 可能被重置，后续命令在错误目录执行。

**教训：**
- Windows 上 git 操作用 PowerShell（`Set-Location` 先设目录），不用 bash
- 任何 `rm -rf` 前必须确认当前目录
- 破坏性 git 操作（`reset --hard`、`clean -f`）在 Windows 混合 shell 环境下尤其危险

**恢复途径：** Claude Code 的 file-history 备份在 `~/.claude/file-history/<session-id>/`，按文件哈希+版本号存储。本次全部 17 个文件从备份恢复。

## 微信同声传译插件不可用于开发环境（2026-06-16）

**症状：** 模拟器启动报 `provider:wx069ba97219f66d99, user uin can not visit app`

**根因：** 该插件需要微信官方 app 授权，只能在已授权的小程序生产环境使用，开发/模拟器无法加载。

**当前状态：** 已从 app.json 移除插件声明，录音用基础 `RecorderManager`。语音转文字需生产环境测试。

## 长按录音交互：touch 事件链（2026-06-16）

**症状：** 长按 2s 触发录音后松手，录音立即停止。

**根因：** `touchstart` → 2s timer → `startRecord()`。`touchend` 触发 `tap` 事件 → `onVinylTap` 看到 `recording=true` → 调用 `stopRecord()`。

**修复：** timer 回调里设 `_ignoreNextTap = true`，`onVinylTap` 检查此标记后跳过停止逻辑。

## DeepSeek prompt 重复声明（2026-06-16）

**症状：** `Identifier 'DUAL_CARD_PROMPT' has already been declared`

**根因：** 文件重写时残留了一行 `var DUAL_CARD_PROMPT = DUAL_CARD_PROMPT;`，与顶部 `const DUAL_CARD_PROMPT` 冲突。

## 凭据管理（2026-06-16）

**原则：** 所有密钥/URL 走 `wx.getStorageSync`，不进代码。当前三个 key：
- `thinkprism_apiKey` — DeepSeek API key
- `thinkprism_sbUrl` — Supabase URL
- `thinkprism_sbKey` — Supabase publishable key
