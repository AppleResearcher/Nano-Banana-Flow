// ============================================
// GA4 Analytics Configuration
// ============================================
// 优先使用 config.js 中的配置，如果未加载（如开发环境缺失）则使用空值避免报错
const GA_MEASUREMENT_ID = (typeof GA_CONFIG !== 'undefined') ? GA_CONFIG.MEASUREMENT_ID : '';
const GA_API_SECRET = (typeof GA_CONFIG !== 'undefined') ? GA_CONFIG.API_SECRET : '';

const EXTENSION_VERSION = '1.3.1';

// ============================================
// Debug Mode - 调试日志开关
// ============================================
let debugMode = false;

// 加载 Debug 模式状态
async function loadDebugMode() {
  const res = await chrome.storage.local.get('debugMode');
  debugMode = res.debugMode || false;
  if (debugMode) console.log('[DEBUG] 🐛 Debug 模式已启用');
}

// 调试日志工具函数
function debugLog(...args) {
  if (debugMode) {
    console.log('[DEBUG]', ...args);
  }
}

// 调试日志 - 带时间戳
function debugLogTimed(label, ...args) {
  if (debugMode) {
    console.log(`[DEBUG] [${new Date().toISOString()}] ${label}`, ...args);
  }
}

// 初始化时加载 Debug 模式
loadDebugMode();

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
const promptEnhanceBtn = document.getElementById('promptEnhanceBtn');
const promptLibraryBtn = document.getElementById('promptLibraryBtn');
const savePromptBtn = document.getElementById('savePromptBtn');
const settingsBtn = document.getElementById('settingsBtn');

const txtFileInput = document.getElementById('txtFileInput');
const imageFileInput = document.getElementById('imageFileInput');
const folderInput = document.getElementById('folderInput');
const manualWatermarkInput = document.getElementById('manualWatermarkInput');
const matchDetails = document.getElementById('matchDetails');
const labStatus = document.getElementById('labStatus');

// API Settings Panel Elements
const apiSettingsPanel = document.getElementById('apiSettingsPanel');
const apiBaseUrl = document.getElementById('apiBaseUrl');
const apiKeyInput = document.getElementById('apiKeyInput');
const apiModel = document.getElementById('apiModel');
const toggleApiKey = document.getElementById('toggleApiKey');
const saveApiSettingsBtn = document.getElementById('saveApiSettingsBtn');
const importConfigBtn = document.getElementById('importConfigBtn');
const exportConfigBtn = document.getElementById('exportConfigBtn');
const importConfigFile = document.getElementById('importConfigFile');

// Prompt Library Panel Elements
const promptLibraryPanel = document.getElementById('promptLibraryPanel');
const librarySearchInput = document.getElementById('librarySearchInput');
const libraryList = document.getElementById('libraryList');
const importLibraryBtn = document.getElementById('importLibraryBtn');
const exportLibraryBtn = document.getElementById('exportLibraryBtn');
const clearLibraryBtn = document.getElementById('clearLibraryBtn');
const importLibraryFile = document.getElementById('importLibraryFile');

// Tag Input Panel Elements
const tagInputPanel = document.getElementById('tagInputPanel');
const tagInputField = document.getElementById('tagInputField');
const cancelSavePrompt = document.getElementById('cancelSavePrompt');
const confirmSavePrompt = document.getElementById('confirmSavePrompt');

// State Management
let isRunning = false;
let associatedImages = new Map(); // LineNumber -> File[]
let pendingSaveText = ''; // Text to save when tag panel is shown

// --- File Import Handlers ---

if (importTxtBtn) importTxtBtn.addEventListener('click', () => txtFileInput.click());
if (importImagesBtn) importImagesBtn.addEventListener('click', () => imageFileInput.click());

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
  const prompts = parsePrompts(text);
  promptCount.textContent = `${prompts.length} 条提示词已被识别，随时可以开始`;
}

// ============================================
// 提示词解析器 - 支持多种分隔符和 JSON 格式
// ============================================
// ============================================
// 提示词解析器 - 支持分隔符、JSON块识别、HTML标签清洗
// ============================================
function parsePrompts(text) {
  if (!text || !text.trim()) return [];

  // 1. 清洗常见的 HTML 标签 (针对复制粘贴场景)
  // 移除 <pre...> 和 </pre>，保留内容
  let cleanText = text.replace(/<pre[^>]*>/gi, '').replace(/<\/pre>/gi, '');

  let trimmed = cleanText.trim();

  // 2. 检测强分隔符 (--- 或 ||| 或 ⸻)
  // 只要存在这些分隔符，优先级最高，直接按此分割
  const delimiterRegex = /---|\|\|\||⸻/;
  if (delimiterRegex.test(trimmed)) {
    console.log('[Parser] 检测到强分隔符模式 (---, |||, ⸻)');
    return trimmed.split(delimiterRegex)
      .map(p => p.trim())
      .filter(p => p);
  }

  // 3. 智能按行分割 (括号平衡算法)
  // 解决 JSON 或代码块被换行符错误切分的问题
  const lines = trimmed.split('\n');
  const result = [];
  let currentBuffer = [];
  let braceBalance = 0; // {} 平衡计数

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 统计当前行的括号变化
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;

    braceBalance += openCount;
    braceBalance -= closeCount;

    // 修正负平衡 (防止乱码导致)
    if (braceBalance < 0) braceBalance = 0;

    // 逻辑：
    // 如果当前缓冲区有内容，且当前行为空行，且不在括号内 -> 分割
    // (即：空行仅在非 JSON 块期间作为分隔符)
    if (trimmedLine === '' && braceBalance === 0 && currentBuffer.length > 0) {
      result.push(currentBuffer.join('\n').trim());
      currentBuffer = [];
    } else {
      // 只要有内容，或者在括号内（保留空行），就加入缓冲区
      if (trimmedLine !== '' || braceBalance > 0) {
        currentBuffer.push(line);
      }
    }
  }

  // 处理最后的缓冲区
  if (currentBuffer.length > 0) {
    result.push(currentBuffer.join('\n').trim());
  }

  // 4. 二次处理：尝试解析结果中的 JSON
  return result.filter(p => p).map(block => {
    // 如果该块看起来像是 JSON，尝试解析并提取 prompt
    if (block.trim().startsWith('{') || block.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(block);
        if (parsed.prompt) return parsed.prompt; // 提取 prompt 字段
        // 如果是数组，这里其实已经被当作一个 block 了，可能用户想把数组当多个任务？
        // 但根据目前逻辑，既然没被空行分割，就视为一个整体。 
        // 如果需要处理数组展开，可以在这里做，但会增加复杂度。
        // 目前策略：保持原样 stringify 或作为普通文本
        return block.trim();
      } catch (e) {
        return block.trim();
      }
    }
    return block.trim();
  });
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

  // 首次使用引导
  chrome.storage.local.get(['guideCompleted'], (res) => {
    if (!res.guideCompleted) {
      showOnboardingGuide();
    }
  });
});

// ============================================
// 首次使用引导 - 轮播式 (v1.3.0)
// ============================================
function showOnboardingGuide() {
  const slides = [
    {
      icon: '⚡',
      title: '一键去水印',
      content: `
        批量生成完成后，点击 <b>「⚡去水印」</b> 按钮<br>
        选择需要处理的图片，自动去除 Gemini 水印<br>
        处理后的文件名添加 <code>_wr</code> 后缀
      `,
      step: '第 1/3 步'
    },
    {
      icon: '👋',
      title: '欢迎使用大香蕉！',
      content: `
        <b>📂 保存目录</b>：可自定义下载路径<br>
        <b>📄 导入提示词</b>：从 TXT 文件批量导入<br>
        <b>🖼️ 导入图片</b>：支持图生图功能
      `,
      step: '第 2/3 步'
    },
    {
      icon: '🖼️',
      title: '智能图生图',
      content: `
        图片文件名以数字开头即可自动匹配：<br>
        <code>1_cat.jpg</code> → 匹配第 1 行提示词<br>
        <code>2_dog.png</code> → 匹配第 2 行提示词<br>
        支持 jpg/png/webp/gif 等格式
      `,
      step: '第 3/3 步'
    }
  ];

  let currentSlide = 0;

  // 创建遮罩
  const guideModal = document.createElement('div');
  guideModal.id = 'nbf-guide-modal';
  guideModal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 99999;
    display: flex; align-items: center; justify-content: center;
  `;

  const renderSlide = () => {
    const s = slides[currentSlide];
    const isFirst = currentSlide === 0;
    const isLast = currentSlide === slides.length - 1;

    guideModal.innerHTML = `
      <div style="
        background: #fff; padding: 24px; border-radius: 12px;
        max-width: 320px; text-align: center;
      ">
        <div style="font-size: 32px; margin-bottom: 12px;">${s.icon}</div>
        <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 16px;">${s.title}</div>
        <div style="font-size: 13px; color: #555; line-height: 1.8; text-align: left; margin-bottom: 20px;">
          ${s.content}
        </div>
        <div style="font-size: 11px; color: #888; margin-bottom: 16px;">${s.step}</div>
        <div style="display: flex; gap: 12px; justify-content: center;">
          ${!isFirst ? '<button id="guide-prev" style="padding: 8px 16px; background: #f0f0f0; color: #333; border: none; border-radius: 6px; cursor: pointer;">← 上一步</button>' : ''}
          <button id="guide-next" style="padding: 8px 16px; background: #f59e0b; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
            ${isLast ? '开始使用 🚀' : '下一步 →'}
          </button>
        </div>
      </div>
    `;

    // 事件绑定
    const prevBtn = guideModal.querySelector('#guide-prev');
    const nextBtn = guideModal.querySelector('#guide-next');

    if (prevBtn) {
      prevBtn.onclick = () => {
        currentSlide--;
        renderSlide();
      };
    }

    nextBtn.onclick = () => {
      if (isLast) {
        chrome.storage.local.set({ guideCompleted: true });
        guideModal.remove();
      } else {
        currentSlide++;
        renderSlide();
      }
    };
  };

  document.body.appendChild(guideModal);
  renderSlide();
}

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

  // 使用 parsePrompts 统一解析提示词
  const prompts = parsePrompts(input);
  const tasks = [];

  prompts.forEach((prompt, index) => {
    const taskIndex = index + 1;
    tasks.push({
      prompt: prompt,
      lineNum: taskIndex, // 使用解析后的序号
      images: associatedImages.get(taskIndex) || [] // 按逻辑索引取图
    });
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
  // 调试日志
  debugLog('📝 详细任务信息:');
  tasks.forEach((t, i) => {
    console.log(`[Popup] 任务 ${i + 1}: 提示词="${t.prompt.substring(0, 20)}..." , 行号=${t.lineNum}, 关联图片=${t.images.length}张`);
    debugLog(`  任务 #${i + 1}:`, {
      prompt: t.prompt.substring(0, 50) + (t.prompt.length > 50 ? '...' : ''),
      imageCount: t.images.length,
      imageNames: t.images.map(f => f.name || 'unknown')
    });
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

    // Prepare Tasks: Compress large images and convert to Base64
    const processedTasks = await Promise.all(tasks.map(async (task) => {
      const imgData = await Promise.all(task.images.map(async (file) => {
        // 如果图片大于 1MB，先压缩
        if (file.size > 1024 * 1024) {
          const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
          console.log(`[Popup] 🗜️ 压缩大图: ${file.name} (${originalSizeMB}MB)`);
          debugLog('🖼️ 图片压缩详情:', {
            fileName: file.name,
            originalSize: `${originalSizeMB}MB`,
            type: file.type
          });
          const compressedFile = await compressImage(file, 1024);
          const newSizeKB = (compressedFile.size / 1024).toFixed(0);
          console.log(`[Popup] ✅ 压缩后: ${newSizeKB}KB`);
          debugLog('✅ 压缩完成:', {
            newSize: `${newSizeKB}KB`,
            compressionRatio: `${((1 - compressedFile.size / file.size) * 100).toFixed(0)}%`
          });
          return fileToBase64(compressedFile);
        }
        return fileToBase64(file);
      }));
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

// 压缩图片：按最长边缩放到指定尺寸
async function compressImage(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 计算缩放比例
        let { width, height } = img;
        const longestSide = Math.max(width, height);

        if (longestSide <= maxSize) {
          // 不需要缩放，直接返回原文件
          resolve(file);
          return;
        }

        const scale = maxSize / longestSide;
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        // 使用 Canvas 缩放
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 转为 Blob
        canvas.toBlob((blob) => {
          if (blob) {
            // 创建新的 File 对象保留原文件名
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/jpeg', 0.85); // JPEG 质量 85%
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(reader.error);
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
// 演示模式 - 连击版本号开启 (v1.3.0)
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

  // ============================================
  // Debug Mode - Alt+连击版本号 3 次开启
  // ============================================
  let debugClickCount = 0;
  let lastDebugClickTime = 0;
  const DEBUG_CLICK_THRESHOLD = 3;

  versionBadge.addEventListener('click', (e) => {
    // 只有按住 Alt 键时才触发 Debug Mode
    if (!e.altKey) return;

    const now = Date.now();
    if (now - lastDebugClickTime > CLICK_TIMEOUT) debugClickCount = 0;
    lastDebugClickTime = now;
    debugClickCount++;

    console.log(`[Debug] Alt+Click: ${debugClickCount}`);

    if (debugClickCount >= DEBUG_CLICK_THRESHOLD) {
      debugMode = !debugMode;
      chrome.storage.local.set({ debugMode }, () => {
        const toast = document.createElement('div');
        toast.textContent = debugMode ? '🐛 Debug 模式已开启' : '🐛 Debug 模式已关闭';
        toast.style.cssText = `
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          background: ${debugMode ? '#10b981' : '#6b7280'};
          color: #fff; padding: 12px 24px; border-radius: 8px;
          z-index: 99999; font-size: 14px; font-weight: bold;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
      });
      debugClickCount = 0;
    }
  });
}, 500);

// ============================================
// API Settings & Advanced Features Logic
// ============================================

// --- Panel Toggle Logic ---
function showPanel(panel) {
  if (panel) panel.classList.remove('hidden');
}

function hidePanel(panel) {
  if (panel) panel.classList.add('hidden');
}

document.querySelectorAll('.panel-close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.getAttribute('data-close');
    const panel = document.getElementById(panelId);
    hidePanel(panel);
  });
});

if (settingsBtn) settingsBtn.addEventListener('click', () => {
  loadApiSettings();
  showPanel(apiSettingsPanel);
});

if (promptLibraryBtn) promptLibraryBtn.addEventListener('click', () => {
  loadPromptLibrary();
  showPanel(promptLibraryPanel);
});

if (savePromptBtn) savePromptBtn.addEventListener('click', () => {
  const text = promptsTextarea.value.trim();
  if (!text) {
    showError('没有可保存的提示词');
    return;
  }
  pendingSaveText = text;
  tagInputField.value = '';
  showPanel(tagInputPanel);
});

if (cancelSavePrompt) cancelSavePrompt.addEventListener('click', () => hidePanel(tagInputPanel));

// --- API Settings Logic ---

const DEFAULT_API_URL = 'https://api.siliconflow.cn/v1';
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3';

function loadApiSettings() {
  chrome.storage.local.get(['nbfApiBaseUrl', 'nbfApiKey', 'nbfApiModel'], (res) => {
    apiBaseUrl.value = res.nbfApiBaseUrl || '';
    apiKeyInput.value = res.nbfApiKey || '';
    apiModel.value = res.nbfApiModel || '';
  });
}

if (saveApiSettingsBtn) saveApiSettingsBtn.addEventListener('click', () => {
  const settings = {
    nbfApiBaseUrl: apiBaseUrl.value.trim(),
    nbfApiKey: apiKeyInput.value.trim(),
    nbfApiModel: apiModel.value.trim()
  };
  chrome.storage.local.set(settings, () => {
    alert('API 设置已保存！');
    hidePanel(apiSettingsPanel);
  });
});

if (toggleApiKey) toggleApiKey.addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});



// --- Prompt Library Logic ---

function loadPromptLibrary() {
  chrome.storage.local.get(['nbfPromptLibrary'], (res) => {
    const library = res.nbfPromptLibrary || [];
    renderLibraryList(library);
  });
}

function renderLibraryList(list) {
  if (!libraryList) return;
  libraryList.innerHTML = '';

  if (list.length === 0) {
    libraryList.innerHTML = '<div class="empty-state">暂无保存的提示词</div>';
    return;
  }

  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'library-item';

    // Tags HTML
    const tagsHtml = (item.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');

    el.innerHTML = `
      <div class="library-item-text" title="${item.text}">${item.text.substring(0, 150)}${item.text.length > 150 ? '...' : ''}</div>
      <div class="library-item-tags">${tagsHtml}</div>
      <div class="library-item-actions">
        <button class="btn-insert" data-id="${item.id}">插入</button>
        <button class="btn-delete" data-id="${item.id}">删除</button>
      </div>
    `;
    libraryList.appendChild(el);
  });

  // Attach events
  libraryList.querySelectorAll('.btn-insert').forEach(btn => {
    btn.addEventListener('click', (e) => insertPromptFromLibrary(parseInt(e.target.dataset.id)));
  });
  libraryList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => deletePromptFromLibrary(parseInt(e.target.dataset.id)));
  });
}

function insertPromptFromLibrary(id) {
  chrome.storage.local.get(['nbfPromptLibrary'], (res) => {
    const library = res.nbfPromptLibrary || [];
    const item = library.find(it => it.id === id);
    if (item) {
      const currentVal = promptsTextarea.value;
      promptsTextarea.value = currentVal ? currentVal + '\n\n' + item.text : item.text;
      updatePromptCount(promptsTextarea.value);
      hidePanel(promptLibraryPanel);
      showToast('提示词已插入');
    }
  });
}

function deletePromptFromLibrary(id) {
  if (!confirm('确定删除这条提示词吗？')) return;

  chrome.storage.local.get(['nbfPromptLibrary'], (res) => {
    let library = res.nbfPromptLibrary || [];
    library = library.filter(it => it.id !== id);
    chrome.storage.local.set({ nbfPromptLibrary: library }, () => {
      loadPromptLibrary(); // Reload list
    });
  });
}

if (confirmSavePrompt) confirmSavePrompt.addEventListener('click', () => {
  const tags = tagInputField.value.split(/[,，]/).map(t => t.trim()).filter(Boolean);

  const newItem = {
    id: Date.now(),
    text: pendingSaveText,
    tags: tags,
    createdAt: Date.now()
  };

  chrome.storage.local.get(['nbfPromptLibrary'], (res) => {
    const library = res.nbfPromptLibrary || [];
    library.unshift(newItem); // Add to top
    chrome.storage.local.set({ nbfPromptLibrary: library }, () => {
      showToast('提示词已保存到库');
      hidePanel(tagInputPanel);
    });
  });
});

if (librarySearchInput) librarySearchInput.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  chrome.storage.local.get(['nbfPromptLibrary'], (res) => {
    const library = res.nbfPromptLibrary || [];
    if (!q) {
      renderLibraryList(library);
      return;
    }

    const keywords = q.split(/\s+/).filter(Boolean);
    const filtered = library.filter(it => {
      const combined = (it.text + ' ' + (it.tags || []).join(' ')).toLowerCase();
      // AND Search logic
      return keywords.every(kw => combined.includes(kw));
    });
    renderLibraryList(filtered);
  });
});

if (clearLibraryBtn) clearLibraryBtn.addEventListener('click', () => {
  if (confirm('⚠️ 确定要清空所有保存的提示词吗？此操作不可恢复！')) {
    chrome.storage.local.set({ nbfPromptLibrary: [] }, () => {
      loadPromptLibrary();
    });
  }
});

// --- Prompt Enhancement Logic ---

if (promptEnhanceBtn) promptEnhanceBtn.addEventListener('click', async () => {
  const text = promptsTextarea.value.trim();
  if (!text) {
    showError('请输入需要优化的提示词');
    return;
  }

  // Check API config
  const settings = await chrome.storage.local.get(['nbfApiBaseUrl', 'nbfApiKey', 'nbfApiModel']);
  if (!settings.nbfApiKey) {
    showError('请先点击右上角 ⚙️ 配置 API Key');
    showPanel(apiSettingsPanel);
    return;
  }

  const baseUrl = settings.nbfApiBaseUrl || DEFAULT_API_URL;
  const apiKey = settings.nbfApiKey;
  const model = settings.nbfApiModel || DEFAULT_MODEL;

  // Show loading state
  const originalBtnText = promptEnhanceBtn.textContent;
  promptEnhanceBtn.textContent = '✨ 优化中...';
  promptEnhanceBtn.disabled = true;

  try {
    // Construct System Prompt (Hidden)
    //const systemPrompt = "你是 AI 绘画提示词专家。请优化用户的提示词，使其更适合生成高质量图片。请直接输出优化后的英文提示词，不要包含任何解释或Markdown格式。";
    const systemPrompt = "你是 AI 绘画提示词专家。请分析用户的原始提示词，保留核心意图，并补充细节（如光照、构图、风格、材质等），使其更适合生成高质量图片。请直接输出优化后的英文提示词，不要包含任何解释或Markdown格式。";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请优化以下提示词:\n${text}` }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const improvedPrompt = data.choices?.[0]?.message?.content;

    if (improvedPrompt) {
      promptsTextarea.value = improvedPrompt;
      updatePromptCount(improvedPrompt);
      showToast('✨ 提示词已优化！');
    } else {
      throw new Error('API 返回内容为空');
    }

  } catch (error) {
    console.error('Prompt Enhancement Failed:', error);
    showError(`优化失败: ${error.message}`);
  } finally {
    promptEnhanceBtn.textContent = originalBtnText;
    promptEnhanceBtn.disabled = false;
  }
});

// --- Import/Export Config Logic ---

if (exportConfigBtn) exportConfigBtn.addEventListener('click', () => {
  if (!confirm('导出文件将包含包含您的 API Key，请注意保管！\n\n确定导出配置吗？')) return;

  chrome.storage.local.get(
    ['nbfApiBaseUrl', 'nbfApiKey', 'nbfApiModel', 'nbfSystemPrompt', 'nbfPromptLibrary'],
    (res) => {
      const exportData = {
        version: "1.0",
        exportTime: new Date().toISOString(),
        settings: {
          gptBaseUrl: res.nbfApiBaseUrl || "",
          gptApiKey: res.nbfApiKey || "",
          gptModel: res.nbfApiModel || "",
          customSystemPrompt: res.nbfSystemPrompt || ""
        },
        promptLibrary: res.nbfPromptLibrary || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nbf-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  );
});

if (importConfigBtn) importConfigBtn.addEventListener('click', () => importConfigFile.click());

if (importConfigFile) importConfigFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.settings) throw new Error("无效的配置文件格式");

      const importedSettings = {
        nbfApiBaseUrl: data.settings.gptBaseUrl || "",
        nbfApiKey: data.settings.gptApiKey || "",
        nbfApiModel: data.settings.gptModel || "",
        nbfSystemPrompt: data.settings.customSystemPrompt || ""
      };

      // Merge Library
      if (data.promptLibrary && Array.isArray(data.promptLibrary)) {
        // Simple merge (overwrite if ID exists, else append?? No, let's just use ID to dedup or verify)
        // Ideally we fetch current lib first.
        chrome.storage.local.get(['nbfPromptLibrary'], (curr) => {
          const currentLib = curr.nbfPromptLibrary || [];
          // Merge logic: Add new items that don't exist
          const newItems = data.promptLibrary.filter(ni => !currentLib.some(ci => ci.id === ni.id));
          const mergedLib = [...newItems, ...currentLib]; // Add new ones to top or bottom? Using top for now.
          importedSettings.nbfPromptLibrary = mergedLib;

          chrome.storage.local.set(importedSettings, () => {
            alert(`配置已导入！\n新增了 ${newItems.length} 条提示词`);
            loadApiSettings(); // refresh UI
            hidePanel(apiSettingsPanel);
          });
        });
      } else {
        chrome.storage.local.set(importedSettings, () => {
          alert('配置已导入！');
          loadApiSettings();
          hidePanel(apiSettingsPanel);
        });
      }

    } catch (err) {
      alert("导入失败：" + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset input
});

if (importLibraryBtn) importLibraryBtn.addEventListener('click', () => importLibraryFile.click());

if (importLibraryFile) importLibraryFile.addEventListener('change', (e) => {
  // Assuming simple JSON array import for library only
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      let itemsToAdd = [];
      if (Array.isArray(data)) {
        itemsToAdd = data;
      } else if (data.promptLibrary && Array.isArray(data.promptLibrary)) {
        itemsToAdd = data.promptLibrary;
      } else {
        throw new Error('未找到有效的提示词列表数组');
      }

      if (itemsToAdd.length > 0) {
        chrome.storage.local.get(['nbfPromptLibrary'], (curr) => {
          const currentLib = curr.nbfPromptLibrary || [];
          // Deduplicate by ID if present, or just append all
          // To be safe, let's re-generate IDs if they clash or are missing
          const validItems = itemsToAdd.map(it => ({
            id: it.id || Date.now() + Math.random(),
            text: it.text || '',
            tags: it.tags || [],
            createdAt: it.createdAt || Date.now()
          })).filter(it => it.text);

          const finalLib = [...validItems, ...currentLib];
          chrome.storage.local.set({ nbfPromptLibrary: finalLib }, () => {
            alert(`成功导入 ${validItems.length} 条提示词`);
            loadPromptLibrary();
          });
        });
      }
    } catch (err) {
      alert('导入失败: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

if (exportLibraryBtn) exportLibraryBtn.addEventListener('click', () => {
  chrome.storage.local.get(['nbfPromptLibrary'], (res) => {
    const lib = res.nbfPromptLibrary || [];
    const blob = new Blob([JSON.stringify(lib, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nbf-prompts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

