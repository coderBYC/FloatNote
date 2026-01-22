let currentMode = null;
const HIGHLIGHT_KEY = 'floatnote-highlight';
let highlightRanges = new Map()
let toolBarOn = false;

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

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'setMode' && message.mode === 'highlight') {
    enableSelectionMode();
  }
  
  if (message.action === 'scrollToHighlight' && message.position) {
    window.scrollTo({
      left: message.position.left - 50,
      top: message.position.top - 50,
      behavior: 'smooth'
    });
  }
});

async function loadHighlights(url) {
  const { highlights = [] } = await chrome.storage.local.get('highlights');
  return highlights.filter(h => h.url === url);
}

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

function enableSelectionMode() {
  if (!CSS?.highlights) {
    console.warn('CSS Highlight API not supported');
    return;
  }
  currentMode = 'highlight';
  showIndicator('Highlight mode active');
  document.addEventListener('mouseup', handleTextSelection);
  setTimeout(() => {
    currentMode = null;
    document.removeEventListener('mouseup', handleTextSelection);
  }, 10000)
}

async function handleTextSelection() {
  if (currentMode !== 'highlight') return;

  setTimeout(async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const text = selection.toString().trim();
    if (!text) return;
    const range = selection.getRangeAt(0).cloneRange();
    if (range.collapsed) return;
    const highlight = CSS.highlights.get(HIGHLIGHT_KEY) || new Highlight();
    highlight.add(range);
    CSS.highlights.set(HIGHLIGHT_KEY, highlight);
    
    // Get the bounding rect of the range for scroll position
    const rangeRect = range.getBoundingClientRect();
    const scrollPosition = {
      left: rangeRect.left + window.scrollX,
      top: rangeRect.top + window.scrollY,
      width: rangeRect.width,
      height: rangeRect.height
    };
    console.log('Saving highlight with position:', scrollPosition);
    
    const rangeData = {
      id: 'highlight-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      // Start point
      startContainerPath: getNodePath(range.startContainer),
      startOffset: range.startOffset,
      startIsTextNode: range.startContainer.nodeType === 3,
      
      // End point  
      endContainerPath: getNodePath(range.endContainer),
      endOffset: range.endOffset,
      endIsTextNode: range.endContainer.nodeType === 3,
      
      // Metadata
      url: window.location.href,
      text: text,
      timestamp: new Date().toISOString(),
      position: scrollPosition,
      color: 'hsla(46, 100%, 51%, 0.454)'
    }
    highlightRanges.set(rangeData.id, range.cloneRange())
    const { highlights = [] } = await chrome.storage.local.get('highlights');
    highlights.push(rangeData);
    await chrome.storage.local.set({ highlights });
    chrome.runtime.sendMessage({ action: 'highlightAdded' }).catch(() => {
    });
    
    selection.removeAllRanges();
    currentMode = null;
    document.removeEventListener('mouseup', handleTextSelection);
  }, 50);
}
// Path Storage
function getNodePath(node) {
  if (node.nodeType === 3 ){
    const parent = node.parentNode;
    const parentPath = getElementPath(parent);
    const index = getTextNodeIndex(node, parent);
    return {
      type: 'text',
      parentPath: parentPath,
      index: index
    }
  } else {
    return {
      type: 'element',
      path: getElementPath(node)
    }
  }
}

function getElementPath(element){
  if (!element || element.nodeType !== 1) return;
  const parts = [];
  let node = element;
  while (node && node.nodeType === 1){
    let index = 1
    let sibling = node.previousSibling;
    while (sibling){
      if (sibling.nodeType === 1 && sibling.tagName === node.tagName){
        index++
      }
      sibling = sibling.previousSibling;
    }
    const tagName =  node.nodeName.toLowerCase();
    const xpathIndex = index  > 1 ? `[${index}]`: '';
    parts.unshift(`${tagName}${xpathIndex}`);
    node = node.parentNode;
  }
  return '/' + parts.join('/');
}

function getTextNodeIndex(textNode, parent){
  let index = 0;
  let child = parent.firstChild;
  while (child){
    if (child === textNode){
      return index;
    }
    if (child.nodeType === 3) index++;
    child = child.nextSibling;
  }
  return index;
}
// Restore the range from the path data
function getNodeFromPath(pathData) {
  if (!pathData) return null;
  
  if (pathData.type === 'text') {
    // Find parent element
    const parent = getNodeFromXPath(pathData.parentPath);
    if (!parent) return null;
    // Find the text node by index
    const textNodes = Array.from(parent.childNodes).filter(n => n.nodeType === 3);
    return textNodes[pathData.index] || null;
  } else {
    // It's an element node
    return getNodeFromXPath(pathData.path);
  }
}

function getNodeFromXPath(xpath) {
  if (!xpath) return null;
  
  try {
    const parts = xpath.split('/').filter(p => p);
    let node = document.documentElement;
    
    // Skip the first part if it matches the current node (html)
    let startIndex = 0;
    if (parts.length > 0) {
      const firstPart = parts[0].match(/^([a-z0-9_-]+)/i);
      if (firstPart && firstPart[1].toLowerCase() === node.nodeName.toLowerCase()) {
        startIndex = 1;
      }
    }
    
    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];
      const match = part.match(/^([a-z0-9_-]+)(?:\[(\d+)\])?$/i);
      if (!match) {
        console.warn(`XPath parsing failed at part: ${part}`);
        return null;
      }
      
      const tagName = match[1];
      const index = match[2] ? parseInt(match[2], 10) : 1;
      
      const children = Array.from(node.children || []).filter(child => 
        child.nodeName.toLowerCase() === tagName
      );
      
      if (index > children.length) {
        console.warn(`XPath index out of bounds: looking for ${tagName}[${index}] but only ${children.length} found at path: ${xpath.substring(0, xpath.indexOf(part))}`);
        return null;
      }
      
      node = children[index - 1];
      
      if (!node) {
        console.warn(`XPath node not found: ${tagName}[${index}] at path: ${xpath.substring(0, xpath.indexOf(part))}`);
        return null;
      }
    }
    return node;
  } catch (error) {
    console.error('Error parsing XPath:', error, 'Path:', xpath);
    return null;
  }
}

function recreateRange(rangeData) {
  const startContainer = getNodeFromPath(rangeData.startContainerPath);
  const endContainer = getNodeFromPath(rangeData.endContainerPath);
  if (!startContainer || !endContainer) return null;
  
  const range = document.createRange();
  range.setStart(startContainer, rangeData.startOffset);
  range.setEnd(endContainer, rangeData.endOffset);
  
  return range;
}

async function restoreHighlights(retryCount = 0){
  if (!CSS?.highlights) return;
  setUpHighlightClickDetection()
  try {
    const highlights = await loadHighlights(window.location.href);
    if (highlights.length === 0) return;
    
    const highlightObj = CSS.highlights.get(HIGHLIGHT_KEY) || new Highlight();
    let restoredCount = 0;
    let failedHighlights = [];
    
    for (const savedHighlight of highlights) {
      const range = recreateRange(savedHighlight);
      if (range) {
        highlightRanges.set(savedHighlight.id, range.cloneRange())
        highlightObj.add(range);
        restoredCount++;
      } else {
        failedHighlights.push(savedHighlight);
      }
    }
    
    CSS.highlights.set(HIGHLIGHT_KEY, highlightObj);
    console.log(CSS.highlights)
    console.log(`Highlights restored: ${restoredCount}/${highlights.length}`);
    
    // If some highlights failed and we haven't retried too many times, retry after a delay
    if (failedHighlights.length > 0 && retryCount < 5) {
      console.log(`Failed to restore ${failedHighlights.length} highlights, retrying... (attempt ${retryCount + 1})`);
      setTimeout(() => {
        // Retry only the failed highlights
        const retryHighlightObj = CSS.highlights.get(HIGHLIGHT_KEY) || new Highlight();
        let retryRestored = 0;
        const stillFailed = [];
        
        for (const savedHighlight of failedHighlights) {
          const range = recreateRange(savedHighlight);
          if (range) {
            retryHighlightObj.add(range);
            retryRestored++;
          } else {
            stillFailed.push(savedHighlight);
          }
        }
        
        CSS.highlights.set(HIGHLIGHT_KEY, retryHighlightObj);
        console.log(`Retry restored: ${retryRestored}/${failedHighlights.length}`);
        
        // Continue retrying if there are still failures
        if (stillFailed.length > 0 && retryCount < 4) {
          restoreHighlights(retryCount + 1);
        }
      }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s, 3s, 4s, 5s
    }
  } catch (error) {
    console.error('Error restoring highlights:', error);
  }
}
// Ensure FontAwesome is loaded
function ensureFontAwesomeLoaded() {
  if (!document.getElementById('floatnote-fontawesome-styles')) {
    const link = document.createElement('link');
    link.id = 'floatnote-fontawesome-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('fontawesome/css/all.min.css');
    document.head.appendChild(link);
  }
}

// Toolbar UI
function createHighlightToobar(){
  const toolbar = document.createElement('div');
  toolbar.className = 'highlight-toolbar';
  toolbar.style.display = 'none';
  
  // Color Palette Button
  const colorBtn = document.createElement('button')
  colorBtn.className = 'highlight-toolbar-btn color-btn'
  colorBtn.innerHTML = getPaletteIcon() // Default color, will be updated when shown
  colorBtn.title = 'Change Color'

  // Delete Button
  const deleteBtn = document.createElement('button')
  deleteBtn.className = 'highlight-toolbar-btn delete-btn'
  deleteBtn.innerHTML = getTrashIcon()
  deleteBtn.title = 'Delete Highlight'

  toolbar.appendChild(colorBtn)
  toolbar.appendChild(deleteBtn)
  document.body.appendChild(toolbar)

  return toolbar
}

function createColorPicker(){
  const picker = document.createElement('div');
  picker.id = 'highlight-color-picker';
  picker.className = 'highlight-color-picker';
  picker.style.display = 'none';

  const colors = [
    { name: 'Yellow', value: 'hsla(46, 100%, 50%, 0.544)' },
    { name: 'Green', value: 'hsla(120, 100%, 50%, 0.544)' },
    { name: 'Blue', value: 'hsla(210, 100%, 50%, 0.544)' },
    { name: 'Purple', value: 'hsla(270, 100%, 50%, 0.544)' },
    { name: 'Pink', value: 'hsla(330, 100%, 50%, 0.544)' },
    { name: 'Orange', value: 'hsla(30, 100%, 50%, 0.544)' }
  ]

  colors.forEach(color =>{
    const colorBtn = document.createElement('button');
    colorBtn.className = 'color-option';
    colorBtn.style.backgroundColor = color.value;
    colorBtn.title = color.name;
    colorBtn.dataset.color = color.value;
    picker.appendChild(colorBtn);
  })
  picker.addEventListener('click', (e) => {
    if (e.target.closest('.color-option')){
      const color = e.target.dataset.color;
      updateHighlightColor(highlightId, color);
      hideColorPicker();
      hideToolbar();
    }
  });
  document.body.appendChild(picker)
  return picker
  
}

function getPaletteIcon(color = 'hsla(46, 100%, 50%, 0.544)') {
  // Color box showing current highlight color, styled like color picker
  return `<div class="color-palette-box" style="
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 4px;
    background: ${color};
    display: block;
    box-sizing: border-box;
  "></div>`;
}

function getTrashIcon() {
  // Use FontAwesome icon
  return '<i class="fa-solid fa-trash-can"></i>';
}

function setUpHighlightClickDetection(){
  document.addEventListener('click', (e) =>{
    if (e.target.closest('.highlight-toolbar') ||
    e.target.closest('.highlight-color-picker')) return;

    if (currentMode === 'highlight') return;

    const clickedId = findHighlight(e.clientX, e.clientY)

    if (clickedId){
      e.preventDefault();
      e.stopPropagation();
      showToolbar(e.clientX, e.clientY, clickedId)
    } else{
      hideToolbar()
    }

  document.addEventListener('mousedown', (e)=>{
    if (!e.target.closest('.highlight-toolbar') &&
    !e.target.closest('.highlight-color-picker')){
      toolBarOn = false;
      hideToolbar()
    }
    })
  })
}

function findHighlight(x, y){
  const point = {x : x+ window.scrollX, y : y+ window.scrollY}
  for (const [id,range] of highlightRanges.entries()){
    if (PointInRange(point, range)){
      return id;
    }
  }
  return null;
}

function PointInRange(point, range){
  try {
  const rect = range.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return(
      point.x >= rect.left + scrollX &&
      point.x <= rect.right + scrollX &&
      point.y >= rect.top + scrollY &&
      point.y <= rect.bottom + scrollY 
  )} catch (e) {
     return false; 
  }

}

// Option 1: Check if toolbar exists before creating
async function showToolbar(x, y, highlightId){
  // Get current highlight color from storage
  const { highlights = [] } = await chrome.storage.local.get('highlights');
  const highlight = highlights.find(h => h.id === highlightId);
  const currentColor = highlight?.color || 'hsla(46, 100%, 50%, 0.544)';
  
  // Check if toolbar already exists
  let toolbar = document.querySelector('.highlight-toolbar');
  
  // Only create if it doesn't exist
  if (!toolbar) {
    toolbar = createHighlightToobar();
  }
  
  const colorBtn = document.querySelector('.color-btn');
  const deleteBtn = document.querySelector('.delete-btn');
  if (!colorBtn || !deleteBtn) return;
  
  // Update color box with current highlight color
  const colorBox = colorBtn.querySelector('.color-palette-box');
  if (colorBox) {
    colorBox.style.background = currentColor;
  } else {
    // If color box doesn't exist, recreate the button with current color
    colorBtn.innerHTML = getPaletteIcon(currentColor);
  }
  
  // Remove old event listeners to prevent duplicates
  const newColorBtn = colorBtn.cloneNode(true);
  const newDeleteBtn = deleteBtn.cloneNode(true);
  colorBtn.replaceWith(newColorBtn);
  deleteBtn.replaceWith(newDeleteBtn);
  
  newColorBtn.addEventListener('click', () => {
    const colorPicker = createColorPicker();
    colorPicker.style.display = 'flex';
    colorPicker.style.left = x + 'px';
    colorPicker.style.top = y + 'px';
  });
  
  newDeleteBtn.addEventListener('click', async(e) => {
    e.stopPropagation();
    await deleteHighlight(highlightId);
    hideColorPicker();
    hideToolbar();
  });
  
  toolbar.style.display = 'flex';
  toolbar.style.left = x + 'px';
  toolbar.style.top = y + 'px';
  toolbar.dataset.highlightId = highlightId;
}

function hideToolbar(){
  const toolbar = document.querySelector('.highlight-toolbar');
  if (toolbar) toolbar.style.display = 'none';
}

function hideColorPicker(){
  const picker = document.querySelector('#highlight-color-picker');
  if (picker) picker.style.display = 'none';
}

async function deleteHighlight(id){
  const highlightObj = CSS.highlights.get(id) || new Highlight();
  const range = highlightRanges.get(id);
  if (range) {
    highlightObj.delete(range);
    CSS.highlights.set(HIGHLIGHT_KEY, highlightObj)
  }
  const {highlights = []} = await chrome.storage.local.get('highlights');
  const filtered = highlights.filter(h => h.id != id);
  await chrome.storage.local.set({highlights: filtered});

  highlightRanges.delete(id)
  chrome.runtime.sendMessage({action: 'highlightAdded', id});
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ensureFontAwesomeLoaded();
    restoreHighlights();
  });
} else {
  ensureFontAwesomeLoaded();
  restoreHighlights();
}
