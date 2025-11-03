# DistractoNoNo Chrome Extension

A Chrome extension that helps you stay focused by blocking distracting websites during work sessions.

## Features

- 🚫 Block distracting websites (YouTube, Instagram, Facebook, etc.)
- ⏱️ Set custom focus session durations (15 minutes to 4 hours)
- ✏️ Add or remove websites from your block list
- ⏰ Real-time countdown timer showing remaining focus time
- 🔔 Notification when focus session ends

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `DistractoNoNo` folder
5. The extension icon should appear in your toolbar

## Usage

1. Click the DistractoNoNo icon in your Chrome toolbar
2. Select how long you want to block distracting sites
3. Click "Start Focus Session"
4. Visit any blocked site and you'll see a friendly reminder to stay focused
5. The extension will automatically unblock sites when your session ends

## Customization

- **Add sites**: Type a domain name (e.g., `twitter.com`) and click "Add"
- **Remove sites**: Click the "Remove" button next to any site in your list
- **Default blocked sites**: YouTube, Instagram, Facebook, Twitter/X, TikTok, Reddit

## How It Works

The extension uses Chrome's `declarativeNetRequest` API to block requests to specified domains during active focus sessions. When you try to visit a blocked site, you'll be redirected to a friendly blocked page with a countdown timer.

## Privacy

All data (blocked sites, session settings) is stored locally in your browser. No data is sent to external servers.

## License

MIT
