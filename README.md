# LLM Prompt Queue

<p align="center">
  <img src="https://img.shields.io/github/stars/cinebee111lagom/llm-prompt-queue?style=for-the-badge&logo=github" alt="GitHub stars">
  <img src="https://img.shields.io/github/forks/cinebee111lagom/llm-prompt-queue?style=for-the-badge&logo=github" alt="GitHub forks">
  <img src="https://img.shields.io/github/issues/cinebee111lagom/llm-prompt-queue?style=for-the-badge&logo=github" alt="GitHub issues">
  <img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="MIT License">
</p>

<p align="center">
  <strong>Queue prompts. Auto-send after each LLM response.</strong><br>
  在 ChatGPT、Claude、Gemini、AI Studio、MiMo Studio、DeepSeek 上批量排队并自动发送 prompt。
</p>

<p align="center">
  <a href="#install">安装 Install</a> ·
  <a href="#usage">用法 Usage</a> ·
  <a href="#faq">FAQ</a> ·
  <a href="https://github.com/cinebee111lagom/llm-prompt-queue/issues">反馈 Issues</a>
</p>

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

<a id="install"></a>

### Chrome 安装

> 本扩展目前通过**源码加载**安装。Chrome Web Store 版本筹备中。

#### 方式一：Git 克隆（推荐）

```bash
git clone https://github.com/cinebee111lagom/llm-prompt-queue.git
cd llm-prompt-queue
```

#### 方式二：下载 ZIP

1. 打开 [GitHub 仓库](https://github.com/cinebee111lagom/llm-prompt-queue)
2. 点击 **Code → Download ZIP**
3. 解压到本地目录

#### 加载到 Chrome

1. 打开 Chrome，地址栏输入 `chrome://extensions/` 并回车
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目根目录（包含 `manifest.json` 的文件夹）
5. 扩展出现在列表中后，点击工具栏 **拼图图标** → 固定 **LLM Prompt Queue**

#### 安装后检查

- 扩展卡片显示 **LLM Prompt Queue**，版本 `1.0.0`
- 打开任意支持的 LLM 网站，点击扩展图标
- 弹窗应显示 `Connected to: [Site Name]`

#### 更新扩展

```bash
cd llm-prompt-queue
git pull
```

然后在 `chrome://extensions/` 点击该扩展的 **刷新** 按钮，并**刷新**已打开的 LLM 页面。

> 安装或更新扩展后，请**刷新**已打开的 LLM 页面，否则可能出现连接错误。

<a id="usage"></a>

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

<a id="faq"></a>

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

### Install in Chrome

> Currently installed by **loading unpacked source**. Chrome Web Store listing coming soon.

#### Option A: Clone with Git (recommended)

```bash
git clone https://github.com/cinebee111lagom/llm-prompt-queue.git
cd llm-prompt-queue
```

#### Option B: Download ZIP

1. Go to the [GitHub repository](https://github.com/cinebee111lagom/llm-prompt-queue)
2. Click **Code → Download ZIP**
3. Extract to a local folder

#### Load into Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the project root folder (the one containing `manifest.json`)
5. Pin **LLM Prompt Queue** from the extensions menu (puzzle icon in the toolbar)

#### Verify installation

- Extension card shows **LLM Prompt Queue**, version `1.0.0`
- Open a supported LLM site and click the extension icon
- Popup should display `Connected to: [Site Name]`

#### Update the extension

```bash
cd llm-prompt-queue
git pull
```

Then click **Reload** on the extension card at `chrome://extensions/`, and **refresh** any open LLM tabs.

> After installing or reloading the extension, **refresh** any open LLM tabs to avoid connection errors.

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
