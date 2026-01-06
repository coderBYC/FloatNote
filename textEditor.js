function formatDoc(cmd, value = null) {
  // Find the active note - prefer the one with 'active-note' class
  let noteDiv = document.querySelector('.floatnote-note.active-note');
  let textInput = null;
  
  if (noteDiv) {
    textInput = noteDiv.querySelector('#text-input');
  } else {
    // Fallback: find note that contains the current selection
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;
      const selectedElement = commonAncestor.nodeType === Node.TEXT_NODE 
        ? commonAncestor.parentElement 
        : commonAncestor;
      
      if (selectedElement) {
        noteDiv = selectedElement.closest('.floatnote-note');
        if (noteDiv) {
          textInput = noteDiv.querySelector('#text-input');
        }
      }
    }
    
    // Last resort: use focused element or first visible note
    if (!textInput || !noteDiv) {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.id === 'text-input' && activeEl.contentEditable === 'true') {
        textInput = activeEl;
        noteDiv = textInput.closest('.floatnote-note');
      } else {
        noteDiv = document.querySelector('.floatnote-note:not(.view-mode)');
        textInput = noteDiv ? noteDiv.querySelector('#text-input') : null;
      }
    }
  }
  
  if (!textInput || !noteDiv) return;
  
  // Mark as active and focus
  noteDiv.classList.add('active-note');
  document.querySelectorAll('.floatnote-note').forEach(note => {
    if (note !== noteDiv) {
      note.classList.remove('active-note');
    }
  });
  textInput.focus();
  
  // For list commands, ensure we have a proper selection context
  if (cmd === 'insertOrderedList' || cmd === 'insertUnorderedList') {
    const selection = window.getSelection();
    
    // If no selection or collapsed selection, we need to prepare the content
    if (!selection.rangeCount || selection.getRangeAt(0).collapsed) {
      // Check if text input is empty or has no block structure
      const hasBlockStructure = textInput.querySelector('p, div, li, ul, ol');
      
      if (!textInput.innerHTML.trim() || !hasBlockStructure) {
        // Wrap content in a paragraph if it's plain text
        const text = textInput.textContent || '';
        if (text.trim()) {
          // Split by newlines and wrap each line in a paragraph
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            textInput.innerHTML = lines.map(line => `<p>${line}</p>`).join('');
            // Set cursor at the end of the last paragraph
            const range = document.createRange();
            const sel = window.getSelection();
            const paragraphs = textInput.querySelectorAll('p');
            const lastP = paragraphs[paragraphs.length - 1];
            if (lastP) {
              range.setStart(lastP, lastP.childNodes.length || 0);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          } else {
            // Empty input - create a paragraph
            textInput.innerHTML = '<p><br></p>';
            const range = document.createRange();
            const sel = window.getSelection();
            const p = textInput.querySelector('p');
            if (p) {
              range.setStart(p, 0);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
        } else {
          // Empty input - create a paragraph
          textInput.innerHTML = '<p><br></p>';
          const range = document.createRange();
          const sel = window.getSelection();
          const p = textInput.querySelector('p');
          if (p) {
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } else {
        // Has structure - select the current block element (paragraph or list item)
        const range = document.createRange();
        const sel = window.getSelection();
        let node = selection.anchorNode;
        
        // Walk up to find a block element
        while (node && node !== textInput) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            if (['p', 'div', 'li'].includes(tagName)) {
              range.selectNodeContents(node);
              sel.removeAllRanges();
              sel.addRange(range);
              break;
            }
          }
          node = node.parentNode;
        }
        
        // If we didn't find a block element, select the first paragraph
        if (!range.toString()) {
          const firstP = textInput.querySelector('p, li');
          if (firstP) {
            range.selectNodeContents(firstP);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    }
  }
  
  // Execute the command
  try {
    if (value !== null) {
      document.execCommand(cmd, false, value);
    } else {
      document.execCommand(cmd, false, null);
    }
  } catch (e) {
    console.error('Error executing command:', cmd, e);
  }
  
  // Maintain focus
  textInput.focus();
}

function addLink() {
  const url = prompt("Enter the url for the link");
  if (url && url.trim()) {
    // Ensure URL has protocol
    const fullUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : 'http://' + url.trim();
    formatDoc('createLink', fullUrl);
  }
}

function changeBackgroundColor(color, noteDiv) {
  if (!noteDiv) {
    const activeElement = document.activeElement;
    noteDiv = activeElement ? activeElement.closest('.floatnote-note:not(.view-mode)') : null;
    if (!noteDiv) {
      noteDiv = document.querySelector('.floatnote-note:not(.view-mode)');
    }
  }
  
  const textInput = noteDiv ? noteDiv.querySelector('#text-input') : null;
  if (textInput) {
    textInput.style.backgroundColor = color;
  }
}
