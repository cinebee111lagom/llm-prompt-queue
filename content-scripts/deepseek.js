/**
 * LLM Prompt Queue - DeepSeek Content Script
 *
 * Handles prompt injection and submission for https://chat.deepseek.com/
 *
 * @version 1.0.0
 */

(function() {
  'use strict';

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

  const SITE_NAME = 'deepseek';

  const SELECTORS = {
    input: [
      'textarea[placeholder*="Message DeepSeek"]',
      'textarea[placeholder*="给 DeepSeek"]',
      'textarea[placeholder*="DeepSeek"]',
      'textarea:not([disabled])',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]'
    ],
    sendButton: [
      'button[aria-label*="Send"]',
      'button[aria-label*="发送"]',
      'button[title*="Send"]',
      'button[title*="发送"]',
      'button[type="submit"]'
    ],
    stopButton: [
      'button[aria-label*="Stop"]',
      'button[aria-label*="停止"]',
      'button[title*="Stop"]',
      'button[title*="停止"]'
    ],
    conversationArea: [
      'main',
      '#root',
      '[class*="chat"]',
      '[class*="conversation"]'
    ],
    responseContainer: [
      '[class*="markdown"]',
      '[class*="message"]',
      '[class*="answer"]',
      '[class*="response"]'
    ],
    streamingIndicator: [
      '[class*="typing"]',
      '[class*="streaming"]',
      '[class*="loading"]',
      '[class*="thinking"]',
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

  function elementTextForMatching(el) {
    return [
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.getAttribute('data-testid') || '',
      el.getAttribute('data-test-id') || '',
      el.textContent || ''
    ].join(' ').trim();
  }

  async function getInputElement() {
    const input = findElement(SELECTORS.input, { visible: true });
    if (input && !isDisabled(input)) return input;
    return waitForElement(SELECTORS.input, { timeout: 10000, visible: true });
  }

  function findSendButtonNearInput(input) {
    const containers = [
      input.closest('form'),
      input.closest('[class*="input"]'),
      input.closest('[class*="chat"]'),
      input.parentElement?.parentElement?.parentElement,
      input.parentElement?.parentElement,
      input.parentElement,
      document
    ].filter(Boolean);

    for (const container of containers) {
      const direct = findElement(SELECTORS.sendButton, {
        parent: container,
        visible: true
      });
      if (direct && !isDisabled(direct)) return direct;

      const candidates = Array.from(container.querySelectorAll('button'))
        .filter(btn => isElementVisible(btn) && !isDisabled(btn));

      const sendCandidates = candidates.filter(btn => {
        const text = elementTextForMatching(btn).toLowerCase();
        if (/stop|停止|upload|file|attach|new chat|新对话|search|think|login|登录|menu|settings/.test(text)) {
          return false;
        }

        const rect = btn.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        const closeToInput = Math.abs(rect.top - inputRect.top) < 180 ||
          Math.abs(rect.bottom - inputRect.bottom) < 180;
        const rightSide = rect.left >= inputRect.left;
        const iconLike = !!btn.querySelector('svg') || (btn.textContent || '').trim().length <= 6;

        return closeToInput && rightSide && iconLike;
      });

      if (sendCandidates.length > 0) {
        return sendCandidates[sendCandidates.length - 1];
      }
    }

    return null;
  }

  function findStopButton() {
    const direct = findElement(SELECTORS.stopButton, { visible: true });
    if (direct) return direct;

    return Array.from(document.querySelectorAll('button')).find(btn => {
      if (!isElementVisible(btn)) return false;
      const text = elementTextForMatching(btn).toLowerCase();
      return /stop|停止|中止|abort/.test(text);
    }) || null;
  }

  function getResponseText() {
    const nodes = [];
    for (const selector of SELECTORS.responseContainer) {
      nodes.push(...document.querySelectorAll(selector));
    }

    const visibleNodes = [...new Set(nodes)].filter(isElementVisible);
    if (visibleNodes.length > 0) {
      return visibleNodes.map(el => el.textContent || '').join('\n');
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

    const streaming = findElement(SELECTORS.streamingIndicator, { visible: true });
    if (streaming) {
      log.debug('isGenerating: streaming indicator found');
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
    log.info('Injecting prompt into DeepSeek');

    return retryDOMOperation(async () => {
      resetResponseTracking();

      const input = await getInputElement();
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

      await sleep(150);

      const injectedText = input.value || input.textContent || '';
      if (!injectedText.includes(text.substring(0, Math.min(20, text.length)))) {
        throw new Error('Prompt text verification failed');
      }

      log.info('Prompt injected successfully');
    }, {
      maxRetries: 3,
      baseDelay: 500,
      operationName: 'DeepSeek prompt injection'
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
      operationName: 'DeepSeek prompt submission'
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

          await sleep(1000);
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
    log.info('Initializing DeepSeek content script');
    window.PromptQueueCommon.currentSite = SITE_NAME;

    try {
      await waitForElement(SELECTORS.input, { timeout: 30000, visible: true });
      log.info('Input found');
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

    log.info('DeepSeek content script initialized');
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
