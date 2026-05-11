# LLM Prompt Queue - Chrome Extension

## Overview

Queue and automatically send multiple prompts to LLM chat interfaces. This extension allows you to prepare a list of prompts and have them sent sequentially to supported AI chat services, waiting for each response before sending the next prompt.

## Supported Sites

- **ChatGPT** (chat.openai.com, chatgpt.com)
- **Claude** (claude.ai)
- **Gemini** (gemini.google.com)
- **AI Studio** (aistudio.google.com)
- **Xiaomi MiMo Studio** (aistudio.xiaomimimo.com)

## Installation

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** using the toggle in the top-right corner
4. Click **Load unpacked**
5. Select the `prompt-queue-extension` folder
6. The extension icon should appear in your browser toolbar

### Generating Icons (Optional)

If icons are missing, you can regenerate them:

```bash
cd prompt-queue-extension
node generate-icons.js
```

## Usage

### Basic Workflow

1. Navigate to a supported LLM chat site (ChatGPT, Claude, Gemini, or AI Studio)
2. Click the extension icon in your browser toolbar to open the popup
3. Type or paste a prompt in the text area
4. Click **Add to Queue** (or press `Ctrl+Enter` / `Cmd+Enter`)
5. Repeat steps 3-4 to add multiple prompts
6. Enable the **Auto-send** toggle
7. Send your first prompt manually on the chat site
8. The extension will automatically send queued prompts after each response completes

### Queue Management

- **Add prompts**: Type in the text area and click "Add to Queue" or use keyboard shortcut
- **Remove prompts**: Click the X button on any queue item
- **Reorder prompts**: Use the up/down arrows to change prompt order
- **Clear all**: Click "Clear All" to remove all queued prompts

### Auto-send Mode

When auto-send is enabled:
- The extension monitors for when the LLM finishes generating a response
- Once complete, it automatically injects and sends the next prompt in the queue
- Processing continues until the queue is empty or auto-send is disabled

## Features

- **Queue Management**: Add, remove, and reorder prompts in your queue
- **Auto-send Mode**: Hands-free operation that automatically sends the next prompt after each response
- **Persistent Storage**: Queue and settings are saved locally and persist across browser sessions
- **Dark/Light Mode**: Automatically adapts to your system theme preference
- **Status Indicators**: Visual feedback showing connection status and processing state
- **Keyboard Shortcuts**: Quick add with `Ctrl/Cmd+Enter`
- **Cross-site Support**: Works across all 4 major LLM chat interfaces

## File Structure

```
prompt-queue-extension/
├── manifest.json              # Extension configuration
├── service-worker.js          # Background script (state management, coordination)
├── popup/
│   ├── popup.html             # Popup UI structure
│   ├── popup.css              # Popup styles (light/dark mode)
│   └── popup.js               # Popup logic and interactions
├── content-scripts/
│   ├── common.js              # Shared utilities for all sites
│   ├── chatgpt.js             # ChatGPT-specific integration
│   ├── claude.js              # Claude-specific integration
│   ├── gemini.js              # Gemini-specific integration
│   ├── aistudio.js            # AI Studio-specific integration
│   └── xiaomi-aistudio.js     # Xiaomi MiMo Studio-specific integration
├── utils/
│   └── storage.js             # Storage utility functions
├── images/
│   ├── icon-16.png            # Toolbar icon
│   ├── icon-48.png            # Extension management icon
│   └── icon-128.png           # Chrome Web Store icon
├── generate-icons.js          # Icon generation script
└── README.md                  # This file
```

## Troubleshooting

### Extension doesn't detect the site

- Refresh the page after installing the extension
- Make sure you're on a supported site (check the URL)
- Check that the extension is enabled in `chrome://extensions/`

### Prompts aren't being sent automatically

- Verify that the **Auto-send** toggle is enabled
- Check the status indicator in the popup - it should show "Connected to: [Site Name]"
- Make sure the chat input field is visible and accessible on the page
- Try refreshing the page

### Queue items not persisting

- Check that the extension has storage permissions
- Try disabling and re-enabling the extension

### Conflicts with other extensions

- Try disabling other extensions that interact with chat sites
- Some ad blockers or privacy extensions may interfere with the content scripts

### Input not detected on the page

- The site may have updated its UI - selectors might need updating
- Open browser DevTools (F12) and check the Console for error messages
- Report issues with specific error messages for faster resolution

## Technical Details

### Permissions Used

- `storage`: Save queue and settings locally
- `activeTab`: Interact with the current tab
- `scripting`: Inject content scripts into supported sites

### How It Works

1. **Content Scripts** are injected into supported LLM sites and handle:
   - Finding and interacting with input fields
   - Detecting when the LLM finishes generating responses
   - Injecting prompts and triggering submissions

2. **Service Worker** (background script) manages:
   - Queue state and processing coordination
   - Communication between popup and content scripts
   - Tab tracking and site detection

3. **Popup** provides the user interface for:
   - Adding and managing queue items
   - Toggling auto-send mode
   - Viewing connection and processing status

## Privacy

- **Local Storage Only**: All data is stored locally using Chrome's storage API
- **No External Servers**: No data is sent to external servers
- **No Analytics**: No usage tracking or analytics
- **No Account Required**: Works without any sign-up or authentication

## Known Limitations

- Each LLM site has different UI structures that may change over time
- Very long prompts may need extra time for proper injection
- Some sites may have rate limiting that affects rapid sequential prompts
- The extension must be reloaded if a site updates its interface significantly

## Development

### Building from Source

No build step required - the extension runs directly from source files.

### Testing

1. Load the extension in developer mode
2. Navigate to a supported site
3. Open the popup and add test prompts
4. Verify prompts are sent correctly

### Updating Selectors

If a site changes its UI, selectors in the respective content script (`content-scripts/[site].js`) may need updating. Each file contains a `SELECTORS` object with CSS selectors for:
- Input fields (textarea/contenteditable)
- Send/submit buttons
- Stop/cancel buttons
- Response containers
- Loading indicators

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test across all supported sites
5. Submit a pull request

## License

MIT License

## Support

For issues or feature requests, please open an issue on the project repository.
