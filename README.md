# LLM Prompt Queue

[English](#english) | [中文](#中文)

---

## 中文

Chrome 扩展：**LLM Prompt Queue**。在多个 AI 聊天网站中批量排队 prompt，并在每次回复完成后自动发送下一条。

### 支持的网站

| 平台 | 网址 |
|------|------|
| ChatGPT | chat.openai.com / chatgpt.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| Google AI Studio | aistudio.google.com |
| 小米 MiMo Studio | aistudio.xiaomimimo.com |
| DeepSeek | chat.deepseek.com |

### 安装

1. 克隆本仓库
2. 打开 Chrome → `chrome://extensions/`
3. 开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择本项目根目录

> 安装或更新扩展后，请**刷新**已打开的 LLM 页面。

### 使用方法

1. 打开支持的 LLM 网站
2. 点击扩展图标，在弹窗中添加 prompt（`Ctrl/Cmd + Enter` 快速添加）
3. 开启 **Auto-send**
4. 手动发送第一条，或等待当前回复结束
5. 扩展会自动依次发送队列中的 prompt

### 主要功能

- 队列增删、排序、清空
- Auto-send 自动串行发送
- 手动 **Send Next**（关闭 Auto-send 时可用）
- 本地持久化，无需账号
- 切换标签页后仍可在原 LLM 标签继续处理

### 常见问题

**提示 “Could not establish connection”**  
扩展重载后 content script 失效 → 刷新 LLM 页面后重试。

**Auto-send 不工作**  
确认弹窗显示 `Connected to: [Site Name]`，且 Auto-send 已开启。

**MiMo Studio 检测不准**  
扩展通过 `#message-list` 内回复操作栏（copy / refresh / 点赞）判断生成是否结束。

---

## English

### Overview

**LLM Prompt Queue** is a Chrome extension (Manifest V3) that queues multiple prompts and automatically sends them one by one to supported LLM chat interfaces, waiting for each response to finish before sending the next.

### Supported Sites

- **ChatGPT** — chat.openai.com, chatgpt.com
- **Claude** — claude.ai
- **Gemini** — gemini.google.com
- **Google AI Studio** — aistudio.google.com
- **Xiaomi MiMo Studio** — aistudio.xiaomimimo.com
- **DeepSeek** — chat.deepseek.com

### Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the repository root folder

> After installing or reloading the extension, **refresh** any open LLM tabs.

### Usage

1. Navigate to a supported LLM chat site
2. Open the extension popup and add prompts (`Ctrl/Cmd + Enter` to add quickly)
3. Enable **Auto-send**
4. Send the first prompt manually, or wait for an in-progress response to finish
5. The extension sends the remaining queue automatically

### Features

- Add, remove, reorder, and clear queued prompts
- **Auto-send** — hands-free sequential sending
- **Send Next** — manual one-at-a-time mode when auto-send is off
- Persistent local storage (no account required)
- Background processing — continues on the locked LLM tab even if you switch tabs

### Architecture

```
├── manifest.json           # Extension manifest (MV3)
├── service-worker.js       # Queue coordinator, tab tracking, message routing
├── popup/                  # Popup UI
├── content-scripts/
│   ├── common.js           # Shared DOM utilities & generation monitor
│   ├── chatgpt.js
│   ├── claude.js
│   ├── gemini.js
│   ├── aistudio.js
│   ├── xiaomi-aistudio.js  # MiMo-specific completion detection
│   └── deepseek.js
├── utils/storage.js
└── images/                 # Extension icons
```

### How It Works

1. **Popup** — manage the queue and toggle auto-send
2. **Service Worker** — coordinates state, locks a processing tab, sends prompts via messages
3. **Content Scripts** — inject text, click send, detect when generation completes

Generation completion is detected per-site (stop button, streaming indicators, response text changes). MiMo Studio additionally watches for the message action toolbar (`group/clip`) in `#message-list`.

### Troubleshooting

| Issue | Fix |
|-------|-----|
| "Could not establish connection" | Reload the extension, then refresh the LLM page |
| Auto-send not starting | Ensure popup shows "Connected to: …" and auto-send is on |
| Prompt skipped / queue stuck | Check DevTools console for `[PromptQueue]` logs |
| Site UI updated | Update selectors in `content-scripts/[site].js` |

### Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Persist queue and settings locally |
| `scripting` | Inject content scripts when missing (e.g. after reload) |
| `tabs` / `webNavigation` | Track LLM tabs and SPA navigation |
| `activeTab` | Interact with the current tab |

### Privacy

- All data stored locally via `chrome.storage.local`
- No external servers, analytics, or account required

### Development

No build step — load directly from source.

```bash
# Optional: regenerate icons if missing
node generate-icons.js
```

Debug in the service worker console:

```js
promptQueueDebug.getCurrentStatus()
```

### License

MIT License

### Support

Open an issue on [GitHub](https://github.com/cinebee111lagom/llm-prompt-queue/issues).
