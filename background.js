// background.js - V1.1.4 完整版
// 大香蕉批量生图 (Nano Banana Flow)

console.log('🍌 Nano Banana Flow Service Worker 已启动');

// 任务队列
let taskQueue = [];
let isProcessing = false;
let currentTaskIndex = 0;
let currentTabId = null;
let pendingWatermarkPrompt = false; // 新增: 标记是否有待处理的去水印提示

// ============================================
// Debug Mode - 调试日志
// ============================================
let debugMode = false;

// 加载 Debug 模式状态
async function loadDebugMode() {
    const res = await chrome.storage.local.get('debugMode');
    debugMode = res.debugMode || false;
    if (debugMode) console.log('[BG][DEBUG] 🐛 Debug 模式已启用');
}

// 调试日志工具函数
function debugLog(...args) {
    if (debugMode) {
        console.log('[BG][DEBUG]', ...args);
    }
}

// 初始化时加载 Debug 模式
loadDebugMode();

// 监听 storage 变化以实时同步 Debug 状态
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.debugMode) {
        debugMode = changes.debugMode.newValue || false;
        console.log('[BG] Debug 模式已更新:', debugMode);
    }
});

// 监听安装/更新事件
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('✅ Nano Banana Flow Service Worker Installed, reason:', details.reason);

    // 安装或更新时，向已打开的 Gemini 页面注入刷新提示
    if (details.reason === 'install' || details.reason === 'update') {
        try {
            const tabs = await chrome.tabs.query({ url: '*://gemini.google.com/*' });

            for (const tab of tabs) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: showUpdateNotification,
                    args: [details.reason]
                }).catch(() => {
                    console.log('[BG] 无法注入刷新提示到标签页:', tab.id);
                });
            }
        } catch (e) {
            console.log('[BG] 查询标签页失败:', e);
        }
    }
});

// 更新刷新提示弹窗
function showUpdateNotification(reason) {
    // 防止重复注入
    if (document.getElementById('nbf-update-modal-backdrop')) return;

    const isInstall = reason === 'install';
    const title = isInstall ? '🍌 大香蕉已安装！' : '🍌 大香蕉已更新！';
    const message = isInstall
        ? '欢迎使用 Nano Banana Flow！请刷新此页面以启用插件功能。'
        : '插件已更新到最新版本，请刷新此页面以应用新功能。';

    // 创建遮罩
    const backdrop = document.createElement('div');
    backdrop.id = 'nbf-update-modal-backdrop';
    backdrop.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6); z-index: 99998;
    display: flex; align-items: center; justify-content: center;
  `;

    // 创建弹窗
    backdrop.innerHTML = `
    <div style="
      width: 360px; background: #fff; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3); overflow: hidden;
    ">
      <div style="background: #333; color: #fff; padding: 16px 20px; font-size: 15px; font-weight: 600;">
        ${title}
      </div>
      <div style="padding: 24px 20px; font-size: 14px; color: #333; line-height: 1.6;">
        ${message}
      </div>
      <div style="
        background: #f9f9f9; border-top: 1px solid #eee;
        padding: 12px 20px; display: flex; gap: 12px; justify-content: flex-end;
      ">
        <button id="nbf-later-btn" style="
          padding: 8px 16px; border: 1px solid #ccc; background: #fff;
          color: #333; border-radius: 6px; cursor: pointer; font-size: 13px;
        ">稍后</button>
        <button id="nbf-refresh-btn" style="
          padding: 8px 16px; border: none; background: #f59e0b;
          color: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
        ">刷新页面</button>
      </div>
    </div>
  `;

    document.body.appendChild(backdrop);

    // 事件绑定
    document.getElementById('nbf-later-btn').onclick = () => backdrop.remove();
    document.getElementById('nbf-refresh-btn').onclick = () => location.reload();
}

// ========== 核心：消息监听器 ==========
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[BG] 收到消息:', request.action);

    // --- 处理启动生成请求 ---
    if (request.action === 'startGeneration') {
        console.log('[BG] 启动生成任务，任务数量:', request.tasks.length);

        if (isProcessing) {
            sendResponse({ success: false, error: '已有任务正在执行中' });
            return false;
        }

        // 保存 tabId
        currentTabId = request.tabId;

        // 初始化任务队列
        taskQueue = request.tasks.map((task, index) => ({
            prompt: task.prompt,
            images: task.images, // 新增：保存图片数据 (Base64)
            directory: request.directory,
            index: index + 1,
            total: request.tasks.length,
            status: 'pending'
        }));

        currentTaskIndex = 0;
        isProcessing = true;

        // 开始处理队列
        processQueue();

        sendResponse({ success: true });
        return false; // 同步返回
    }

    // --- 处理高清图下载请求 ---
    if (request.action === 'download_hq') {
        console.log(`[BG] 📥 接收到下载任务: ${request.filename}`);
        console.log(`[BG] 📥 下载URL: ${request.url?.substring(0, 100)}...`);

        if (!request.url) {
            console.error(`[BG] ❌ URL为空，无法下载`);
            sendResponse({ status: 'error', message: 'URL为空' });
            return true;
        }

        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            conflictAction: 'uniquify',
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error(`❌ [BG] 下载失败: ${chrome.runtime.lastError.message}`);
                sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
            } else {
                console.log(`✅ [BG] 下载已启动 (ID: ${downloadId})`);
                sendResponse({ status: 'success', downloadId: downloadId });
            }
        });

        return true; // 保持异步通道
    }

    // --- 处理停止任务 ---
    if (request.action === 'stopTask') {
        console.log('[BG] 收到停止指令');

        // 清空队列
        taskQueue = [];
        isProcessing = false;
        currentTaskIndex = 0;

        // 通知 content script 停止
        if (currentTabId) {
            chrome.tabs.sendMessage(currentTabId, { action: 'stopTask' }).catch(() => {
                console.log('[BG] Content script 可能已关闭');
            });
        }

        currentTabId = null;

        sendResponse({ success: true });
        return false;
    }

    // --- 处理获取任务状态 ---
    if (request.action === 'getTaskStatus') {
        sendResponse({
            isProcessing: isProcessing,
            currentIndex: currentTaskIndex,
            total: taskQueue.length,
            status: isProcessing ? `正在生成第 ${currentTaskIndex + 1} 张图片...` : '空闲'
        });
        return false;
    }

    // --- 检查是否有待处理的去水印提示 ---
    if (request.action === 'checkWatermarkPrompt') {
        sendResponse({ pending: pendingWatermarkPrompt });
        return false;
    }

    // --- 清除待处理的去水印提示标记 ---
    if (request.action === 'clearWatermarkPrompt') {
        pendingWatermarkPrompt = false;
        sendResponse({ success: true });
        return false;
    }

    // 未知消息类型
    console.warn('[BG] 未知消息类型:', request.action);
    return false;
});

// ========== 处理任务队列 ==========
async function processQueue() {
    if (currentTaskIndex >= taskQueue.length) {
        // 所有任务完成
        console.log('✅ [BG] 所有任务完成！');
        isProcessing = false;
        currentTabId = null;
        pendingWatermarkPrompt = true; // 标记需要弹出去水印提示

        // 通知 popup 完成
        notifyProgress(taskQueue.length, taskQueue.length, '全部完成！');

        // 直接通知 popup 显示去水印弹窗
        chrome.runtime.sendMessage({ action: 'downloadComplete' }).catch(() => {
            console.log('[BG] Popup 可能已关闭，稍后打开时会检查 pendingWatermarkPrompt');
        });
        return;
    }

    const task = taskQueue[currentTaskIndex];
    console.log(`[BG] 处理任务 ${task.index}/${task.total}: ${task.prompt}`);

    // 更新进度
    notifyProgress(currentTaskIndex, task.total, `正在生成第 ${task.index} 张图片...`);

    try {
        // 验证 tab 是否有效
        if (!currentTabId) {
            throw new Error('TabId 未设置');
        }
        console.log('[BG] 🔍 当前 TabId:', currentTabId);

        const tab = await chrome.tabs.get(currentTabId);
        console.log('[BG] 🔍 Tab 信息:', tab?.url);

        if (!tab || !tab.url || !tab.url.includes('gemini.google.com')) {
            throw new Error('请确保 Gemini 页面仍然打开');
        }

        console.log('[BG] 📤 准备发送消息给 content script...');

        // 发送消息给 content script 执行生成
        const response = await chrome.tabs.sendMessage(currentTabId, {
            action: 'generateImage',
            prompt: task.prompt,
            images: task.images, // 新增：传递图片数据
            directory: task.directory,
            index: task.index,
            total: task.total
        });

        console.log('[BG] 📥 收到 content script 响应:', response);

        if (response && response.success) {
            task.status = 'completed';
            console.log(`✅ [BG] 任务 ${task.index} 完成`);

            // 更新进度
            currentTaskIndex++;
            notifyProgress(currentTaskIndex, task.total, `已完成 ${currentTaskIndex} 张`);

            // 等待一下再处理下一个
            await sleep(2000);

            // 继续处理下一个
            processQueue();
        } else {
            throw new Error(response?.error || '生成失败');
        }

    } catch (error) {
        console.error(`❌ [BG] 任务 ${task.index} 失败:`, error);
        task.status = 'failed';

        // 通知 popup 错误
        notifyError(`第 ${task.index} 张图片生成失败: ${error.message}`);

        // 停止处理
        isProcessing = false;
        currentTabId = null;
    }
}

// 通知 popup 进度更新
function notifyProgress(current, total, status) {
    chrome.runtime.sendMessage({
        action: 'updateProgress',
        current: current,
        total: total,
        status: status
    }).catch(() => {
        console.log('[BG] Popup 可能已关闭');
    });
}

// 通知 popup 错误
function notifyError(error) {
    chrome.runtime.sendMessage({
        action: 'generationError',
        error: error
    }).catch(() => {
        console.log('[BG] Popup 可能已关闭');
    });
}

// 延迟函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 监听下载完成事件
chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state && delta.state.current === 'complete') {
        console.log(`✅ [BG] 下载完成 (ID: ${delta.id})`);
    }
    if (delta.error) {
        console.error(`❌ [BG] 下载错误 (ID: ${delta.id}):`, delta.error.current);
    }
});

console.log('🍌 Background Service Worker 监听器已注册');
