// DOM Elements
const promptsTextarea = document.getElementById('promptInput');
const promptCount = document.getElementById('promptCount');
const directoryInput = document.getElementById('directoryInput');
const actionBtn = document.getElementById('actionBtn');
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
const matchDetails = document.getElementById('matchDetails'); // New

// State Management
let isRunning = false;
let associatedImages = new Map(); // LineNumber -> File[]

// --- File Import Handlers ---

if (importTxtBtn) importTxtBtn.addEventListener('click', () => txtFileInput.click());
if (importImagesBtn) importImagesBtn.addEventListener('click', () => imageFileInput.click());
if (importFolderBtn) importFolderBtn.addEventListener('click', () => folderInput.click()); // New

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

  if (totalImgs > 0) {
    if (matchStatus) {
      matchStatus.textContent = `✅ 已关联 ${totalImgs} 张参考图 (覆盖 ${totalLines} 条任务)`;
      matchStatus.classList.remove('hidden');
    }

    // 生成详细预览
    matchDetails.innerHTML = '';
    matchDetails.classList.remove('hidden');

    // 只显示有图片的行，按行号排序
    const sortedKeys = Array.from(associatedImages.keys()).sort((a, b) => a - b);

    sortedKeys.forEach(lineNum => {
      const imgs = associatedImages.get(lineNum);
      const row = document.createElement('div');
      row.className = 'match-row';
      row.style.fontSize = '12px';
      row.style.marginTop = '4px';
      row.style.color = '#ccc';

      const filenames = imgs.map(f => f.name).join(', ');
      // 这里的 lineNum 实际上是 Task ID
      row.textContent = `Task ${lineNum}: [${imgs.length}图] ${filenames}`;
      matchDetails.appendChild(row);
    });

  } else {
    if (matchStatus) matchStatus.classList.add('hidden');
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

// Helpers
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
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
  const percentage = total > 0 ? (current / total) * 100 : 0;
  if (progressBar) progressBar.style.width = percentage + '%';
  if (progressCount) progressCount.textContent = `${current} / ${total}`;
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
      setTimeout(() => {
        resetUI();
        if (currentStatus) currentStatus.textContent = '全部完成！';
      }, 1000);
    }
  } else if (message.action === 'generationError') {
    showError(message.error);
    resetUI();
  }
});

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
    }
  } catch (e) {
    console.log('状态恢复失败:', e);
    resetUI();
  }
}
