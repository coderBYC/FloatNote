let noteTemplate = null;
document.addEventListener('keydown', (e) => {
  // Check for Ctrl+N (Windows/Linux) or Cmd+N (Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    currentMode = 'note';
    createNote();
    const indicator = document.createElement('div');
    indicator.textContent = 'Note mode active';
    indicator.style.cssText = `
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
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transition = 'opacity 0.3s';
      setTimeout(() => indicator.remove(), 300); 
    }, 2000);
  }
});


chrome.runtime.onMessage.addListener(async(message, sender, sendResponse) => {
  // Listen to message FROM popup.js
  if (message.action === 'setMode' && message.mode === 'note') {
    createNote();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadNotesForCurrentPage);
} else {
  loadNotesForCurrentPage();
}

chrome.runtime.onMessage.addListener(message =>{
  if (message.action === 'scrollToNote' && message.position){
    window.scrollTo({
      left: message.position.left - 50,
      top: message.position.top - 50, 
      behavior: 'smooth'
    })
  }
})
async function loadNotesForCurrentPage() {
  try {
    console.log('Loading notes for current page');
    const currentUrl = window.location.href;
    const response = await chrome.runtime.sendMessage({ action: 'getNotesByUrl', url: currentUrl });
    if (response && response.notes) {
      const notes = response.notes;
      for (const noteData of notes) {
        if (noteData.type === 'note') {
            await restoreNote(noteData);
        }
      }
    } else {
      console.error('Failed to get notes by URL from background:', response?.error);
    }
  } catch (error) {
    console.error('Error sending getNotesByUrl message to background:', error);
  }
}

// Create a new note
async function createNote(){
  const noteDiv = await createNoteElement(); // Cloned note.html container
  if (!noteDiv) {
    console.error('Could not create note element');
    return;
  }
  noteDiv.classList.add('floatnote-note');
  
  const noteId = 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  noteDiv.dataset.noteId = noteId;  
  noteDiv._viewStatus = false;
  noteDiv.style.position = 'absolute';
  const docCenterX = window.scrollX + (document.documentElement.clientWidth / 2) - (noteDiv.offsetWidth / 2);
  const docCenterY = window.scrollY + (document.documentElement.clientHeight / 2) - (noteDiv.offsetHeight / 2);
  noteDiv.style.left = docCenterX + 'px';
  noteDiv.style.top = docCenterY + 'px';
  document.body.appendChild(noteDiv);
  saveNoteToDB(noteDiv)
  setupTextEditorButtons(noteDiv);
  setupNoteControls(noteDiv);
  console.log('Creating new note with ID:', noteId);
  makeNoteDraggable(noteDiv);
  makeNoteResizable(noteDiv);
}

async function createNoteElement() {
  if (!noteTemplate) {
    try {
      // Load FontAwesome CSS from extension and fix font paths
      if (!document.getElementById('floatnote-fontawesome-styles')) {
        try {
          const response = await fetch(chrome.runtime.getURL('fontawesome/css/all.min.css'));
          let cssText = await response.text();
          
          // Replace relative font paths with absolute chrome.runtime.getURL paths
          cssText = cssText.replace(/url\(\.\.\/webfonts\//g, `url(${chrome.runtime.getURL('fontawesome/webfonts/')}`);
          
          const style = document.createElement('style');
          style.id = 'floatnote-fontawesome-styles';
          style.textContent = cssText;
          document.head.appendChild(style);
        } catch (e) {
          console.error('Error loading FontAwesome:', e);
        }
      }
      
      if (!document.getElementById('floatnote-note-styles')) {
        try {
    const response = await fetch(chrome.runtime.getURL('note.css'));
    const cssText = await response.text();
    const style = document.createElement('style');
    style.id = 'floatnote-note-styles';
    style.textContent = cssText;
    document.head.appendChild(style);
  } catch (e) {
    console.error('Error loading note styles:', e);
  }
}
      const response = await fetch(chrome.runtime.getURL('note.html'));
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const container = doc.querySelector('.container');
      noteTemplate = container;
      if (!container) {
        console.error('Could not find .container in note.html');
        return null;
      }
    } catch (e) {
      console.error('Error loading note template:', e);
      return null;
    }
  }
  return noteTemplate.cloneNode(true);
}

// Create a new note and modify it to original note
async function restoreNote(noteData) {
  const noteDiv = await createNoteElement();
  if (!noteDiv){
    console.error('Could not create note element');
    return;
  }
  noteDiv.classList.add('floatnote-note');
  noteDiv.dataset.noteId = noteData.id;
  
  // Restore position and size
  if (noteData.position) {
  noteDiv.style.position = 'absolute';
    noteDiv.style.left = noteData.position.left + 'px';
    noteDiv.style.top = noteData.position.top + 'px';
    noteDiv.style.width = noteData.position.width + 'px';
    noteDiv.style.height = noteData.position.height + 'px';
    noteDiv.style.transform = 'none';
  }
  
  // Get text input element
  const textInput = noteDiv.querySelector('#text-input');
  if (!textInput) {
    console.error('Could not find text-input element');
    return;
  }
  
  // Restore content
  if (noteData.noteText) {
    textInput.innerHTML = noteData.noteText;
  }
  
  // Restore styles to textInput (not noteDiv)
  if (noteData.styles) {
    if (noteData.styles.backgroundColor) textInput.style.backgroundColor = noteData.styles.backgroundColor;
    if (noteData.styles.color) textInput.style.color = noteData.styles.color;
    if (noteData.styles.fontSize) textInput.style.fontSize = noteData.styles.fontSize;
    if (noteData.styles.fontFamily) textInput.style.fontFamily = noteData.styles.fontFamily;
    if (noteData.styles.lineHeight) textInput.style.lineHeight = noteData.styles.lineHeight;
    if (noteData.styles.letterSpacing) textInput.style.letterSpacing = noteData.styles.letterSpacing;
    if (noteData.styles.wordSpacing) textInput.style.wordSpacing = noteData.styles.wordSpacing;
    if (noteData.styles.border) textInput.style.border = noteData.styles.border;
    if (noteData.styles.padding) textInput.style.padding = noteData.styles.padding;
    if (noteData.styles.margin) textInput.style.margin = noteData.styles.margin;
    if (noteData.styles.marginTop) textInput.style.marginTop = noteData.styles.marginTop;
  }
  
  // Append to DOM first (needed for layout calculations)
  document.body.appendChild(noteDiv);
  
  // Setup controls
  setupTextEditorButtons(noteDiv);
  
  // Set color picker values to match restored styles
  const backColor = noteDiv.querySelector('#backColor');
  const foreColor = noteDiv.querySelector('#foreColor');
  if (backColor && noteData.styles?.backgroundColor) {
    // Convert rgb/rgba to hex if needed, or use the value directly if already hex
    const bgColor = noteData.styles.backgroundColor;
    if (bgColor.startsWith('rgb')) {
      // Convert rgb/rgba to hex
      const rgb = bgColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const hex = '#' + rgb.slice(0, 3).map(x => {
          const val = parseInt(x);
          return (val < 16 ? '0' : '') + val.toString(16);
        }).join('');
        backColor.value = hex;
      }
    } else if (bgColor.startsWith('#')) {
      backColor.value = bgColor;
    }
  }
  
  setupNoteControls(noteDiv);
  makeNoteDraggable(noteDiv);
  makeNoteResizable(noteDiv);
  
  // If note was saved in view mode, restore it in view mode
  if (noteData.viewMode) {
    // Wait for layout to settle before restoring view mode
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreViewMode(noteDiv, noteData);
      });
    });
  }
}

function restoreViewMode(noteDiv, noteData) {
  // We need noteDiv temporarily to get the text input structure, then we'll remove it
  const textInput = noteDiv.querySelector('#text-input');
  if (!textInput) return;
  
  // Store header/options height before removing noteDiv
  const header = noteDiv.querySelector('.header');
  const options = noteDiv.querySelector('.options');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const optionsHeight = options ? options.getBoundingClientRect().height : 0;
  const headerOptionsHeight = headerHeight + optionsHeight;
  
  // Calculate cloned element position from saved noteDiv position
  const paddingLeft = 4;
  const paddingRight = 2;
  const paddingTop = 4;
  const paddingBottom = 2;
  const borderWidth = 2;
  const totalOffsetLeft = paddingLeft + borderWidth;
  const totalOffsetRight = paddingRight + borderWidth;
  const totalOffsetTop = paddingTop + borderWidth;
  const totalOffsetBottom = paddingBottom + borderWidth;
  
  // Calculate cloned element position and size from saved noteDiv position
  const clonedLeft = noteData.position.left + totalOffsetLeft;
  const clonedTop = noteData.position.top + totalOffsetTop + headerOptionsHeight;
  const clonedWidth = noteData.position.width - totalOffsetLeft - totalOffsetRight;
  const clonedHeight = noteData.position.height - totalOffsetTop - totalOffsetBottom - headerOptionsHeight;
  
  // Clone the text input
  const clonedTextInput = textInput.cloneNode(true);
  clonedTextInput.contentEditable = false;
  clonedTextInput.classList.add('floatnote-view-text');
  clonedTextInput.dataset.noteId = noteData.id;
  
  // Set content from saved data
  if (noteData.noteText) {
    clonedTextInput.innerHTML = noteData.noteText;
  }
  
  // Apply saved styles to cloned element
  if (noteData.styles) {
    if (noteData.styles.backgroundColor) clonedTextInput.style.backgroundColor = noteData.styles.backgroundColor;
    if (noteData.styles.color) clonedTextInput.style.color = noteData.styles.color;
    if (noteData.styles.fontSize) clonedTextInput.style.fontSize = noteData.styles.fontSize;
    if (noteData.styles.fontFamily) clonedTextInput.style.fontFamily = noteData.styles.fontFamily;
    if (noteData.styles.lineHeight) clonedTextInput.style.lineHeight = noteData.styles.lineHeight;
    if (noteData.styles.letterSpacing) clonedTextInput.style.letterSpacing = noteData.styles.letterSpacing;
    if (noteData.styles.wordSpacing) clonedTextInput.style.wordSpacing = noteData.styles.wordSpacing;
    if (noteData.styles.border) clonedTextInput.style.border = noteData.styles.border;
    if (noteData.styles.padding) clonedTextInput.style.padding = noteData.styles.padding;
    if (noteData.styles.margin) clonedTextInput.style.margin = noteData.styles.margin;
    if (noteData.styles.marginTop) clonedTextInput.style.marginTop = noteData.styles.marginTop;
  }
  
  // Position and style the cloned element using calculated values
  clonedTextInput.style.position = 'absolute';
  clonedTextInput.style.left = clonedLeft + 'px';
  clonedTextInput.style.top = clonedTop + 'px';
  clonedTextInput.style.width = clonedWidth + 'px';
  clonedTextInput.style.height = clonedHeight + 'px';
  clonedTextInput.style.maxHeight = clonedHeight + 'px';
  clonedTextInput.style.minWidth = '0';
  clonedTextInput.style.minHeight = '0';
  clonedTextInput.style.zIndex = '10000';
  clonedTextInput.style.display = 'block';
  clonedTextInput.style.visibility = 'visible';
  clonedTextInput.style.opacity = '1';
  clonedTextInput.style.overflow = 'hidden';
  clonedTextInput.style.overflowY = 'hidden';
  clonedTextInput.style.overflowX = 'hidden';
  clonedTextInput.style.boxSizing = 'border-box';
  clonedTextInput.style.wordWrap = 'break-word';
  clonedTextInput.style.whiteSpace = 'pre-wrap';
  clonedTextInput.style.cursor = 'move';
  
  // Store note data on clonedTextInput for switching back to edit mode
  clonedTextInput._noteData = {
    noteId: noteData.id,
    headerOptionsHeight: headerOptionsHeight,
    storedDimensions: {
      left: noteData.position.left,
      top: noteData.position.top,
      width: noteData.position.width,
      height: noteData.position.height
    },
    styles: noteData.styles,
    noteText: clonedTextInput.innerHTML
  };
  
  // Remove noteDiv - we don't need it anymore
  noteDiv.remove();
  
  // Append cloned element to body
  document.body.appendChild(clonedTextInput);
  
  // Make cloned element draggable and resizable
  makeNoteDraggable(clonedTextInput);
  makeNoteResizable(clonedTextInput);
  
  // Double click to switch back to edit mode
  const handleDblClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    clonedTextInput.removeEventListener('dblclick', handleDblClick);
    switchToEditMode(clonedTextInput);
  };
  clonedTextInput.addEventListener('dblclick', handleDblClick);
}


function setupTextEditorButtons(noteDiv) {
  const textInput = noteDiv.querySelector('#text-input');
  if (!textInput) return;
  
  // Track focus to ensure this note is the active one when formatting
  textInput.addEventListener('focus', (e) => {
    e.stopPropagation();
    // Mark this note as active
    noteDiv.classList.add('active-note');
    // Remove active class from other notes
    document.querySelectorAll('.floatnote-note').forEach(note => {
      if (note !== noteDiv) {
        note.classList.remove('active-note');
      }
    });
  });
  
  textInput.addEventListener('blur', (e) => {
    setTimeout(() => {
      if (document.activeElement !== textInput) {
        noteDiv.classList.remove('active-note');
      }
    }, 100);
  });
  
  // Track selection changes to keep note active
  textInput.addEventListener('selectstart', (e) => {
    e.stopPropagation();
    noteDiv.classList.add('active-note');
    document.querySelectorAll('.floatnote-note').forEach(note => {
      if (note !== noteDiv) {
        note.classList.remove('active-note');
      }
    });
  });
  
  const formatButtons = [
    { id: 'bold', cmd: 'bold' },
    { id: 'italic', cmd: 'italic' },
    { id: 'underline', cmd: 'underline' },
    { id: 'strikethrough', cmd: 'strikeThrough' },
    { id: 'superscript', cmd: 'superscript' },
    { id: 'subscript', cmd: 'subscript' },
    { id: 'insertOrderedList', cmd: 'insertOrderedList' },
    { id: 'insertUnorderedList', cmd: 'insertUnorderedList' },
    { id: 'unlink', cmd: 'unlink' },
    { id: 'justifyLeft', cmd: 'justifyLeft' },
    { id: 'justifyCenter', cmd: 'justifyCenter' },
    { id: 'justifyRight', cmd: 'justifyRight' },
    { id: 'justifyFull', cmd: 'justifyFull' },
    { id: 'undo', cmd: 'undo' },
    { id: 'redo', cmd: 'redo' }
  ];
  
  formatButtons.forEach(({ id, cmd }) => {
    const button = noteDiv.querySelector(`#${id}`);
    if (button) {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        formatDoc(cmd, null);
      });
    }
  });
  
  const linkButton = noteDiv.querySelector('#createLink');
  if (linkButton) {
    linkButton.addEventListener('click', (e) => {
      e.stopPropagation();
      addLink();
    });
  }
  
  const formatBlock = noteDiv.querySelector('#formatBlock');
  if (formatBlock) {
    formatBlock.addEventListener('change', (e) => {
      e.stopPropagation();
      formatDoc('formatBlock', e.target.value);
    });
  }
  
  const fontSize = noteDiv.querySelector('#fontSize');
  if (fontSize) {
    fontSize.addEventListener('change', (e) => {
      e.stopPropagation();
      formatDoc('fontSize', e.target.value);
      if (!e.target.value) {
        e.target.selectedIndex = 0;
      }
    });
  }
  
  const fontName = noteDiv.querySelector('#fontName');
  if (fontName) {
    fontName.addEventListener('change', (e) => {
      e.stopPropagation();
      formatDoc('fontName', e.target.value);
      if (!e.target.value) {
        e.target.selectedIndex = 0;
      }
    });
  }
  
  const foreColor = noteDiv.querySelector('#foreColor');
  if (foreColor) {
    foreColor.addEventListener('input', (e) => {
      e.stopPropagation();
      formatDoc('foreColor', e.target.value);
    });
  }
  
  const backColor = noteDiv.querySelector('#backColor');
  if (backColor) {
    backColor.addEventListener('input', (e) => {
      e.stopPropagation();
      changeBackgroundColor(e.target.value, noteDiv);
    });
  }
}

async function setupNoteControls(noteDiv) {
  const closeButton = noteDiv.querySelector('#close');
  const saveButton = noteDiv.querySelector('#save');
  const textInput = noteDiv.querySelector('#text-input');
  
  if (!closeButton || !saveButton || !textInput) {
    console.error('Required note control elements not found');
    return;
  }
  const newCloseButton = closeButton.cloneNode(true);
  const newSaveButton = saveButton.cloneNode(true);
  closeButton.parentNode.replaceChild(newCloseButton, closeButton);
  saveButton.parentNode.replaceChild(newSaveButton, saveButton);
  
  // Stop keyboard events from bubbling to document level (prevents interference with page shortcuts)
  textInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });
  
  textInput.addEventListener('keyup', (e) => {
    e.stopPropagation();
  });
  
  textInput.addEventListener('keypress', (e) => {
    e.stopPropagation();
  });
  
  // Store input handler to prevent duplicates
  if (!noteDiv._inputHandler) {
    noteDiv._inputHandler = () => saveNoteToDB(noteDiv);
    textInput.addEventListener('input', noteDiv._inputHandler);
  }
  
  // Close button handler
  newCloseButton.addEventListener('click', async () => {
    const confirmed = confirm('Are you sure you want to delete this note? This action cannot be undone.');
    if (confirmed) {
      // Note: In view mode, noteDiv is already deleted, so we only need to handle edit mode
      
      const noteId = noteDiv.dataset.noteId;
      if (noteId) {
        try {
          // Wait for deletion to complete before removing from DOM
          const response = await chrome.runtime.sendMessage({ action: 'deleteNote', noteId });
          if (response && response.success) {
            noteDiv._deleted = true; // Mark as deleted
            noteDiv.remove();
          } else {
            console.error('Failed to delete note via background script:', response?.error);
            noteDiv._deleted = true; // Mark as deleted
            noteDiv.remove();
          }
        } catch (error) {
          console.error('Error sending deleteNote message to background:', error);
          noteDiv._deleted = true; // Mark as deleted
          noteDiv.remove();
        }
      } else {
        // No noteId, just remove from DOM
        noteDiv._deleted = true; // Mark as deleted
        noteDiv.remove();
      }
    } 
  });
  
  // Save button handler - store it to prevent duplicates
  if (!noteDiv._saveHandler) {
    noteDiv._saveHandler = () => {
    switchToViewMode(noteDiv);
    };
    newSaveButton.addEventListener('click', noteDiv._saveHandler);
  } else {
    newSaveButton.addEventListener('click', noteDiv._saveHandler);
  }
}


function extractStyles(computedStyle) {
  return {
    backgroundColor: computedStyle.backgroundColor,
    fontSize: computedStyle.fontSize,
    fontFamily: computedStyle.fontFamily,
    lineHeight: computedStyle.lineHeight,
    color: computedStyle.color,
    letterSpacing: computedStyle.letterSpacing,
    wordSpacing: computedStyle.wordSpacing,
    padding: computedStyle.padding,
    margin: computedStyle.margin,
    marginTop: computedStyle.marginTop,
    border: computedStyle.border
  };
}

async function saveNoteToDB(Element) {
  const isClonedTextInput = Element.classList && Element.classList.contains('floatnote-view-text');
  
  let noteId, rect, textContent, computedStyle, viewMode;
  
  if (isClonedTextInput) {
    // In view mode: save from clonedTextInput
    noteId = Element.dataset.noteId || Element._noteData?.noteId;
    if (!noteId) return;
    
    const clonedRect = Element.getBoundingClientRect();
    textContent = Element.innerHTML;
    computedStyle = window.getComputedStyle(Element);
    const headerOptionsHeight = Element._noteData?.headerOptionsHeight || 0;
    
    rect = {
      left: clonedRect.left - 6,
      top: clonedRect.top - 6 - headerOptionsHeight,
      width: clonedRect.width + 12,
      height: clonedRect.height + 10 + headerOptionsHeight
    };
    viewMode = true;
  } else {
    // In edit mode: save from noteDiv
    noteId = Element.dataset.noteId;
    if (!noteId) return;
    
    const textInput = Element.querySelector('#text-input');
    if (!textInput) return;
    
    rect = Element.getBoundingClientRect();
    textContent = textInput.innerHTML;
    computedStyle = window.getComputedStyle(textInput);
    viewMode = false;
  }
  
  const url = window.location.href;
  const noteData = {
    id: noteId,
    type: 'note',
    url: url,
    text: isClonedTextInput ? Element.textContent || '' : Element.querySelector('#text-input')?.textContent || '',
    noteText: textContent,
    timestamp: new Date().toISOString(),
    viewMode: viewMode,
    position: {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height
    },
    styles: extractStyles(computedStyle)
  };
  
  try {
    // Send to background script to save (content scripts can't share IndexedDB with side panel)
    chrome.runtime.sendMessage({ 
      action: 'saveNote', 
      note: noteData 
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending note to background:', chrome.runtime.lastError);
      } else if (response && response.success) {
        // Broadcast noteAdded message
        chrome.runtime.sendMessage({ action: 'noteAdded', note: noteData }).catch(() => {});
      } else {
        console.error('Failed to save note:', response?.error);
      }
    });
  } catch (error) {
    console.error('Error saving note:', error);
  }
}

function switchToViewMode(noteDiv) {
  const textInput = noteDiv.querySelector('#text-input');
  if (!textInput) return;  
  // Ensure noteDiv is visible before measuring (in case it was hidden from previous view mode)
  noteDiv.style.display = 'flex';
  noteDiv.style.visibility = 'visible';
  noteDiv.style.transform = 'none';
  
  // Store header/options height before hiding noteDiv
  const header = noteDiv.querySelector('.header');
  const options = noteDiv.querySelector('.options');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const optionsHeight = options ? options.getBoundingClientRect().height : 0;
  noteDiv._headerOptionsHeight = headerHeight + optionsHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const computedStyle = window.getComputedStyle(textInput);
      const rect = textInput.getBoundingClientRect();
      const clonedTextInput = textInput.cloneNode(true);
      clonedTextInput.contentEditable = false;
      clonedTextInput.classList.add('floatnote-view-text');
      clonedTextInput.dataset.noteId = noteDiv.dataset.noteId;
  
      clonedTextInput.style.position = 'absolute';
      clonedTextInput.style.left = window.scrollX + rect.left +'px';
      clonedTextInput.style.top = window.scrollY + rect.top +'px';
      console.log(window.scrollY)
      clonedTextInput.style.width = rect.width + 'px';
      clonedTextInput.style.height = rect.height + 'px';
      clonedTextInput.style.minWidth = '0';
      clonedTextInput.style.minHeight = '0';
      clonedTextInput.style.zIndex = '10000';
      clonedTextInput.style.display = 'block';
      clonedTextInput.style.visibility = 'visible';
      clonedTextInput.style.opacity = '1';
      clonedTextInput.style.backgroundColor = computedStyle.backgroundColor || '#ffffff';
      clonedTextInput.style.border = computedStyle.border || '2px solid #000';
      clonedTextInput.style.padding = computedStyle.padding || '12px 6px';
      clonedTextInput.style.margin = computedStyle.margin || '0';
      clonedTextInput.style.marginTop = computedStyle.marginTop || '10px';
      clonedTextInput.style.fontFamily = computedStyle.fontFamily;
      clonedTextInput.style.fontSize = computedStyle.fontSize;
      clonedTextInput.style.lineHeight = computedStyle.lineHeight;
      clonedTextInput.style.color = computedStyle.color || '#000000';
      clonedTextInput.style.overflowY = 'scroll';
      clonedTextInput.style.overflowX = 'hidden';
      clonedTextInput.style.boxSizing = 'border-box';
      clonedTextInput.style.wordWrap = 'break-word';
      clonedTextInput.style.whiteSpace = 'pre-wrap';
      clonedTextInput.style.wordSpacing = 'normal';
      clonedTextInput.style.cursor = 'move';
      clonedTextInput.style.pointerEvents = 'auto';
      
      // Store noteDiv data on clonedTextInput before removing noteDiv
      const noteDivRect = noteDiv.getBoundingClientRect();
      clonedTextInput._noteData = {
        noteId: noteDiv.dataset.noteId,
        headerOptionsHeight: noteDiv._headerOptionsHeight,
        storedDimensions: {
          left: noteDivRect.left,
          top: noteDivRect.top,
          width: noteDivRect.width,
          height: noteDivRect.height
        },
        styles: extractStyles(computedStyle),
        noteText: clonedTextInput.innerHTML
      };
      
      // Append cloned element to body AFTER positioning to prevent layout shift
      document.body.appendChild(clonedTextInput);  
      
      // Make cloned element draggable and resizable
      makeNoteDraggable(clonedTextInput);
      makeNoteResizable(clonedTextInput);
      
      // Double click to switch back to edit mode - use a named function to prevent duplicates
      const handleDblClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        clonedTextInput.removeEventListener('dblclick', handleDblClick);
        switchToEditMode(clonedTextInput);
      };
      clonedTextInput.addEventListener('dblclick', handleDblClick);

      requestAnimationFrame(() => {
        saveNoteToDB(clonedTextInput);
        noteDiv.remove();
      });
    });
  });
}

async function switchToEditMode(clonedTextInput) {
  if (!clonedTextInput._noteData) {
    console.error('Cannot switch to edit mode - note data not found');
    return;
  }
  
  const noteData = clonedTextInput._noteData;
  const rect = clonedTextInput.getBoundingClientRect();
  
  // Recreate noteDiv from stored data
  const noteDiv = await createNoteElement();
  if (!noteDiv) {
    console.error('Could not create note element');
    return;
  }
  noteDiv.classList.add('floatnote-note');
  noteDiv.classList.remove('floatnote-view-text');
  noteDiv.dataset.noteId = noteData.noteId;
  noteDiv._viewStatus = false;

  const headerOptionsHeight = noteData.headerOptionsHeight || 0;
  const noteDivLeft = rect.left - 6;
  const noteDivTop = rect.top - 6 - headerOptionsHeight;
  const noteDivWidth = rect.width + 12;
  const noteDivHeight = rect.height + 10 + headerOptionsHeight;

  // Apply position and size to noteDiv
  noteDiv.style.position = 'absolute';
  noteDiv.style.left = noteDivLeft + 'px';
  noteDiv.style.top = noteDivTop + 'px';
  noteDiv.style.width = noteDivWidth + 'px';
  noteDiv.style.height = noteDivHeight + 'px';
  noteDiv.style.transform = 'none';
  
  // Get text input and restore content/styles
  const textInput = noteDiv.querySelector('#text-input');
  if (textInput) {
    textInput.innerHTML = clonedTextInput.innerHTML;
    textInput.contentEditable = 'true';
    
    // Apply saved styles
    if (noteData.styles) {
      if (noteData.styles.backgroundColor) textInput.style.backgroundColor = noteData.styles.backgroundColor;
      if (noteData.styles.color) textInput.style.color = noteData.styles.color;
      if (noteData.styles.fontSize) textInput.style.fontSize = noteData.styles.fontSize;
      if (noteData.styles.fontFamily) textInput.style.fontFamily = noteData.styles.fontFamily;
      if (noteData.styles.lineHeight) textInput.style.lineHeight = noteData.styles.lineHeight;
      if (noteData.styles.letterSpacing) textInput.style.letterSpacing = noteData.styles.letterSpacing;
      if (noteData.styles.wordSpacing) textInput.style.wordSpacing = noteData.styles.wordSpacing;
      if (noteData.styles.border) textInput.style.border = noteData.styles.border;
      if (noteData.styles.padding) textInput.style.padding = noteData.styles.padding;
      if (noteData.styles.margin) textInput.style.margin = noteData.styles.margin;
      if (noteData.styles.marginTop) textInput.style.marginTop = noteData.styles.marginTop;
    }
  }
  
  // Store header/options height
  noteDiv._headerOptionsHeight = headerOptionsHeight;
  
  // Remove cloned element
  clonedTextInput.remove();
  
  // Append noteDiv to body
  document.body.appendChild(noteDiv);
  
  // Setup controls
  setupTextEditorButtons(noteDiv);
  setupNoteControls(noteDiv);
  makeNoteDraggable(noteDiv);
  makeNoteResizable(noteDiv);
  
  // Save the note after switching back to edit mode
  await saveNoteToDB(noteDiv);
}

function makeNoteDraggable(Element) {
  let noteIsDragging = false;
  let noteStartX, noteStartY, noteStartLeft, noteStartTop;
  let hasMoved = false;
  const isClonedTextInput = Element.classList.contains('floatnote-view-text');
  const DRAG_THRESHOLD = 5; // Pixels of movement required before dragging starts
  Element.addEventListener('mousedown', (e) => {
    // Don't drag on double-click
    if (e.detail === 2) {
      return;
    }
    
    // For view mode (cloned text input), allow dragging from anywhere except resizer
    if (isClonedTextInput) {
      if (e.target.closest('.resizer')) {
        return;
      }
      // Allow dragging from anywhere else in view mode
    } else {
      // For edit mode (noteDiv), check if target is interactive element or not in header
      if (e.target.closest('button') || 
          e.target.closest('select') ||
          e.target.closest('input') || 
          e.target.closest('#text-input') ||
          e.target.closest('.resizer') ||
          e.target.closest('a')) {
        return;
      }
      // Only allow dragging from header in edit mode
      const isHeader = e.target.closest('.header');
      if (!isHeader) {
      return;
      }
    }
    
    // Store initial position but don't set dragging yet
    noteStartX = e.clientX;
    noteStartY = e.clientY;
    hasMoved = false;
    noteIsDragging = false; // Make sure we start with dragging false
    
    const rect = Element.getBoundingClientRect();
    noteStartLeft = rect.left + window.scrollX;
    noteStartTop = rect.top + window.scrollY;
    if (Element.style.transform && Element.style.transform !== 'none') {
    Element.style.transform = 'none';
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
    e.stopPropagation();
  });

  const handleMouseMove = (e) => {
    // If no initial position stored, don't do anything
    if (noteStartX === undefined || noteStartY === undefined) {
      return;
    }
    
    // Only start dragging if mouse has moved beyond threshold
    if (!hasMoved) {
      const deltaX = Math.abs(e.clientX - noteStartX);
      const deltaY = Math.abs(e.clientY - noteStartY);
      
      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        hasMoved = true;
        noteIsDragging = true;
        // Now that we're actually dragging, ensure position is set correctly
        Element.style.transform = 'none';
        Element.style.left = noteStartLeft + 'px';
        Element.style.top = noteStartTop + 'px';
      } else {
        return; // Haven't moved enough yet
      }
    }
    
    // Check if mouse button is still pressed and we're actually dragging
    if (e.buttons !== 1 || !noteIsDragging) {
      // Reset if button released or not dragging
      noteIsDragging = false;
      hasMoved = false;
      noteStartX = undefined;
      noteStartY = undefined;
      return;
    }
    
    const deltaX = e.clientX - noteStartX;
    const deltaY = e.clientY - noteStartY;
    
    Element.style.left = (noteStartLeft + deltaX) + 'px';
    Element.style.top = (noteStartTop + deltaY) + 'px';
    
    e.preventDefault();
    e.stopPropagation();
    
  };

  const handleMouseUp = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only save if we actually dragged
    if (noteIsDragging && hasMoved) {
      // Save using the clonedTextInput
      await saveNoteToDB(Element);
    } else {
      // Dragging noteDiv in edit mode - update stored dimensions
      const currentRect = Element.getBoundingClientRect();
      Element._storedDimensions = {
        left: currentRect.left + window.scrollX,
        top: currentRect.top + window.scrollY ,
        width: currentRect.width,
        height: currentRect.height
      };
      
      if (Element.dataset.noteId) {
        await saveNoteToDB(Element);
      }
    }
    noteIsDragging = false;
    hasMoved = false;
    noteStartX = undefined;
    noteStartY = undefined;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}

function makeNoteResizable(Element) {
  let noteIsResizing = false;
  let noteStartX, noteStartY, noteStartWidth, noteStartHeight, noteStartLeft, noteStartTop;
  const isCloned = Element.classList.contains('floatnote-view-text');
  
  let resizer = Element.querySelector('.resizer');
  if (!resizer) return;
  
  resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    noteIsResizing = true;
    
    const rect = Element.getBoundingClientRect();
    noteStartWidth = rect.width;
    noteStartHeight = rect.height;
    noteStartLeft = rect.left + window.scrollX;
    noteStartTop = rect.top + window.scrollY;
    noteStartX = e.clientX;
    noteStartY = e.clientY;
    
    Element.style.transform = 'none';
    Element.style.left = noteStartLeft + 'px';
    Element.style.top = noteStartTop + 'px';
    resizer.style.cursor = 'nwse-resize';
    resizer.setPointerCapture(e.pointerId);
  });
  
  resizer.addEventListener('pointermove', (e) => {
    if (!noteIsResizing) return;
    e.preventDefault();
    e.stopPropagation();
    
    const deltaX = e.clientX - noteStartX;
    const deltaY = e.clientY - noteStartY;
    let newWidth = Math.max(200, noteStartWidth + deltaX);
    let newHeight = Math.max(300, noteStartHeight + deltaY);
    if (isCloned) {
      newWidth = Math.max(190, noteStartWidth + deltaX);
      newHeight = Math.max(86, noteStartHeight + deltaY);
    }
    // Resizing noteDiv in edit mode - update stored dimensions
    Element.style.width = newWidth + 'px';
    Element.style.height = newHeight + 'px';
    Element.style.left = noteStartLeft + 'px';
    Element.style.top = noteStartTop + 'px';
    
  });

  resizer.addEventListener('pointerup', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    noteIsResizing = false;
    resizer.releasePointerCapture(e.pointerId);
    
    // Save - use clonedTextInput if in view mode, otherwise use noteDiv
    if (isCloned && Element._noteData) {
      await saveNoteToDB(Element);
    } else if (Element.dataset.noteId) {
      await saveNoteToDB(Element);
    }
  });
}


