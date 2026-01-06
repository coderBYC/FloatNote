// Mode selection
let currentMode = null;

document.getElementById('highlightBtn').addEventListener('click', async () => {
  await setMode('highlight');
});

document.getElementById('noteBtn').addEventListener('click', async () => {
  await setMode('note');
});

document.getElementById('dashboardBtn').addEventListener('click', async () => {
  await setMode('dashboard');
  // Open side panel
  await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
});

async function setMode(mode) {
  // Remove active class from all buttons
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  
  // Add active class to the clicked button
  if (mode === 'highlight') {
    document.getElementById('highlightBtn').classList.add('active');
  } else if (mode === 'note') {
    document.getElementById('noteBtn').classList.add('active');
  } else if (mode === 'dashboard') {
    document.getElementById('dashboardBtn').classList.add('active');
  }
  
  // Send message to content script of the current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.sendMessage(tab.id, { action: 'setMode', mode });
  setTimeout(() => window.close(), 200)
  
}

