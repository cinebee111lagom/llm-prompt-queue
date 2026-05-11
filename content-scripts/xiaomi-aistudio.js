/**
 * LLM Prompt Queue - Xiaomi MiMo Studio Content Script
 *
 * Handles prompt injection and submission for https://aistudio.xiaomimimo.com/
 *
 * @version 1.0.0
 */

(function() {
  'use strict';

  const {
    waitForElement,
    clickButton,
    findElement,
    isElementVisible,
    sendToBackground,
    setupMessageListener,
    startGenerationMonitor,
    sleep,
    log
  } = window.PromptQueueCommon;

  const SITE_NAME = 'xiaomi_aistudio';

  const SELECTORS = {
    input: [
      'textarea[placeholder*="Ask me anything"]',
      'textarea[placeholder*="有问题"]',
      'textarea[placeholder*="输入"]',
      'textarea[placeholder*="Enter"]',
      'textarea[rows="1"]',
      'textarea:not([disabled])'
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
      '#root',
      '[class*="conversation"]',
      '[class*="message"]'
    ],
    responseContainer: [
      '[class*="markdown"]',
      '[class*="message"]',
      '[class*="assistant"]',
      '[data-message-author-role="assistant"]'
    ],
    loadingIndicator: [
      '[class*="loading"]',
      '[class*="generating"]',
      '[class*="spinner"]',
      '[aria-busy="true"]'
    ]
  };

  let lastResponseText = '';
  let responseChangeTimestamp = 0;

  function isDisabled(el) {
    return !el ||
      el.disabled ||
      el.getAttribute('aria-disabled') === 'true' ||
      el.classList.contains('disabled');
  }

  function getVisibleTextareas() {
    return Array.from(document.querySelectorAll('textarea'))
      .filter(el => isElementVisible(el) && !isDisabled(el));
  }

  async function getInputElement() {
    const preferred = findElement(SELECTORS.input, { visible: true });
    if (preferred && !isDisabled(preferred)) return preferred;

    const textareas = getVisibleTextareas();
    if (textareas.length > 0) {
      return textareas[textareas.length - 1];
    }

    return waitForElement(SELECTORS.input, { timeout: 10000, visible: true });
  }

  function findSendButtonNearInput(input) {
    const containers = [
      input.closest('form'),
      input.closest('[class*="input"]'),
      input.closest('[class*="composer"]'),
      input.parentElement?.parentElement?.parentElement,
      input.parentElement?.parentElement,
      input.parentElement,
      document
    ].filter(Boolean);

    for (const container of containers) {
      const selectorMatch = findElement(SELECTORS.sendButton, {
        parent: container,
        visible: true
      });
      if (selectorMatch && !isDisabled(selectorMatch)) return selectorMatch;

      const candidates = Array.from(container.querySelectorAll('button'))
        .filter(btn => isElementVisible(btn) && !isDisabled(btn));

      const iconButtons = candidates.filter(btn => {
        const label = [
          btn.getAttribute('aria-label') || '',
          btn.getAttribute('title') || '',
          btn.getAttribute('data-track-id') || '',
          btn.getAttribute('data-track-name') || '',
          btn.textContent || ''
        ].join(' ').toLowerCase();

        if (/upload|file|attach|camera|album|voice|record|search|model|cookie|agree|cancel/.test(label)) {
          return false;
        }

        const rect = btn.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        const closeToInput = Math.abs(rect.top - inputRect.top) < 180;
        const hasIcon = !!btn.querySelector('svg');
        const shortText = (btn.textContent || '').trim().length <= 8;
        const isRightOfInput = rect.left >= inputRect.left;

        return closeToInput && isRightOfInput && hasIcon && shortText;
      });

      if (iconButtons.length > 0) {
        return iconButtons[iconButtons.length - 1];
      }
    }

    return null;
  }

  async function getSendButton(input) {
    const button = findSendButtonNearInput(input || await getInputElement());
    if (button) return button;
    return waitForElement(SELECTORS.sendButton, { timeout: 5000, visible: true });
  }

  function findStopButton() {
    const direct = findElement(SELECTORS.stopButton, { visible: true });
    if (direct) return direct;

    return Array.from(document.querySelectorAll('button'))
      .find(btn => {
        if (!isElementVisible(btn)) return false;
        const text = [
          btn.getAttribute('aria-label') || '',
          btn.getAttribute('title') || '',
          btn.getAttribute('data-track-id') || '',
          btn.getAttribute('data-track-name') || '',
          btn.textContent || ''
        ].join(' ').toLowerCase();
        return /stop|abort|停止|中止|取消生成/.test(text);
      }) || null;
  }

  function getResponseText() {
    const containers = [];
    for (const selector of SELECTORS.responseContainer) {
      containers.push(...document.querySelectorAll(selector));
    }

    const unique = [...new Set(containers)].filter(isElementVisible);
    if (unique.length > 0) {
      return unique.map(el => el.textContent || '').join('\n');
    }

    const root = document.querySelector('main') || document.querySelector('#root') || document.body;
    return root ? root.textContent || '' : '';
  }

  function isGenerating() {
    const stopButton = findStopButton();
    if (stopButton && isElementVisible(stopButton)) {
      log.debug('isGenerating: stop button found');
      return true;
    }

    const loading = findElement(SELECTORS.loadingIndicator, { visible: true });
    if (loading) {
      log.debug('isGenerating: loading indicator found');
      return true;
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
    lastResponseText = getResponseText();
    responseChangeTimestamp = 0;
  }

  async function injectPrompt(text) {
    log.info('Injecting prompt into Xiaomi MiMo Studio');
    resetResponseTracking();

    const input = await getInputElement();
    input.focus();
    await sleep(100);

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, text);
    } else {
      input.value = text;
    }

    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Unidentified',
      bubbles: true,
      cancelable: true
    }));

    await sleep(200);
    log.info('Prompt injected successfully');
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
    const input = await getInputElement();

    let sendButton = null;
    for (let i = 0; i < 20; i++) {
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

          await sleep(1500);
          await sendToBackground('GENERATION_STARTED', { promptId: payload.id });

          startGenerationMonitor(isGenerating, {
            pollInterval: 1000,
            timeout: 300000,
            observeTarget: SELECTORS.conversationArea[0]
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
        startGenerationMonitor(isGenerating, {
          pollInterval: 1000,
          timeout: 300000,
          observeTarget: SELECTORS.conversationArea[0]
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
      log.info('Input textarea found');
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
