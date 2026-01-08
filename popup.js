// ============================================
// GA4 Analytics Configuration
// ============================================
const GA_MEASUREMENT_ID = 'G-P27Y3YCJYM';
const GA_API_SECRET = '_FK2ZAQtS9C4b6PFmySg6w';
const EXTENSION_VERSION = '1.2.1';

// GA4 Event Sender
async function sendAnalyticsEvent(eventName, params = {}) {
  try {
    const clientId = await getOrCreateClientId();
    const payload = {
      client_id: clientId,
      events: [{
        name: eventName,
        params: {
          extension_version: EXTENSION_VERSION,
          ...params
        }
      }]
    };

    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    console.log(`[GA4] Event sent: ${eventName}`, params);
  } catch (e) {
    console.log('[GA4] Event send failed:', e);
  }
}

// Client ID Generator (persistent across sessions)
async function getOrCreateClientId() {
  const result = await chrome.storage.local.get(['ga_client_id']);
  if (result.ga_client_id) return result.ga_client_id;

  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ ga_client_id: newId });
  return newId;
}

// DOM Elements
const promptsTextarea = document.getElementById('promptInput');
const promptCount = document.getElementById('promptCount');
const directoryInput = document.getElementById('directoryInput');
const actionBtn = document.getElementById('actionBtn');
const openLabBtn = document.getElementById('openLabBtn'); // New
const clearBtn = document.getElementById('clearBtn');
const progressArea = document.getElementById('progressArea');
const progressCount = document.getElementById('progressCount');
const progressBar = document.getElementById('progressBar');
const currentStatus = document.getElementById('currentStatus');
const errorMsg = document.getElementById('errorMsg');
const statusIndicator = document.getElementById('statusIndicator');

// New Advanced Features DOM
const importTxtBtn = document.getElementById('importTxtBtn');
const importImagesBtn = document.getElementById('importImagesBtn');
const importFolderBtn = document.getElementById('importFolderBtn'); // New

const txtFileInput = document.getElementById('txtFileInput');
const imageFileInput = document.getElementById('imageFileInput');
const folderInput = document.getElementById('folderInput'); // New
const manualWatermarkInput = document.getElementById('manualWatermarkInput'); // New
const matchDetails = document.getElementById('matchDetails'); // New
const labStatus = document.getElementById('labStatus'); // New

// State Management
let isRunning = false;
let associatedImages = new Map(); // LineNumber -> File[]

// --- File Import Handlers ---

if (importTxtBtn) importTxtBtn.addEventListener('click', () => txtFileInput.click());
if (importImagesBtn) importImagesBtn.addEventListener('click', () => imageFileInput.click());
// if (importFolderBtn) importFolderBtn.addEventListener('click', () => folderInput.click()); // Old Folder Import
if (importFolderBtn) importFolderBtn.addEventListener('click', () => {
  // Show tooltip-like alert as this feature is placeholder for now
  alert('✨ 提示词增强功能\n\n我们将很快推出此功能！\n开启后，或将提供多种预设的提示词优化场景（如：比例约束、风格化、细节补充、2.5/4K高清下载等），自动将您的简单提示词优化为高质量的 AI 绘图指令。\n\n敬请期待！🚀');
});

if (txtFileInput) {
  txtFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      promptsTextarea.value = event.target.result;
      promptsTextarea.dispatchEvent(new Event('input'));
    };
    reader.readAsText(file);
  });
}

// 统一的图片处理逻辑 (追加模式)
function processImageFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  console.log('[Popup] 📸 新增图片文件:', files.length, '张');

  if (files.length === 0) {
    // 如果是文件夹导入且没图，提示一下；如果是普通选择取消，不提示
    if (fileList.length > 0) alert('所选内容中没有图片文件');
    return;
  }

  files.forEach(file => {
    console.log('[Popup] 📸 处理文件:', file.name);
    // Regex: Match numbers at start of filename
    const match = file.name.match(/^(\d+)/);
    if (match) {
      const lineNum = parseInt(match[1], 10);

      if (!associatedImages.has(lineNum)) {
        associatedImages.set(lineNum, []);
      }

      // 避免重复添加同名文件
      const existing = associatedImages.get(lineNum);
      if (!existing.some(f => f.name === file.name)) {
        existing.push(file);
        console.log('[Popup] 📸 匹配成功(追加): 文件', file.name, '-> 行号', lineNum);
      } else {
        console.log('[Popup] ⚠️ 跳过重复文件:', file.name);
      }
    } else {
      console.warn('[Popup] ⚠️ 文件名未匹配:', file.name, '(需以数字开头，如 1_image.jpg)');
    }
  });

  console.log('[Popup] 📸 当前匹配总览:', Object.fromEntries(associatedImages));
  updateMatchingUI();
  saveAssociatedImages(); // Persist to storage
}

if (imageFileInput) {
  imageFileInput.addEventListener('change', (e) => {
    processImageFiles(e.target.files);
    imageFileInput.value = ''; // Reset to allow re-selecting same files
  });
}

if (folderInput) {
  folderInput.addEventListener('change', (e) => {
    processImageFiles(e.target.files);
    folderInput.value = ''; // Reset
  });
}

function updateMatchingUI() {
  if (!matchDetails) return; // Defensive

  const totalImgs = Array.from(associatedImages.values()).flat().length;
  const totalLines = associatedImages.size;

  const matchStatus = document.getElementById('matchStatus');

  if (matchStatus) {
    matchStatus.textContent = `✅ 已关联 ${totalImgs} 张参考图 (覆盖 ${totalLines} 条任务)`;
    matchStatus.classList.remove('hidden');
  }

  if (totalImgs > 0) {
    // 生成详细预览
    matchDetails.innerHTML = '';
    matchDetails.classList.remove('hidden');

    // 只显示有图片的行，按行号排序
    const sortedKeys = Array.from(associatedImages.keys()).sort((a, b) => a - b);

    sortedKeys.forEach(lineNum => {
      const imgs = associatedImages.get(lineNum);
      const row = document.createElement('div');
      row.className = 'match-row';

      const filenames = imgs.map(f => f.name).join(', ');
      // 这里的 lineNum 实际上是 Task ID
      row.textContent = `提示词${lineNum}: [${imgs.length}图] ${filenames}`;
      matchDetails.appendChild(row);
    });

  } else {
    matchDetails.classList.add('hidden');
  }
}

// --- Original Logic ---

// Auto-resize textarea and update count
if (promptsTextarea) {
  promptsTextarea.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    chrome.storage.local.set({ lastPrompts: this.value });
    updatePromptCount(this.value);
  });
}

function updatePromptCount(text) {
  if (!promptCount) return;
  const prompts = text.split('\n').filter(line => line.trim() !== '');
  promptCount.textContent = `${prompts.length} 条提示词已被识别，随时可以开始`;
}

// Clear Prompts
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (confirm('确定要清空所有提示词吗？')) {
      promptsTextarea.value = '';
      promptsTextarea.style.height = 'auto';
      chrome.storage.local.remove('lastPrompts');
      updatePromptCount('');
      associatedImages.clear();
      clearAssociatedImagesCache();
      updateMatchingUI();
    }
  });
}

// Save directory to storage
if (directoryInput) {
  directoryInput.addEventListener('input', function () {
    chrome.storage.local.set({ saveDirectory: this.value });
  });
}

// Restore state on load
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastPrompts', 'saveDirectory'], (result) => {
    if (result.lastPrompts && promptsTextarea) {
      promptsTextarea.value = result.lastPrompts;
      // Trigger resize
      promptsTextarea.style.height = 'auto';
      promptsTextarea.style.height = (promptsTextarea.scrollHeight) + 'px';
      updatePromptCount(promptsTextarea.value);
    }
    if (result.saveDirectory && directoryInput) {
      directoryInput.value = result.saveDirectory;
    }
  });

  restoreStatus();
  updateMatchingUI(); // Initialize match status visibility
  restoreAssociatedImages(); // Restore image associations

  // GA4: Track extension open
  sendAnalyticsEvent('extension_open');
});

// Unified Action Button Click Handler
if (actionBtn) {
  actionBtn.addEventListener('click', async () => {
    if (isRunning) {
      handleStop();
    } else {
      handleStart();
    }
  });
}

// Manual Watermark Listeners
if (openLabBtn) {
  openLabBtn.addEventListener('click', () => {
    if (manualWatermarkInput) manualWatermarkInput.click();
  });
}

if (manualWatermarkInput) {
  manualWatermarkInput.addEventListener('change', handleManualWatermark);
}

async function handleStart() {
  console.log('[Popup] 📌 handleStart 被调用');

  const input = promptsTextarea.value.trim();
  const directory = directoryInput.value.trim();

  if (!input) {
    showError('请输入至少一个提示词');
    return;
  }

  const lines = input.split('\n');
  const tasks = [];
  let validLineCount = 0; // 逻辑行号（即任务序号）

  lines.forEach((line, index) => {
    const prompt = line.trim();
    if (prompt) {
      validLineCount++; // 只有非空行才增加任务计数
      const taskIndex = validLineCount;

      tasks.push({
        prompt: prompt,
        lineNum: taskIndex, // 使用逻辑索引
        images: associatedImages.get(taskIndex) || [] // 按逻辑索引取图
      });
    }
  });

  if (tasks.length === 0) {
    showError('请输入有效的提示词');
    return;
  }

  // Check if on Gemini page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url || !tab.url.includes('gemini.google.com')) {
    showError('请先打开 Gemini 页面 (https://gemini.google.com/app)');
    return;
  }

  console.log('[Popup] ✅ 准备全量任务集:', tasks.length);
  // 调试：打印每个任务的图片关联情况
  tasks.forEach((t, i) => {
    console.log(`[Popup] 任务 ${i + 1}: 提示词="${t.prompt.substring(0, 20)}..." , 行号=${t.lineNum}, 关联图片=${t.images.length}张`);
  });

  // GA4: Track generation start
  sendAnalyticsEvent('generation_start', { image_count: tasks.length });

  startGeneration(tasks, directory);
}

async function handleStop() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'stopTask' });
    if (response && response.success) {
      resetUI();
      showStatus('Ready', false);
      if (currentStatus) currentStatus.textContent = '任务已中止';
    }
  } catch (error) {
    console.error('停止任务失败:', error);
  }
}

async function startGeneration(tasks, directory) {
  setRunningState(true);
  hideError();
  showProgress(0, tasks.length, '正在处理文件...');
  showStatus('Running', true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Prepare Tasks: Convert Files to Base64 for message passing
    const processedTasks = await Promise.all(tasks.map(async (task) => {
      const imgData = await Promise.all(task.images.map(file => fileToBase64(file)));
      return {
        prompt: task.prompt,
        images: imgData // Array of strings (base64)
      };
    }));

    const response = await chrome.runtime.sendMessage({
      action: 'startGeneration',
      tasks: processedTasks,
      directory: directory,
      tabId: tab.id
    });

    if (response && response.success) {
      console.log('[Popup] ✅ 任务启动成功');
    } else {
      throw new Error(response?.error || '启动失败');
    }
  } catch (error) {
    console.error('[Popup] ❌ 启动失败:', error);
    showError('启动失败: ' + error.message);
    resetUI();
  }
}

// Manual Watermark Handler
async function handleManualWatermark(event) {
  const allFiles = event.target.files;
  if (!allFiles || allFiles.length === 0) return;

  // Filter only image files
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif'];
  const files = Array.from(allFiles).filter(file => {
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return imageExtensions.includes(ext) || file.type.startsWith('image/');
  });

  if (files.length === 0) {
    if (labStatus) {
      labStatus.textContent = '未找到图片文件';
      labStatus.classList.remove('hidden');
      setTimeout(() => labStatus.classList.add('hidden'), 3000);
    }
    return;
  }

  if (labStatus) {
    labStatus.textContent = `准备处理 ${files.length} 张图片...`;
    labStatus.classList.remove('hidden');
  }

  try {
    // Check if WatermarkEngine is available
    if (typeof WatermarkEngine === 'undefined') {
      throw new Error('去水印组件未加载');
    }

    const engine = await WatermarkEngine.create();
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (labStatus) labStatus.textContent = `正在处理: ${i + 1}/${files.length}`;

      // 1. Read file to Image
      const base64 = await fileToBase64(file);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = base64;
      });

      // 2. Process
      const canvas = await engine.removeWatermarkFromImage(image);

      // 3. Construct filename with relative path (preserves folder structure)
      let newFilename;
      const originalName = file.name;
      const lastDotIndex = originalName.lastIndexOf('.');
      const namePart = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
      const wrName = `${namePart}_wr.png`;

      // If file has webkitRelativePath (selected via folder picker), use it
      if (file.webkitRelativePath) {
        const pathParts = file.webkitRelativePath.split('/');
        pathParts.pop(); // Remove original filename
        pathParts.push(wrName); // Add new filename
        newFilename = pathParts.join('/');
      } else {
        newFilename = wrName;
      }

      const dataUrl = canvas.toDataURL('image/png');

      await chrome.downloads.download({
        url: dataUrl,
        filename: newFilename,
        saveAs: false
      });

      successCount++;
    }

    if (labStatus) {
      labStatus.textContent = `处理完成! 成功: ${successCount}`;
      setTimeout(() => labStatus.classList.add('hidden'), 3000);
    }

  } catch (error) {
    console.error('去水印失败:', error);
    if (labStatus) labStatus.textContent = `出错: ${error.message}`;
  }

  // Reset input
  event.target.value = '';
}

// Helpers
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// Convert Data URL to Blob
function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

// ========== IndexedDB for Image Persistence (Larger Quota) ==========
const DB_NAME = 'NanoBananaDB';
const DB_VERSION = 1;
const STORE_NAME = 'associatedImages';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save associatedImages to IndexedDB
async function saveAssociatedImages() {
  try {
    const data = {};
    for (const [lineNum, files] of associatedImages) {
      data[lineNum] = await Promise.all(files.map(async f => ({
        name: f.name,
        type: f.type,
        data: await fileToBase64(f)
      })));
    }
    console.log('[Popup] 💾 准备保存图片关联到 IndexedDB, 条目数:', Object.keys(data).length);

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: 'cache', data: data });

    tx.oncomplete = () => {
      console.log('[Popup] ✅ 图片关联已成功保存到 IndexedDB');
      db.close();
    };
    tx.onerror = () => {
      console.error('[Popup] ❌ IndexedDB 保存失败:', tx.error);
      db.close();
    };
  } catch (error) {
    console.error('[Popup] ❌ 保存图片关联异常:', error);
  }
}

// Restore associatedImages from IndexedDB
async function restoreAssociatedImages() {
  try {
    console.log('[Popup] 🔍 尝试从 IndexedDB 恢复图片关联...');
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('cache');

    request.onsuccess = () => {
      const result = request.result;
      if (result && result.data && Object.keys(result.data).length > 0) {
        for (const [lineNum, items] of Object.entries(result.data)) {
          const files = items.map(item => {
            const blob = dataURLtoBlob(item.data);
            return new File([blob], item.name, { type: item.type });
          });
          associatedImages.set(parseInt(lineNum), files);
        }
        console.log('[Popup] ✅ 图片关联已恢复:', associatedImages.size, '条');
        updateMatchingUI();
      } else {
        console.log('[Popup] ℹ️ IndexedDB 中没有图片关联数据');
      }
      db.close();
    };
    request.onerror = () => {
      console.error('[Popup] ❌ IndexedDB 读取失败:', request.error);
      db.close();
    };
  } catch (error) {
    console.error('[Popup] ❌ 恢复图片关联异常:', error);
  }
}

// Clear IndexedDB cache
async function clearAssociatedImagesCache() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete('cache');
    tx.oncomplete = () => db.close();
  } catch (error) {
    console.error('[Popup] ❌ 清除 IndexedDB 缓存失败:', error);
  }
}

// UI Helpers
function setRunningState(running) {
  isRunning = running;
  if (!actionBtn) return;
  const btnIcon = actionBtn.querySelector('.btn-icon');
  const btnText = actionBtn.querySelector('.btn-text');

  if (running) {
    actionBtn.classList.add('stop-mode');
    if (btnIcon) btnIcon.textContent = '⏹';
    if (btnText) btnText.textContent = '停止任务';
  } else {
    actionBtn.classList.remove('stop-mode');
    if (btnIcon) btnIcon.textContent = '🎨';
    if (btnText) btnText.textContent = '批量生成';
  }
}

function showProgress(current, total, message) {
  if (progressArea) progressArea.classList.remove('hidden');

  // Calculate percentage
  const percentage = total > 0 ? (current / total) * 100 : 0;
  if (progressBar) progressBar.style.width = percentage + '%';

  // Update text
  if (progressCount) progressCount.textContent = `已生成 ${current} / 共 ${total} 张`;
  if (currentStatus) currentStatus.textContent = message;
}

function showError(msg) {
  if (!errorMsg) return;
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 5000);
}

function resetUI() {
  setRunningState(false);
  showStatus('Ready', false);
}

function hideError() {
  if (errorMsg) errorMsg.classList.add('hidden');
}

function showStatus(text, active) {
  if (!statusIndicator) return;
  const dot = statusIndicator.querySelector('.dot');
  const txt = statusIndicator.querySelector('.status-text');

  if (!dot || !txt) return;

  txt.textContent = text;
  if (active) {
    dot.style.backgroundColor = '#ffd700'; // Running yellow
    dot.style.boxShadow = '0 0 8px rgba(255, 215, 0, 0.6)';
  } else {
    dot.style.backgroundColor = '#4caf50'; // Ready green
    dot.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.4)';
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateProgress') {
    const { current, total, status } = message;
    showProgress(current, total, status);
    // Sync running state if we get progress updates
    if (!isRunning) setRunningState(true);

    if (current === total) {
      // GA4: Track generation complete
      sendAnalyticsEvent('generation_complete', { image_count: total });

      setTimeout(() => {
        resetUI();
        if (currentStatus) currentStatus.textContent = '全部完成！';
      }, 1000);
    }
  } else if (message.action === 'generationError') {
    showError(message.error);
    resetUI();
  } else if (message.action === 'downloadComplete') {
    // 收到下载完成消息，立即显示去水印弹窗
    console.log('[Popup] 收到 downloadComplete 消息，准备显示弹窗');
    setTimeout(() => {
      showWatermarkPrompt();
    }, 500);
  }
});

// Watermark Modal Elements
const watermarkModal = document.getElementById('watermarkModal');
const modalYesBtn = document.getElementById('modalYesBtn');
const modalNoBtn = document.getElementById('modalNoBtn');
const dontRemindCheckbox = document.getElementById('dontRemindCheckbox');

// Modal Event Handlers
if (modalYesBtn) {
  modalYesBtn.addEventListener('click', () => {
    handleModalClose(true);
  });
}

if (modalNoBtn) {
  modalNoBtn.addEventListener('click', () => {
    handleModalClose(false);
  });
}

function handleModalClose(userSaidYes) {
  // Check if user wants to disable future reminders
  if (dontRemindCheckbox && dontRemindCheckbox.checked) {
    chrome.storage.local.set({ disableWatermarkPrompt: true });
  }

  // Clear the pending flag in background
  chrome.runtime.sendMessage({ action: 'clearWatermarkPrompt' });

  // Hide modal
  if (watermarkModal) watermarkModal.classList.add('hidden');
}

// Watermark Prompt - Show Modal
async function showWatermarkPrompt() {
  // Check if user disabled reminders
  const storage = await chrome.storage.local.get(['disableWatermarkPrompt']);
  if (storage.disableWatermarkPrompt) {
    // User doesn't want reminders, clear the flag silently
    chrome.runtime.sendMessage({ action: 'clearWatermarkPrompt' });
    return;
  }

  // Show the modal
  if (watermarkModal) {
    watermarkModal.classList.remove('hidden');
  }
}

// Restore Status
async function restoreStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTaskStatus' });
    if (response && response.isProcessing) {
      setRunningState(true);
      showStatus('Running', true);
      showProgress(response.currentIndex, response.total, response.status);
    } else {
      resetUI();

      // Check if there's a pending watermark prompt
      const promptResponse = await chrome.runtime.sendMessage({ action: 'checkWatermarkPrompt' });
      if (promptResponse && promptResponse.pending) {
        // Show the prompt
        showWatermarkPrompt();
      }
    }
  } catch (e) {
    console.log('状态恢复失败:', e);
    resetUI();
  }
}

// ============================================
// 动态公告板更新逻辑 (v1.3.0 Upgrade)
// Logic adapted from Sora Assistant to support 'cards' & random rotation
// ============================================

async function updateDynamicFooter() {
  const footerQrImg = document.getElementById('footerQrImg');
  const staticFooterText = document.getElementById('staticFooterText'); // Serves as Title
  const footerText = document.getElementById('footerText'); // Serves as secondary message or hidden
  const footerLink = document.getElementById('footerLink'); // Link 1
  const footerLink2 = document.getElementById('footerLink2'); // Link 2
  const footerLink3 = document.getElementById('footerLink3'); // Link 3 (Legacy/Extra)

  if (!staticFooterText || !footerLink) return;

  const extVersion = chrome.runtime.getManifest().version;
  const configUrl = `https://gt.topgpt.us/nbf_config.json?t=${Date.now()}&v=${extVersion}`;

  const CACHE_KEY = "nbf_footer_cache_v3";
  const DEFAULT_CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours

  // 应用配置到 UI
  const applyConfigToUI = (config) => {
    if (config.show === false) {
      if (document.getElementById('dynamicFooter')) {
        document.getElementById('dynamicFooter').style.display = 'none';
      }
      return;
    }

    // ----------------------------------------------------
    // SHIM: 强制兼容层
    // 如果后端返回的 config 缺少 cards 数组 (Legacy Config),
    // 我们重建 cards 数组以复用新版逻辑。
    // ----------------------------------------------------
    if (!config.cards || !Array.isArray(config.cards) || config.cards.length === 0) {
      console.log("[NBF Shim] Detected legacy config, reconstructing cards...");
      config.cards = [
        {
          name: "Generated Card 1",
          qrTitle: config.qrTitle || "扫码加微进群",
          linkText: config.linkText || "官方博客",
          linkUrl: config.linkUrl || "https://gt.topgpt.us",
          linkColor: config.link1Color, // Assuming legacy might have had this or similar
          linkBold: config.link1Bold,
          linkText2: config.linkText2,
          linkUrl2: config.linkUrl2,
          link2Color: config.link2Color,
          link2Bold: config.link2Bold,
          qrCodeUrl: config.qrCodeUrl
        }
      ];
      // Legacy "showRewardQr" logic is hard to map perfectly to single card rotation 
      // without creating 2 cards basically acting as the rotation.
      // If legacy had rewardTitle/rewardQrUrl, we can add a second card.
      if (config.rewardTitle && config.rewardQrUrl) {
        config.cards.push({
          name: "Generated Card 2",
          qrTitle: config.rewardTitle,
          linkText: config.linkText,
          linkUrl: config.linkUrl,
          linkText2: config.linkText2,
          linkUrl2: config.linkUrl2,
          qrCodeUrl: config.rewardQrUrl
        });
      }
    }

    // ----------------------------------------------------
    // 新版逻辑: 基于 Cards 数组的动态渲染
    // ----------------------------------------------------
    if (config.cards && Array.isArray(config.cards) && config.cards.length > 0) {
      // 1. 随机选择一张卡片 (支持权重或者纯随机，目前用纯随机)
      const randomIndex = Math.floor(Math.random() * config.cards.length);
      const card = config.cards[randomIndex];
      console.log(`[NBF] Displaying Card #${randomIndex + 1}: ${card.name}`);

      // 2. 渲染二维码 (映射到 footerQrImg)
      if (card.qrCodeUrl && footerQrImg) {
        footerQrImg.src = card.qrCodeUrl;
        footerQrImg.style.display = "block";
      } else if (footerQrImg) {
        footerQrImg.style.display = "none";
      }

      // 3. 渲染标题 (映射到 staticFooterText)
      if (staticFooterText) {
        staticFooterText.textContent = card.qrTitle || "";
      }
      // 清空旧版 footerText 以免混淆
      if (footerText) footerText.textContent = "";

      // 4. 渲染 Link 1
      if (footerLink) {
        if (card.linkUrl) {
          footerLink.href = card.linkUrl;
          footerLink.textContent = card.linkText || "查看详情";
          footerLink.classList.remove("hidden");
          footerLink.style.display = "inline-block"; // Ensure visibility
          const color = card.linkColor || "#ffffff";
          footerLink.style.setProperty('color', color, 'important');
          footerLink.style.fontWeight = card.linkBold ? "700" : "normal";
        } else {
          footerLink.style.display = "none";
        }
      }

      // 5. 渲染 Link 2
      if (footerLink2) {
        if (card.linkUrl2) {
          footerLink2.href = card.linkUrl2;
          footerLink2.textContent = card.linkText2 || "更多";
          footerLink2.classList.remove("hidden");
          footerLink2.style.display = "inline-block";
          const color2 = card.link2Color || "#ffffff";
          footerLink2.style.setProperty('color', color2, 'important');
          footerLink2.style.fontWeight = card.link2Bold ? "700" : "normal";
        } else {
          footerLink2.style.display = "none";
        }
      }

      // 6. Apply Alignment (New Feature)
      const linkContainer = document.querySelector('.link-group');
      if (linkContainer) {
        const align = card.linkAlign || "center";
        if (align === 'left') linkContainer.style.justifyContent = 'flex-start';
        else if (align === 'right') linkContainer.style.justifyContent = 'flex-end';
        else linkContainer.style.justifyContent = 'center';
      }

      // 7. Hide Link 3 (Legacy unused in new cards logic)
      if (footerLink3) footerLink3.style.display = "none";

      return;
    }
  };

  try {
    // 1. 尝试读取缓存
    const cacheResult = await new Promise((resolve) => {
      chrome.storage.local.get([CACHE_KEY], (items) => resolve(items));
    });

    if (cacheResult[CACHE_KEY]) {
      const { timestamp, data } = cacheResult[CACHE_KEY];
      let validDuration = DEFAULT_CACHE_DURATION;
      if (data && typeof data.cacheDuration === "number") {
        validDuration = data.cacheDuration * 1000;
      }

      if (Date.now() - timestamp < validDuration) {
        console.log(`[NBF] 使用缓存的公告配置`);
        applyConfigToUI(data);
        return;
      }
    }

    // 2. 从网络获取
    const response = await fetch(configUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const config = await response.json();

    // 3. 应用到 UI
    applyConfigToUI(config);

    // 4. 保存到缓存
    chrome.storage.local.set({
      [CACHE_KEY]: { timestamp: Date.now(), data: config },
    });
    console.log("[NBF] 公告配置已更新并缓存");

  } catch (error) {
    console.warn("[NBF] 动态公告更新跳过 (保持默认):", error.message);
  }
}

// Init Dynamic Content
document.addEventListener('DOMContentLoaded', updateDynamicFooter);

// ============================================
// 演示模式 - 连击版本号开启 (v1.2.1)
// 连续点击版本号 5 次可切换演示模式，隐藏公告栏
// ============================================

// 异步获取演示模式状态
const getDemoMode = () => new Promise(resolve =>
  chrome.storage.local.get(['demoMode'], res => resolve(res.demoMode))
);

// Toast 提示函数
function showDemoModeToast(isEnabled) {
  const line1 = isEnabled ? "🚫 演示模式已开启" : "✅ 演示模式已关闭";
  const line2 = isEnabled ? "(公告隐藏)" : "(公告恢复)";

  const toast = document.createElement('div');
  toast.innerHTML = `${line1}<br>${line2}`;
  toast.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.85);
    color: #fff;
    padding: 16px 32px;
    border-radius: 8px;
    z-index: 99999;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    text-align: center;
    line-height: 1.6;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

// 初始化演示模式
setTimeout(() => {
  const versionBadge = document.querySelector(".version-badge");
  if (!versionBadge) return;

  // 自动同步版本号
  const manifestVersion = chrome.runtime.getManifest().version;
  versionBadge.textContent = `v${manifestVersion}`;

  let clickCount = 0;
  let lastClickTime = 0;
  const CLICK_THRESHOLD = 5;    // 需要点击的次数
  const CLICK_TIMEOUT = 2000;   // 连击超时时间 (ms)

  // 初始化: 页面加载时检查状态并应用
  chrome.storage.local.get(['demoMode'], (res) => {
    if (res.demoMode) {
      const footer = document.getElementById('dynamicFooter');
      if (footer) footer.style.setProperty('display', 'none', 'important');
    }
  });

  // 点击事件监听
  versionBadge.addEventListener('click', (e) => {
    e.preventDefault();
    const now = Date.now();

    // 超时重置计数
    if (now - lastClickTime > CLICK_TIMEOUT) clickCount = 0;
    lastClickTime = now;
    clickCount++;

    console.log(`[Demo] Version Clicked: ${clickCount}`);

    // 达到阈值时切换状态
    if (clickCount >= CLICK_THRESHOLD) {
      chrome.storage.local.get(['demoMode'], (res) => {
        const newState = !res.demoMode;
        chrome.storage.local.set({ demoMode: newState }, () => {
          const footer = document.getElementById('dynamicFooter');
          if (footer) {
            if (newState) {
              footer.style.setProperty('display', 'none', 'important');
            } else {
              footer.style.setProperty('display', 'flex', 'important');
            }
          }

          // Toast 反馈
          showDemoModeToast(newState);
        });
      });
      clickCount = 0;
    }
  });

  // 版本号样式
  versionBadge.style.cursor = "pointer";
}, 500);
