# 🍌 Nano Banana Flow

> Batch Image Generation Tool for Gemini AI

[![Version](https://img.shields.io/badge/version-1.1.0-gold.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)

[中文文档](README.md)

A powerful Chrome extension that helps you batch generate images on Gemini and automatically download them.

## ✨ Features

- 🎨 **Batch Generation**: Input multiple prompts at once, automatically generate images one by one
- 📥 **Auto Download**: Generated images are automatically downloaded with sequential naming (page1.png, page2.png...)
- 📊 **Real-time Progress**: Intuitive progress bar showing current generation status
- 💾 **Smart Save**: Automatically saves your last input prompts
- 🎯 **Easy to Use**: Modern UI design with intuitive operation
- ⏹️ **Task Control**: Stop running tasks at any time

## 📦 Installation

### Load in Developer Mode

1. **Download the extension**
   - Clone this repository or download the ZIP file

2. **Open Chrome Extensions page**
   - Enter `chrome://extensions/` in Chrome address bar

3. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top right corner

4. **Load the extension**
   - Click "Load unpacked"
   - Select the extension folder

5. **Done!**
   - The extension icon will appear in Chrome toolbar
   - If not visible, click the puzzle icon 📌 to pin it

## 🚀 Usage

### Step 1: Open Gemini

Visit [https://gemini.google.com/app](https://gemini.google.com/app) and make sure you're logged in

### Step 2: Prepare Prompts

Enter one prompt per line in the extension input box:

```
A cute cat sitting by the window
A golden retriever playing in the park
A blooming rose flower
```

### Step 3: Start Generation

1. Click the extension icon to open the interface
2. Paste or type your prompts (one per line)
3. Optional: Set save directory
4. Click the "🎨 Batch Generate" button
5. Wait for automatic generation and download

### Step 4: Check Results

- Images are automatically downloaded to your default download folder (or your specified directory)
- File naming format: `page1.png`, `page2.png`, `page3.png`...

## 🔧 FAQ

### Q: Extension can't find the input field?
Make sure you're on `https://gemini.google.com/app` and the page is fully loaded. Try refreshing if the issue persists.

### Q: Image generation timeout?
Default timeout is 2 minutes. If your network is slow, check your connection.

### Q: Download failed?
- Ensure the extension has download permissions
- Try using a simple directory name (avoid special characters)
- Refresh the Gemini page and try again

## 📁 Project Structure

```
Nano-Banana-Flow/
├── manifest.json      # Extension configuration
├── popup.html         # Popup interface
├── popup.css          # Styles
├── popup.js           # Popup logic
├── content.js         # Content script (core)
├── background.js      # Background service
├── icons/             # Icon assets
└── images/            # Theme images
```

## 🛠️ Tech Stack

- **Manifest V3**: Latest Chrome extension standard
- **Content Script**: DOM manipulation and page interaction
- **Service Worker**: Background task management
- **Chrome APIs**: Downloads API, Storage API

## 📝 Changelog

### v1.1.0 (2025-12-05)
- ✅ Fixed statusIndicator missing initialization error
- ✅ Enhanced message passing debug logs
- ✅ Optimized download flow error handling
- ✅ Cleaned up redundant code and documentation

### v1.0.1
- Initial release
- Batch image generation
- Auto download functionality
- Progress display

## 📄 License

MIT License

---

**Enjoy batch image generation!** 🍌
