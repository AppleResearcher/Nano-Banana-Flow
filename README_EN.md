# 🍌 Nano Banana Flow

> **As long as the banana 🍌 works, generating images till dawn.**
>
> Batch Image Generation Tool for Gemini AI
>
> 【My Blog】More AI tools and tutorials: https://gt.topgpt.us

![Nano Banana Flow Preview](https://gt.topgpt.us/upload/NBF-Pro-v2.0.1.png)

[![Version](https://img.shields.io/badge/version-2.0.1-gold.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)

[中文说明](README.md)

> **Keep Nano Banana Working Until Dawn.**

A powerful Chrome extension designed to help you batch generate images on Gemini with automatic downloading, completely freeing your hands.

---

## 🔥 v2.0 Highlights

> [!IMPORTANT]
> **v2.0 is a major version iteration** with multiple core features and significantly improved user experience!

| 🆕 New Feature | Description |
|----------------|-------------|
| ✨ **AI Prompt Enhancement** | One-click optimize prompts, supports DeepSeek / GLM / OpenAI models |
| 🖼️ **Click-to-Upload Reference Images** | Independent upload module below each prompt, no more filename matching hassle |
| ⚡ **One-Click Watermark Removal** | Built-in watermark removal lab for quick Gemini watermark removal |
| 📚 **Prompt Library** | Save frequently used prompts, quick access with import, search, and management |
| 🎛️ **API Preset Panel** | SiliconFlow / DeepSeek / OpenAI one-click switch, custom also supported |
| 📝 **JSON + Multi-Delimiter** | Supports JSON format prompts, compatible with `---`, `|||`, `⸻` delimiters |

---

## ✨ Core Features

### 🎨 Batch Generation
Input multiple prompts at once, fully automatic generation one by one, no manual supervision needed.

### 📥 Auto Download
Automatically download after generation, supports custom save directories.

### ✨ AI Prompt Enhancement [v2.0+]
Built-in AI optimization, one-click transform simple descriptions into professional English prompts.
- Multi-model support: DeepSeek R1, GLM-4.1V, etc.
- API provider presets: SiliconFlow / DeepSeek / OpenAI
- Fully customizable: Bring your own API Key

### 🖼️ Smart Image-to-Image
- **[v2.0+] Click-to-Upload**: Independent upload module below each prompt
- **[v1.2.0+] Smart Matching**: Filename `1_xxx.jpg` auto-matches first prompt
- **Auto Compression**: Images larger than 1MB auto-compressed to 1024px

### ⚡ One-Click Watermark Removal [v2.0+]
Built-in watermark removal lab for quick Gemini watermark removal.

### 📚 Prompt Library [v2.0+]
- Save frequently used prompts, one-click access anytime
- Keyword search support
- Batch management and clear

### 📊 Real-time Progress
Intuitive progress bar showing generation status in real-time.

### 💾 State Persistence [v2.0+]
Prompts and reference images persist when popup is closed and reopened.

---

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

### 📥 Download Links

| Channel | Link | Note |
|---------|------|------|
| **GitHub** | [Releases Download](https://github.com/AppleResearcher/Nano-Banana-Flow/releases) | Latest version |
| **Baidu Pan** | [Baidu Pan](https://pan.baidu.com/s/1I9DMwu_NQVhAqIGeqgEa7g?pwd=saec) | Code: `saec` |
| **Google Drive** | [Google Drive](https://drive.google.com/file/d/1aK4ls54SSc64WcK56pQpYyKxoIEXIiUv/view?usp=sharing) | No VPN needed |

---

## 🚀 Usage Guide

### Step 1: Open Gemini

Visit [https://gemini.google.com/app](https://gemini.google.com/app) and make sure you're logged in

> **Note**: v1.1.1 now fully supports Traditional Chinese interface (Hong Kong, Macau, Taiwan).

### Step 2: Prepare Prompts

Enter prompts in the extension input box, supports multiple formats:

**Method 1: One per line**
```
A cute cat sitting by the window
A golden retriever playing in the park
A blooming rose flower
```

**Method 2: Triple-dash delimiter**
```
A cute cat sitting by the window
---
A golden retriever playing in the park
---
A blooming rose flower
```

**🌟 Method 3: AI Prompt Enhancement [Highly Recommended]**

> [!TIP]
> **One-click batch generate multi-angle, multi-environment prompts!** Just input a simple description, AI automatically generates professional English prompts.

**Example: Generate 5 different angle portraits**

Input:
```
A girl, five images, 5 different angles and environments
```

AI auto-generates five different versions with `---` separators, supports combining with reference images.

**Steps:**
1. Click ⚙️ to configure API Key (SiliconFlow free tier recommended)
2. Input description + quantity requirement (e.g., "five images")
3. Click ✨ button, wait for AI generation

### Step 3: Add Reference Images (Optional)

**Method 1: Click-to-Upload [Recommended]**
- After entering prompts, upload modules appear below each prompt
- Click `+` button to directly add reference images

**Method 2: Batch Import + Smart Matching**
- Name images as `1_xxx.jpg`, `2_xxx.jpg` format
- Click 🖼️ Import, auto-matches to corresponding prompts

### Step 4: Start Generation

1. Click "🎨 Batch Generate" button
2. Wait for automatic generation and download
3. Images save to default download directory (or your specified directory)

### Step 5: Watermark Removal (Optional)

1. After batch generation completes, a prompt will appear
2. Click "⚡ Watermark Removal" button
3. Select images to process (multi-select supported)
4. Processed images auto-download with `_wr` suffix

---

## 🔧 FAQ

### Basic
- **Q: What does this tool do?**
  Input multiple prompts at once, auto-generate images one by one and download locally, no manual intervention needed.

- **Q: How to use AI Prompt Enhancement?**
  1. Click ⚙️ to configure API Key (SiliconFlow recommended)
  2. Input description, click ✨ button
  3. AI auto-generates professional English prompts

- **Q: How to match reference images to prompts?**
  - **v2.0 New Method [Recommended]**: After entering prompts, **click-to-upload modules** appear below each prompt, directly click `+` to add reference images - no renaming needed, more convenient!
  - **Original Method [Fully Compatible]**: Name images `1_xxx.jpg` → auto-matches first prompt, still works with batch import

### Troubleshooting
- **Q: Extension can't find the input field?**
  1. Ensure you're on `https://gemini.google.com/app`
  2. **Refresh the page** (often the input box hasn't loaded yet)

- **Q: Files downloaded as .html?**
  Click the "Lock" icon in address bar → Site Settings → **Allow Automatic downloads**

- **Q: API Prompt Enhancement error?**
  Check if API endpoint includes `/v1` suffix (e.g., `https://api.siliconflow.cn/v1`)

---

## 📝 Changelog

### v2.0.1 (2026-01-10) 🚀 Major Update
- ✨ **AI Prompt Enhancement**: One-click optimize, supports DeepSeek / GLM / OpenAI models
- 🖼️ **Click-to-Upload Reference Images**: Independent upload module below each prompt
- ⚡ **One-Click Watermark Removal**: Built-in watermark removal lab for quick Gemini watermark removal
- 📚 **Prompt Library**: Save, search, one-click access to frequently used prompts
- 🎛️ **API Preset Panel**: Provider + Model dual dropdown, quick switch
- 📝 **JSON + Multi-Delimiter**: Supports JSON format, compatible with `---`, `|||`, `⸻`
- 💾 **State Persistence**: Prompts and reference images no longer lost on close
- 🚀 **Startup Speed Optimization**: Instant open achieved, smoother experience
- 🔧 **Many Bug Fixes**: First line empty, block refresh, state residue issues

### v1.2.0 (2025-12-24) 🎄 Christmas Special Edition
- 🎨 **Compact UI Redesign**: More refined interface, better space utilization
- 🖼️ **Smart Image Matching**: Filename auto-matches prompts
- 📄 **TXT Quick Import**: One-click import massive prompts
- 📣 **Dynamic Announcement Bar**: Bottom supports remote configuration

### v1.1.1 (2025-12-14)
- ✅ Full support for Traditional Chinese interface (Hong Kong, Macau, Taiwan)
- ✅ Fixed button recognition in Traditional Chinese environment

### v1.1.0 (2025-12-05)
- ✅ Fixed initialization error
- ✅ Enhanced debug logs
- ✅ Optimized download flow

---

## ❤️ Special Thanks

The growth of Nano Banana Flow is inseparable from the enthusiastic support of the community. Special thanks to the following partners for providing key feedback and testing help during version iterations:

| Contributor | Contribution |
| :--- | :--- |
| **@RDR摊主** | Suggested progress bar fix |
| **@爱是指引** | Suggested JSON format prompt support |
| **@豆师傅** | Suggested watermark removal feature |
| **@玄彬的玄** | Donation + Multiple improvement feedback |
| **@Monica** | Donation support |
| **@AI～my** | Donation support |
| **@Moon** | Donation support |
| **Anonymous N** | Donation support and other suggestions |

*(Too many to list, thanks again to all supporters! You make this tool better!)*

---

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
├── images/            # Theme images
└── lib/               # Feature libraries (watermark removal, etc.)
```

## 🛠️ Tech Stack

- **Manifest V3**: Latest Chrome extension standard
- **Content Script**: DOM manipulation and page interaction
- **Service Worker**: Background task management
- **Chrome APIs**: Downloads API, Storage API

---

## 📄 License & Attribution

This project is released under the **MIT License**. We encourage technical exchange and innovation; you are free to use, modify, and distribute the code within the scope of the license.

**⚠️ Attribution Requirement:**

If you build upon this project, modify it, or use its core code in your release, **you must explicitly credit the source** in your product description, README, or copyright notice, following international open source standards, including a link to the original GitHub repository:

> **Original Project:** [Nano Banana Flow](https://github.com/AppleResearcher/Nano-Banana-Flow)
> **Author:** AppleResearcher

Respect the work of developers and help build a healthy open source ecosystem.

---

**Enjoy batch image generation!** 🍌
