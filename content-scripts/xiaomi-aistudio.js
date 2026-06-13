/**
 * LLM Prompt Queue - Xiaomi MiMo Studio Content Script
 *
 * Handles prompt injection and submission for https://aistudio.xiaomimimo.com/
 *
 * @version 1.0.3
 */

(function() {
  'use strict';

  if (window.__PromptQueue_xiaomi_aistudio_init) {
    return;
  }
  window.__PromptQueue_xiaomi_aistudio_init = true;

  const {
    waitForElement,
    simulateInput,
    clickButton,
    findElement,
    isElementVisible,
    sendToBackground,
    setupMessageListener,
    startGenerationMonitor,
    sleep,
    retryDOMOperation,
    log
  } = window.PromptQueueCommon;

  const SITE_NAME = 'xiaomi_aistudio';

  const SELECTORS = {
    input: [
      'textarea[placeholder*="Ask me anything"]',
      'textarea[placeholder*="Shift+Enter"]',
      'textarea[placeholder*="有问题"]',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="Enter"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ],
    sendButton: [
      'button[data-track-id*="send"]',
      'button[data-track-name*="send"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      'button[type="submit"]'
    ],
    stopButton: [
      'button[aria-label*="Stop"]',
      'button[aria-label*="停止"]',
      'button[aria-label*="Abort"]',
      'button[data-track-id*="stop"]',
      'button[data-track-name*="stop"]'
    ],
    conversationArea: [
      'main',
      '[class*="chat-panel"]',
      '[class*="conversation"]'
    ],
    responseContainer: [
      '[class*="markdown"]',
      '[class*="assistant"]',
      '[data-message-author-role="assistant"]',
      '[class*="message-content"]',
      '[class*="answer"]'
    ],
    loadingIndicator: [
      '[class*="typing"]',
      '[class*="streaming"]',
      '[class*="generating"]',
      '[class*="spinner"]',
      '[aria-busy="true"]'
    ],
    messageList: '#message-list',
    messageActionToolbar: '[class*="group/clip"]',
    dialogueContainer: '.dialogue-container'
  };

  const SIDEBAR_EXCLUDE_PATTERN = /upload|file|attach|add|plus|voice|record|search|model|new chat|history|menu|settings|sidebar|claw|trial|cookie|agree|cancel|miMo chat|mimo chat/i;

  let lastResponseText = '';
  let responseChangeTimestamp = 0;
  let chatPanelRoot = null;

  /** Tracks message action toolbars to detect MiMo-specific completion */
  let generationWatch = {
    startedAt: 0,
    baselineToolbarCount: 0,
    expectedToolbarCount: 0,
    sawStopButton: false
  };

  function isDisabled(el) {
    return !el ||
      el.disabled ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.classList.contains('disabled');
  }

  function elementLabel(el) {
    return [
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.getAttribute('data-track-id') || '',
      el.getAttribute('data-track-name') || '',
      el.textContent || ''
    ].join(' ').trim();
  }

  function isInSidebar(el) {
    if (!el) return false;

    if (el.closest('aside, nav, [class*="sidebar"], [class*="SideBar"], [class*="side-bar"]')) {
      return true;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    // MiMo Studio sidebar is a fixed-width left column.
    return rect.right <= 320 && rect.width <= 320;
  }

  function getComposerRoot(input) {
    const target = input || findChatInput();
    if (!target) return null;

    return target.closest(SELECTORS.dialogueContainer) ||
      target.closest('form') ||
      target.closest('[class*="composer"]') ||
      target.closest('[class*="input-area"]') ||
      target.closest('[class*="prompt"]') ||
      target.parentElement?.parentElement?.parentElement ||
      target.parentElement?.parentElement ||
      target.parentElement;
  }

  function getMessageListRoot() {
    return document.querySelector(SELECTORS.messageList);
  }

  /**
   * MiMo renders copy/refresh/feedback icons in a group/clip toolbar
   * when an assistant message finishes streaming.
   */
  function isMessageActionToolbar(el) {
    if (!el || !isElementVisible(el)) return false;

    const className = String(el.className || '');
    if (!className.includes('group/clip')) return false;

    const actions = el.querySelectorAll('button, [role="button"]');
    return actions.length >= 2;
  }

  function getMessageActionToolbars() {
    const root = getMessageListRoot();
    if (!root) return [];

    return Array.from(root.querySelectorAll(SELECTORS.messageActionToolbar))
      .filter(isMessageActionToolbar);
  }

  function countCompletedMessages() {
    return getMessageActionToolbars().length;
  }

  function beginResponseWatch() {
    const baseline = countCompletedMessages();
    generationWatch = {
      startedAt: Date.now(),
      baselineToolbarCount: baseline,
      expectedToolbarCount: baseline + 1,
      sawStopButton: false
    };
    log.debug('Response watch started', generationWatch);
  }

  function hasNewCompletedMessage() {
    if (!generationWatch.startedAt) return false;
    return countCompletedMessages() >= generationWatch.expectedToolbarCount;
  }

  function isResponseComplete() {
    if (!generationWatch.startedAt) return false;

    const elapsed = Date.now() - generationWatch.startedAt;
    if (elapsed < 800) return false;

    if (!hasNewCompletedMessage()) return false;

    // Require evidence that generation actually ran
    return generationWatch.sawStopButton || elapsed >= 2000;
  }

  function getMonitorTarget() {
    return getMessageListRoot() ? SELECTORS.messageList : SELECTORS.conversationArea[0];
  }

  function resolveChatPanel(input) {
    const target = input || findChatInput();
    if (!target) return chatPanelRoot;

    let node = target.parentElement;
    let best = null;

    for (let depth = 0; depth < 14 && node; depth++) {
      if (isInSidebar(node)) {
        node = node.parentElement;
        continue;
      }

      const rect = node.getBoundingClientRect();
      const containsComposer = node.contains(target);
      const wideEnough = rect.width >= 420;
      const notFullAppShell = rect.width < window.innerWidth * 0.95 || rect.left > 120;

      if (containsComposer && wideEnough && notFullAppShell) {
        best = node;
      }

      node = node.parentElement;
    }

    chatPanelRoot = best ||
      target.closest('main') ||
      document.querySelector('main') ||
      getComposerRoot(target)?.parentElement ||
      null;

    return chatPanelRoot;
  }

  function findChatInput() {
    const preferred = findElement(SELECTORS.input, { visible: true });
    if (preferred && !isDisabled(preferred) && !isInSidebar(preferred)) {
      return preferred;
    }

    const candidates = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"]'))
      .filter(el => isElementVisible(el) && !isDisabled(el) && !isInSidebar(el));

    const placeholderMatch = candidates.find(el => {
      const placeholder = el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || '';
      return /ask me anything|shift\+enter|有问题|输入/i.test(placeholder);
    });
    if (placeholderMatch) return placeholderMatch;

    if (candidates.length === 0) return null;

    // Composer input sits at the bottom of the main chat column.
    return candidates.sort((a, b) =>
      b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom
    )[0];
  }

  async function getInputElement() {
    const input = findChatInput();
    if (input) return input;

    return waitForElement(SELECTORS.input, {
      timeout: 10000,
      visible: true,
      parent: resolveChatPanel() || document
    });
  }

  function findSendButtonNearInput(input) {
    const composer = getComposerRoot(input);
    const containers = [
      composer,
      resolveChatPanel(input),
      input.parentElement?.parentElement?.parentElement,
      input.parentElement?.parentElement,
      input.parentElement
    ].filter(Boolean);

    const inputRect = input.getBoundingClientRect();

    for (const container of containers) {
      const selectorMatch = findElement(SELECTORS.sendButton, {
        parent: container,
        visible: true
      });
      if (selectorMatch && !isDisabled(selectorMatch) && !isInSidebar(selectorMatch)) {
        return selectorMatch;
      }

      const candidates = Array.from(container.querySelectorAll('button'))
        .filter(btn => isElementVisible(btn) && !isDisabled(btn) && !isInSidebar(btn));

      const sendCandidates = candidates.filter(btn => {
        const label = elementLabel(btn).toLowerCase();
        if (SIDEBAR_EXCLUDE_PATTERN.test(label)) return false;
        if (/stop|abort|停止|中止/.test(label)) return false;

        const rect = btn.getBoundingClientRect();
        const nearComposer = Math.abs(rect.bottom - inputRect.bottom) < 96 &&
          rect.top >= inputRect.top - 48;
        const onRightSide = rect.left >= inputRect.left + Math.min(120, inputRect.width * 0.25);
        const hasIcon = !!btn.querySelector('svg');
        const compact = (btn.textContent || '').trim().length <= 8;

        return nearComposer && onRightSide && hasIcon && compact;
      });

      if (sendCandidates.length > 0) {
        return sendCandidates.sort((a, b) =>
          b.getBoundingClientRect().left - a.getBoundingClientRect().left
        )[0];
      }
    }

    return null;
  }

  function findStopButton() {
    const panel = resolveChatPanel();
    const searchRoot = panel || document;

    for (const selector of SELECTORS.stopButton) {
      const matches = searchRoot.querySelectorAll(selector);
      for (const btn of matches) {
        if (isElementVisible(btn) && !isDisabled(btn) && !isInSidebar(btn)) {
          return btn;
        }
      }
    }

    return Array.from(searchRoot.querySelectorAll('button')).find(btn => {
      if (!isElementVisible(btn) || isInSidebar(btn)) return false;
      const text = elementLabel(btn).toLowerCase();
      return /stop|abort|停止|中止|取消生成/.test(text);
    }) || null;
  }

  function getResponseText() {
    const panel = resolveChatPanel();
    if (!panel) return '';

    const composer = getComposerRoot();
    const nodes = [];

    for (const selector of SELECTORS.responseContainer) {
      panel.querySelectorAll(selector).forEach(el => {
        if (isElementVisible(el) && !isInSidebar(el) && (!composer || !composer.contains(el))) {
          nodes.push(el);
        }
      });
    }

    const unique = [...new Set(nodes)];
    if (unique.length > 0) {
      return unique.map(el => el.textContent || '').join('\n').trim();
    }

    // Landing page: only track the main content above the composer, not sidebar history.
    if (composer) {
      const clone = panel.cloneNode(true);
      const composerClone = clone.querySelector('textarea, div[contenteditable="true"]');
      composerClone?.closest('form')?.remove();
      composerClone?.parentElement?.parentElement?.remove();
      return (clone.textContent || '').trim();
    }

    return '';
  }

  function isGenerating() {
    const stopButton = findStopButton();
    if (stopButton && isElementVisible(stopButton)) {
      generationWatch.sawStopButton = true;
      log.debug('isGenerating: stop button found');
      return true;
    }

    const panel = resolveChatPanel();
    if (panel) {
      for (const selector of SELECTORS.loadingIndicator) {
        const matches = panel.querySelectorAll(selector);
        for (const indicator of matches) {
          if (isElementVisible(indicator) && !isInSidebar(indicator)) {
            log.debug('isGenerating: loading indicator found');
            return true;
          }
        }
      }
    }

    // MiMo-specific: action toolbar (copy/refresh/feedback) appears when done
    if (isResponseComplete()) {
      log.debug('isGenerating: message action toolbar detected - complete');
      return false;
    }

    const currentText = getResponseText();
    const now = Date.now();

    if (currentText && currentText !== lastResponseText) {
      lastResponseText = currentText;
      responseChangeTimestamp = now;
      log.debug('isGenerating: response text changed');
      return true;
    }

    if (responseChangeTimestamp > 0 && (now - responseChangeTimestamp) < 2500) {
      return true;
    }

    return false;
  }

  function resetResponseTracking() {
    chatPanelRoot = null;
    lastResponseText = getResponseText();
    responseChangeTimestamp = 0;
    generationWatch = {
      startedAt: 0,
      baselineToolbarCount: 0,
      expectedToolbarCount: 0,
      sawStopButton: false
    };
  }

  async function injectPrompt(text) {
    log.info('Injecting prompt into Xiaomi MiMo Studio');

    return retryDOMOperation(async () => {
      resetResponseTracking();

      const input = await getInputElement();
      if (!input) {
        throw new Error('MiMo Studio input element not found');
      }

      resolveChatPanel(input);
      input.focus();
      await sleep(80);

      simulateInput(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Unidentified',
        bubbles: true,
        cancelable: true
      }));

      await sleep(180);

      const injectedText = input.value || input.textContent || '';
      if (!injectedText.includes(text.substring(0, Math.min(20, text.length)))) {
        throw new Error('Prompt text verification failed');
      }

      log.info('Prompt injected successfully');
    }, {
      maxRetries: 3,
      baseDelay: 500,
      operationName: 'MiMo Studio prompt injection'
    });
  }

  function submitWithEnter(input) {
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
    input.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));
  }

  async function submitPrompt() {
    log.info('Submitting prompt');

    return retryDOMOperation(async () => {
      const input = await getInputElement();
      let sendButton = null;

      for (let i = 0; i < 30; i++) {
        sendButton = findSendButtonNearInput(input);
        if (sendButton && !isDisabled(sendButton)) break;
        await sleep(100);
      }

      if (sendButton && !isDisabled(sendButton)) {
        const clicked = clickButton(sendButton);
        if (clicked) {
          log.info('Prompt submitted via send button');
          return true;
        }
      }

      submitWithEnter(input);
      log.info('Prompt submitted via Enter key fallback');
      return true;
    }, {
      maxRetries: 3,
      baseDelay: 500,
      operationName: 'MiMo Studio prompt submission'
    });
  }

  async function handleMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case 'INJECT_PROMPT': {
        if (window.PromptQueueCommon.isProcessing) {
          return { error: 'Already processing a prompt' };
        }

        window.PromptQueueCommon.isProcessing = true;

        try {
          await injectPrompt(payload.prompt);
          const submitted = await submitPrompt();

          if (!submitted) {
            window.PromptQueueCommon.isProcessing = false;
            return { error: 'Failed to submit prompt' };
          }

          beginResponseWatch();

          await sleep(800);
          await sendToBackground('GENERATION_STARTED', { promptId: payload.id });

          startGenerationMonitor(isGenerating, {
            pollInterval: 500,
            timeout: 300000,
            minWaitTime: 1500,
            requiredIdleChecks: 2,
            observeTarget: getMonitorTarget()
          });

          return { submitted: true };
        } catch (error) {
          window.PromptQueueCommon.isProcessing = false;
          log.error('Error handling INJECT_PROMPT:', error);
          throw error;
        }
      }

      case 'CHECK_STATUS':
        return {
          isGenerating: isGenerating(),
          isProcessing: window.PromptQueueCommon.isProcessing,
          site: SITE_NAME
        };

      case 'STOP_GENERATION': {
        const stopButton = findStopButton();
        if (stopButton) {
          clickButton(stopButton);
          return { stopped: true };
        }
        return { stopped: false, error: 'Stop button not found' };
      }

      case 'START_MONITORING':
        window.PromptQueueCommon.isProcessing = true;
        resetResponseTracking();
        beginResponseWatch();
        startGenerationMonitor(isGenerating, {
          pollInterval: 500,
          timeout: 300000,
          minWaitTime: 1500,
          requiredIdleChecks: 2,
          observeTarget: getMonitorTarget()
        });
        return { monitoring: true };

      default:
        return { error: `Unknown message type: ${type}` };
    }
  }

  async function initialize() {
    log.info('Initializing Xiaomi MiMo Studio content script');
    window.PromptQueueCommon.currentSite = SITE_NAME;

    try {
      await waitForElement(SELECTORS.input, { timeout: 30000, visible: true });
      resolveChatPanel(findChatInput());
      log.info('Input element found');
    } catch (error) {
      log.warn('Input not found during initialization, page may still be loading');
    }

    setupMessageListener(handleMessage);

    try {
      await window.PromptQueueCommon.sendSiteReady(SITE_NAME);
      log.info('Site ready notification sent');
    } catch (error) {
      log.error('Failed to send SITE_READY:', error);
    }

    log.info('Xiaomi MiMo Studio content script initialized');
  }

  const originalSendToBackground = sendToBackground;
  window.PromptQueueCommon.sendToBackground = async function(type, data) {
    if (type === 'GENERATION_COMPLETE') {
      window.PromptQueueCommon.isProcessing = false;
      log.debug('Processing state reset after generation complete');
    }
    return originalSendToBackground(type, data);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
