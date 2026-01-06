# FloatNote Chrome Extension

A Chrome extension that lets you highlight text on any webpage, attach floating notes, and manage everything in a side-panel dashboard.

## Features

- ✏️ **Text Highlighting**: Select and highlight any text on any webpage
- 📝 **Floating Notes**: Attach draggable, floating notes to selected text
- 💾 **Persistent Storage**: All notes and highlights are saved and persist across sessions
- 🎨 **Color Customization**: Customize highlight and note colors
- 📊 **Dashboard**: Browse all your notes in a side panel with filtering options
- 🔗 **Smart Navigation**: Click any note in the dashboard to jump back to its exact location

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right)
3. Click "Load unpacked"
4. Select the `FloatNote` folder
5. The extension icon should appear in your Chrome toolbar

## Usage

### Getting Started

1. **Select Mode**: Click the extension icon and choose from three modes:
   - **Highlight**: Highlight selected text
   - **Note**: Create a floating note attached to selected text
   - **Dashboard**: Open the side panel to view all notes

### Creating Highlights

1. Click the extension icon
2. Select "Highlight" mode
3. Select text on any webpage
4. The text will be highlighted in yellow

### Creating Notes

1. Click the extension icon
2. Select "Note" mode
3. Select text on any webpage
4. A floating note will appear near the selected text
5. Type your note in the textarea
6. Drag the note to reposition it
7. Click the × to hide the note

### Using the Dashboard

1. Click the extension icon
2. Select "Dashboard" mode (or click the extension icon when side panel is open)
3. View all your notes and highlights
4. Filter by type (Highlight/Note) or by page URL
5. Click any note to navigate to its location on the page

## Technical Details

- **Manifest Version**: 3
- **Storage**: Chrome Storage API (local)
- **Anchoring**: DOM selectors for precise note positioning
- **Cross-session**: All data persists across browser sessions
- **No Authentication**: Notes are stored locally on your device

## File Structure

```
FloatNote/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup UI
├── popup.css              # Popup styles
├── popup.js               # Popup logic
├── content.js             # Content script for highlighting/notes
├── content.css            # Styles for highlights and notes
├── sidepanel.html         # Dashboard UI
├── sidepanel.css          # Dashboard styles
├── sidepanel.js           # Dashboard logic
├── background.js          # Service worker
└── icons/                 # Extension icons
```

## Notes

- Notes are stored locally in Chrome's storage
- Notes are linked to specific URLs and DOM positions
- The extension works on all websites (with `<all_urls>` permission)
- All data is stored locally on your device

## Future Enhancements

- Cloud sync across devices
- Export/import notes
- Note categories/tags
- Search functionality
- Screenshot attachments

