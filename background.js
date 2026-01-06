// Background service worker - IndexedDB operations
const DB_NAME = 'FloatNoteDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db = null;

async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
        objectStore.createIndex('url', 'url', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

async function saveNoteToDB(note) {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(note);
  
    transaction.oncomplete = () => { resolve(note.id);};
    
    transaction.onerror = () => {
      console.error('❌ IndexedDB transaction failed', transaction.error);
      reject(transaction.error);
    };
    
    transaction.onabort = () => {
      console.error('❌ IndexedDB transaction aborted');
      reject(new Error('Transaction aborted'));
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function getAllNotesFromDB() {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    let result = null;
    
    request.onsuccess = () => {
      result = request.result || [];
    };
    
    request.onerror = () => {
      reject(request.error);
    };
    
    // Wait for transaction to complete
    transaction.oncomplete = () => {
      resolve(result || []);
    };
    
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

async function getNotesByUrlFromDB(url) {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('url');
    const request = index.getAll(url);
    let result = null;
    
    request.onsuccess = () => {
      result = request.result || [];
      // Filter to ensure exact URL match (IndexedDB index.getAll might return partial matches)
      result = result.filter(note => {
        const noteUrl = note.url;
        return noteUrl === url;
      });
    };
    
    request.onerror = () => {
      reject(request.error);
    };
    
    // Wait for transaction to complete
    transaction.oncomplete = () => {
      resolve(result || []);
    };
    
    transaction.onerror = () => {
      reject(transaction.error);
    };
  });
}

async function deleteNoteFromDB(noteId) {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(noteId);
    
    // Wait for transaction to complete
          transaction.oncomplete = () => {
            resolve();
          };
    
    transaction.onerror = () => {
      console.error('❌ Delete transaction failed', transaction.error);
      reject(transaction.error);
    };
    
    transaction.onabort = () => {
      console.error('❌ Delete transaction aborted');
      reject(new Error('Transaction aborted'));
    };
    
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveNote') {
    // Save note to IndexedDB (background script is in extension context)
    saveNoteToDB(message.note).then(() => {
      sendResponse({ success: true });
      // Broadcast to side panel if open
      chrome.runtime.sendMessage({ action: 'noteAdded', note: message.note }).catch(() => {
        // Side panel might not be open, ignore error
      });
    }).catch(error => {
      console.error('Error saving note in background:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'noteAdded') {
    // Broadcast to side panel if open
    chrome.runtime.sendMessage(message).catch(() => {
      // Side panel might not be open, ignore error
    });
  } else if (message.action === 'deleteNote') {
    // Delete note from IndexedDB
    deleteNoteFromDB(message.noteId).then(() => {
      sendResponse({ success: true });
      chrome.runtime.sendMessage({ action: 'noteDeleted', noteId: message.noteId }).catch(() => {});
    }).catch(error => {
      console.error('Error deleting note in background:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  } else if (message.action === 'getNotesByUrl') {
    // Get notes by URL from IndexedDB
    getNotesByUrlFromDB(message.url).then(notes => {
      sendResponse({ notes });
    }).catch(error => {
      console.error('Error getting notes by URL:', error);
      sendResponse({ notes: [] });
    });
    return true;
  } else if (message.action === 'getAllNotes') {
    // Get all notes from IndexedDB
    getAllNotesFromDB().then(notes => {
      sendResponse({ notes });
    }).catch(error => {
      console.error('Error getting all notes in background:', error);
      sendResponse({ notes: [] });
    });
    return true;
  }
});

