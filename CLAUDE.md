# 折光 ThinkPrism

微信小程序。把你的碎碎念折成你还没看见的自己。

## 仓库

https://github.com/wampeeHuang/thinkprism-miniapp

## 架构

| 页面 | 文件 | 功能 |
|------|------|------|
| record | pages/record/ | 主页：唱片长按录音 + 文字输入 + 日历 + 卡片展示 |
| shard | pages/shard/ | 每日卡片浏览，前后翻日，重新生成 |
| trace | pages/trace/ | 时间线，按全部/AI对话/自记过滤 |

双卡片系统：**拢**（总结） + **放**（折射），6 折射视角，DeepSeek API 生成。

## 凭据（全部走本地 storage，代码无硬编码）

```
wx.getStorageSync('thinkprism_apiKey')   // DeepSeek API key
wx.getStorageSync('thinkprism_sbUrl')    // Supabase URL
wx.getStorageSync('thinkprism_sbKey')    // Supabase publishable key
```

## 已知问题

- `icons/*.png` 二进制文件丢失，需微信开发者工具重新生成
- `pages/record/record.js` 有死代码：`onPlusTap` / `fromImage` / `fromFile` / `fromClipboard` / `fromChat`
- 语音转文字：需微信同声传译插件 `wx069ba97219f66d99`，开发环境不可用
- 无首次设置/配置页面，凭据需手动写入 storage

## 录音交互

长按唱片 2s → 开始录音 → 松手继续 → 再轻触停止。`_ignoreNextTap` 标记防止松手即停。

## 约定

- 会话交接日志见 `HANDOFF.md`
- 代码风格：var 声明，function 表达式，2 空格缩进
- 微信小程序 CommonJS（`module.exports` / `require`），非 ES module
