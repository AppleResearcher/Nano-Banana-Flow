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
const txtFileInput = document.getElementById('txtFileInput');
const imageFileInput = document.getElementById('imageFileInput');
const matchStatus = document.getElementById('matchStatus');

// State Management
let isRunning = false;
let associatedImages = new Map(); // LineNumber -> File[]

// --- File Import Handlers ---

importTxtBtn.addEventListener('click', () => txtFileInput.click());
importImagesBtn.addEventListener('click', () => imageFileInput.click());

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

imageFileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  console.log('[Popup] 📸 选择了图片文件:', files.length, '张');
  if (files.length === 0) return;

  associatedImages.clear();
  files.forEach(file => {
    console.log('[Popup] 📸 处理文件:', file.name);
    // Regex: Match numbers at start of filename
    const match = file.name.match(/^(\d+)/);
    if (match) {
      const lineNum = parseInt(match[1], 10);
      console.log('[Popup] 📸 匹配成功: 文件', file.name, '-> 行号', lineNum);
      if (!associatedImages.has(lineNum)) {
        associatedImages.set(lineNum, []);
      }
      associatedImages.get(lineNum).push(file);
    } else {
      console.warn('[Popup] ⚠️ 文件名未匹配:', file.name, '(需以数字开头，如 1_image.jpg)');
    }
  });
  console.log('[Popup] 📸 匹配结果:', Object.fromEntries(associatedImages));
  updateMatchingUI();
});

function updateMatchingUI() {
  const totalImgs = Array.from(associatedImages.values()).flat().length;
  const totalLines = associatedImages.size;
  if (totalImgs > 0) {
    matchStatus.textContent = `已关联 ${totalImgs} 张参考图 (共涉及 ${totalLines} 条提示词)`;
    matchStatus.classList.remove('hidden');
  } else {
    matchStatus.classList.add('hidden');
  }
}

// --- Original Logic ---

// Auto-resize textarea and update count
promptsTextarea.addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = (this.scrollHeight) + 'px';
  chrome.storage.local.set({ lastPrompts: this.value });
  updatePromptCount(this.value);
  // Re-sync image matching UI if prompt count changes? 
  // For now just keep simple.
});

function updatePromptCount(text) {
  const prompts = text.split('\n').filter(line => line.trim() !== '');
  promptCount.textContent = `${prompts.length} 条提示词已被识别，随时可以开始`;
}

// Clear Prompts
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

// Save directory to storage
directoryInput.addEventListener('input', function () {
  chrome.storage.local.set({ saveDirectory: this.value });
});

// Restore state on load
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['lastPrompts', 'saveDirectory'], (result) => {
    if (result.lastPrompts) {
      promptsTextarea.value = result.lastPrompts;
      // Trigger resize
      promptsTextarea.style.height = 'auto';
      promptsTextarea.style.height = (promptsTextarea.scrollHeight) + 'px';
      updatePromptCount(promptsTextarea.value);
    }
    if (result.saveDirectory) {
      directoryInput.value = result.saveDirectory;
    }
  });

  restoreStatus();
});

// Unified Action Button Click Handler
actionBtn.addEventListener('click', async () => {
  if (isRunning) {
    // Stop Logic
    handleStop();
  } else {
    // Start Logic
    handleStart();
  }
});

async function handleStart() {
  console.log('[Popup] 📌 handleStart 被调用');

  const input = promptsTextarea.value.trim();
  const directory = directoryInput.value.trim();

  if (!input) {
    showError('请输入至少一个提示词');
    return;
  }

  // Get raw lines to preserve empty lines for indexing if needed, 
  // but usually users want 1-based index matching visible lines.
  const lines = input.split('\n');
  const tasks = [];

  let validTaskCount = 0;
  lines.forEach((line, index) => {
    const prompt = line.trim();
    if (prompt) {
      validTaskCount++;
      const lineNum = index + 1;
      tasks.push({
        prompt: prompt,
        lineNum: lineNum,
        images: associatedImages.get(lineNum) || []
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
      currentStatus.textContent = '任务已中止';
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
  const btnIcon = actionBtn.querySelector('.btn-icon');
  const btnText = actionBtn.querySelector('.btn-text');

  if (running) {
    actionBtn.classList.add('stop-mode');
    btnIcon.textContent = '⏹';
    btnText.textContent = '停止任务';
  } else {
    actionBtn.classList.remove('stop-mode');
    btnIcon.textContent = '🎨';
    btnText.textContent = '批量生成';
  }
}

function showProgress(current, total, message) {
  progressArea.classList.remove('hidden');
  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressBar.style.width = percentage + '%';
  progressCount.textContent = `${current} / ${total}`;
  currentStatus.textContent = message;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 5000);
}

function resetUI() {
  setRunningState(false);
  showStatus('Ready', false);
}

function hideError() {
  errorMsg.classList.add('hidden');
}

function showStatus(text, active) {
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
        currentStatus.textContent = '全部完成！';
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
