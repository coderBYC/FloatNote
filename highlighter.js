/*************************************************
 * GLOBAL STATE
 *************************************************/
let currentMode = null;
const HIGHLIGHT_KEY = 'floatnote-highlight';

/*************************************************
 * KEYBOARD SHORTCUT
 *************************************************/
document.addEventListener('keydown', (e) => {
  const target = e.target;

  // Ignore typing contexts
  if (
    target.closest('.floatnote-note') ||
    target.closest('#text-input') ||
    target.closest('.floatnote-view-text') ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) return;

  // Ctrl/Cmd + H
  if ((e.ctrlKey || e.metaKey) && e.key === 'h' && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    enableSelectionMode();
  }

  // Escape cancels
  if (e.key === 'Escape' && currentMode === 'highlight') {
    currentMode = null;
    document.removeEventListener('mouseup', handleTextSelection);
  }
});

/*************************************************
 * MESSAGE FROM BACKGROUND / POPUP
 *************************************************/
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'setMode' && message.mode === 'highlight') {
    enableSelectionMode();
  }
});

/*************************************************
 * STORAGE
 *************************************************/
async function saveHighlight(data) {
  const id = `highlight_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const highlight = { id, type: 'highlight', ...data };

  const { highlights = [] } = await chrome.storage.local.get('highlights');
  highlights.push(highlight);
  await chrome.storage.local.set({ highlights });

  chrome.runtime.sendMessage({ action: 'saveNote', note: highlight }).catch(() => {});
}

async function loadHighlights(url) {
  const { highlights = [] } = await chrome.storage.local.get('highlights');
  return highlights.filter(h => h.url === url);
}

/*************************************************
 * XPATH HELPERS
 *************************************************/
function getXPath(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return getXPath(node.parentNode) + '/text()';
  }
  if (node === document.body) return '/body';

  const index = [...node.parentNode.children].indexOf(node) + 1;
  return getXPath(node.parentNode) + '/' + node.tagName.toLowerCase() + '[' + index + ']';
}

function getNodeByXPath(xpath) {
  return document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
}

/*************************************************
 * UI INDICATOR
 *************************************************/
function showIndicator(text) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.cssText = `
    position: fixed;
      top: 20px;
      right: 20px;
      background:rgb(89, 174, 92);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 100000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      pointer-events: none;
      font-weight: bold;
      box-shadow: 2px 2px 0 #000;
      border: 2px solid #000 !important;
  `;
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transition = 'opacity 0.3s';
    setTimeout(() => div.remove(), 300);
  }, 1500);
}

/*************************************************
 * SELECTION MODE
 *************************************************/
function enableSelectionMode() {
  if (!CSS?.highlights) {
    console.warn('CSS Highlight API not supported');
    return;
  }

  currentMode = 'highlight';
  showIndicator('Highlight mode active');
  document.addEventListener('mouseup', handleTextSelection);
}

/*************************************************
 * CREATE HIGHLIGHT
 *************************************************/
async function handleTextSelection() {
  if (currentMode !== 'highlight') return;

  setTimeout(async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0).cloneRange();

    const highlight =
      CSS.highlights.get(HIGHLIGHT_KEY) || new Highlight();

    highlight.add(range);
    CSS.highlights.set(HIGHLIGHT_KEY, highlight);

    await saveHighlight({
      text,
      url: location.href,
      startXPath: getXPath(range.startContainer),
      startOffset: range.startOffset,
      endXPath: getXPath(range.endContainer),
      endOffset: range.endOffset,
      timestamp: new Date().toISOString()
    });

    selection.removeAllRanges();
    currentMode = null;
    document.removeEventListener('mouseup', handleTextSelection);
  }, 50);
}

/*************************************************
 * RESTORE HIGHLIGHTS ON PAGE LOAD
 *************************************************/
async function restoreHighlights() {
  if (!CSS?.highlights) return;

  const saved = await loadHighlights(location.href);
  if (!saved.length) return;

  const highlight = new Highlight();

  for (const h of saved) {
    try {
      const startNode = getNodeByXPath(h.startXPath);
      const endNode = getNodeByXPath(h.endXPath);
      if (!startNode || !endNode) continue;

      const range = document.createRange();
      range.setStart(startNode, h.startOffset);
      range.setEnd(endNode, h.endOffset);

      highlight.add(range);
    } catch (e) {
      console.warn('Failed to restore highlight', h.id);
    }
  }

  CSS.highlights.set(HIGHLIGHT_KEY, highlight);
}

/*************************************************
 * INIT
 *************************************************/
document.addEventListener('DOMContentLoaded', restoreHighlights);

