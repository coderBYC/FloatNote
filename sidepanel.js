// Dashboard
let allNotes = [];
let filteredNotes = [];

// Set up message listener immediately (before DOMContentLoaded)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'noteAdded' || message.action === 'noteDeleted') {
    loadNotes();
  }
});
document.addEventListener('keydown', async (e) => { 
  console.log('Keydown event in side panel:', e.key); 
  if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    e.stopPropagation();
    currentMode = 'dashboard';
    const indicator = document.createElement('div');
    indicator.textContent = 'Dashboard mode active';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background:rgb(89, 174, 92);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 100000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      pointer-events: none;
      font-weight: bold;
    `;
    document.body.appendChild(indicator);
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
    setTimeout(() => {
      indicator.style.opacity = '0';
      indicator.style.transition = 'opacity 0.3s';
      setTimeout(() => indicator.remove(), 300); 
    }, 2000);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  setupFilters();
  await loadNotes();
});

function setupFilters() {
  document.getElementById('filterType').addEventListener('change', applyFilters);
  document.getElementById('filterUrl').addEventListener('change', applyFilters);
}

async function loadNotes() {
  try {
    // Get all notes from background script
    const response = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
    if (response && response.notes) {
      allNotes = response.notes;
    } else {
      allNotes = [];
    }
    allNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    updateStats();
    updateUrlFilter();
    applyFilters();
  } catch (error) {
    console.error('Error loading notes:', error);
    allNotes = [];
  }
}

function updateStats() {
  const totalCount = allNotes.length;
  const highlightCount = allNotes.filter(n => n.type === 'highlight').length;
  const noteCount = allNotes.filter(n => n.type === 'note').length;
  
  document.getElementById('totalCount').textContent = totalCount;
  document.getElementById('highlightCount').textContent = highlightCount;
  document.getElementById('noteCount').textContent = noteCount;
}

function updateUrlFilter() {
  const urlSelect = document.getElementById('filterUrl');
  const urls = [...new Set(allNotes.map(note => note.url))];
  
  // Keep "All Pages" option
  urlSelect.innerHTML = '<option value="all">All Pages</option>';
  
  urls.forEach(url => {
    const option = document.createElement('option');
    option.value = url;
    option.textContent = new URL(url).hostname + new URL(url).pathname;
    urlSelect.appendChild(option);
  });
}

function applyFilters() {
  const typeFilter = document.getElementById('filterType').value;
  const urlFilter = document.getElementById('filterUrl').value;
  
  filteredNotes = allNotes.filter(note => {
    const typeMatch = typeFilter === 'all' || note.type === typeFilter;
    const urlMatch = urlFilter === 'all' || note.url === urlFilter;
    return typeMatch && urlMatch;
  });
  
  renderNotes();
}

function renderNotes() {
  const notesList = document.getElementById('notesList');
  
  if (filteredNotes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <p>No notes match your filters.</p>
      </div>
    `;
    return;
  }
  
  notesList.innerHTML = filteredNotes.map(note => {
    const date = new Date(note.timestamp);
    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const urlDisplay = note.url ? (new URL(note.url).hostname + new URL(note.url).pathname) : 'Unknown URL';
    
    return `
      <div class="note-item" data-note-id="${note.id}" data-note-url="${note.url || ''}">
        <div class="note-header">
          <span class="note-type ${note.type || 'note'}">${note.type || 'note'}</span>
          <span class="note-timestamp">${formattedDate}</span>
        </div>
        ${note.text ? `<div class="note-content">${note.text}</div>` : ''}
        <a href="#" class="note-url" data-url="${note.url || ''}">${urlDisplay}</a>
      </div>
    `;
  }).join('');
  
  // Add click handlers - just open the URL, notes will load automatically
  document.querySelectorAll('.note-item, .note-url').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.preventDefault();
      const url = item.getAttribute('data-url') || item.closest('.note-item')?.getAttribute('data-note-url');
      const noteId = item.getAttribute('data-note-id') || item.closest('.note-item')?.getAttribute('data-note-id');
      if (url && noteId) {
        const note = allNotes.find(n => n.id === noteId)
        const tab = await chrome.tabs.create({ url, active: true });
        if (note && note.position){
          setTimeout(()=>{
            chrome.tabs.sendMessage(tab.id, {
              action: 'scrollToNote',
              position: note.position
            })
          }, 1500)
        }
      }
    });
  });
}

