// background.js - V1.1.4 完整版
// 大香蕉批量生图 (Nano Banana Flow)

console.log('🍌 Nano Banana Flow Service Worker 已启动');

// 任务队列
let taskQueue = [];
let isProcessing = false;
let currentTaskIndex = 0;
let currentTabId = null;

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ Nano Banana Flow Service Worker Installed');
});

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

        // 通知 popup 完成
        notifyProgress(taskQueue.length, taskQueue.length, '全部完成！');
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
