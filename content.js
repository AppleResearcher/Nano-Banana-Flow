// Content Script - 注入到Gemini页面
console.log('Gemini Auto PPT Generator: Content script loaded');

// 当前任务状态
let currentTask = null;
let isProcessing = false;
let isStopped = false; // 中止标志
let batchImageUrls = []; // 批量下载图片URL缓存

// ============================================
// Debug Mode - 调试日志
// ============================================
let debugMode = false;

// 加载 Debug 模式状态
async function loadDebugMode() {
    const res = await chrome.storage.local.get('debugMode');
    debugMode = res.debugMode || false;
    if (debugMode) console.log('[Content][DEBUG] 🐛 Debug 模式已启用');
}

// 调试日志工具函数
function debugLog(...args) {
    if (debugMode) {
        console.log('[Content][DEBUG]', ...args);
    }
}

// 初始化时加载 Debug 模式
loadDebugMode();

// 监听 storage 变化以实时同步 Debug 状态
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.debugMode) {
        debugMode = changes.debugMode.newValue || false;
    }
});

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] 📨 收到消息:', message.action);

    if (message.action === 'generateImage') {
        // 重置状态，确保新任务不会被旧的中止标志拦截
        isStopped = false;
        console.log('[Content] 🎨 开始处理生成请求:', message.prompt?.substring(0, 30) + '...');
        handleGenerateImage(message.prompt, message.images || [], message.directory, message.index, message.total)
            .then(result => {
                console.log('[Content] ✅ 生成完成，返回结果');
                sendResponse(result);
            })
            .catch(error => {
                console.error('[Content] ❌ 生成失败:', error.message);
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道开启
    } else if (message.action === 'stopTask') {
        // 接收到停止任务消息
        console.log('[Content] ⏹ 收到停止任务指令');
        isStopped = true;
        sendResponse({ success: true });
        return true;
    }
});

// 处理单个图片生成任务
async function handleGenerateImage(prompt, images, directory, index, total) {
    console.log(`\n========== 开始生成第 ${index}/${total} 张图片 ==========`);
    console.log(`提示词: ${prompt}`);
    if (images && images.length > 0) console.log(`关联图片数量: ${images.length}`);
    if (directory) console.log(`保存目录: ${directory}`);

    // Debug 详细信息
    debugLog('📝 任务详情:', {
        taskIndex: `${index}/${total}`,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
        imageCount: images ? images.length : 0,
        directory: directory || '默认'
    });

    try {
        // 检查是否已中止
        if (isStopped) {
            throw new Error('用户中止任务');
        }

        // 如果是第一张图片，重置URL缓存
        if (index === 1) {
            console.log('🔄 新任务开始，重置图片URL缓存');
            batchImageUrls = [];
        }

        // ========== 步骤 0: 等待Gemini空闲（关键！） ==========
        console.log(`[步骤 0/${index}] 等待Gemini空闲...`);
        await waitForIdle();

        // 检查是否已中止
        if (isStopped) {
            throw new Error('用户中止任务');
        }

        // ========== 步骤 0.5: 记录当前图片数量 ==========
        const preGenerationImageCount = countValidImages();
        console.log(`[步骤 0.5/${index}] 当前有效图片数量: ${preGenerationImageCount}`);

        // 【新增】检查是否有残留的预览图，如果有则尝试清理或等待
        const residualPreviews = document.querySelectorAll('img[src^="blob:"], img[src^="data:"], [class*="preview"], [class*="thumbnail"]');
        if (residualPreviews.length > 0) {
            console.warn(`[步骤 0.6/${index}] ⚠️ 检测到 ${residualPreviews.length} 张残留预览图，尝试清理...`);
            // 尝试点击所有移除按钮（如果有的话）
            const removeBtns = document.querySelectorAll('button[aria-label*="Remove"], button[aria-label*="Delete"], .remove-image-icon');
            removeBtns.forEach(btn => btn.click());
            await sleep(1000);

            // 再次检查
            const remaining = document.querySelectorAll('img[src^="blob:"], [class*="preview"]');
            if (remaining.length > 0) {
                console.warn(`[步骤 0.6/${index}] ⚠️ 清理后仍有残留，可能影响后续上传判定`);
            } else {
                console.log(`[步骤 0.6/${index}] ✅ 残留清理完成`);
            }
        }

        // ========== 步骤 0.8: 上传参考图 (如果存在) ==========
        if (images && images.length > 0) {
            console.log(`[步骤 0.8/${index}] 正在上传 ${images.length} 张参考图...`);
            await uploadImagesToGemini(images);
            console.log(`[步骤 0.8/${index}] 参考图上传完成，等待解析...`);
            await sleep(2000); // 给 Gemini 一点处理图片的时间
        } else {
            console.log(`[步骤 0.8/${index}] 无关联图片，跳过上传流程`);
        }

        // ========== 步骤 0.9: 强制检查模型模式 (避免 Fast 模式) ==========
        console.log(`[步骤 0.9/${index}] 检查模型模式 (Pro Check)...`);
        await ensureProMode();

        // ========== 步骤 1: 输入提示词（自动触发图片生成） ==========
        // 【优化】不再手动点击工具菜单，改用提示词工程
        // inputPrompt 内部会自动添加 "Create an image of: " 前缀
        console.log(`[步骤 1/${index}] 输入提示词（自动触发图片生成）...`);
        await inputPrompt(prompt);

        // 检查是否已中止
        if (isStopped) {
            throw new Error('用户中止任务');
        }

        // ========== 步骤 2: 点击发送按钮 ==========
        console.log(`[步骤 2/${index}] 点击发送按钮...`);
        await clickSendButton();

        // ========== 步骤 4: 等待响应开始 ==========
        console.log(`[步骤 4/${index}] 等待Gemini开始响应...`);
        await sleep(2000);

        // 检查是否已中止
        if (isStopped) {
            throw new Error('用户中止任务');
        }

        // ========== 步骤 5: 等待响应完全结束（关键！） ==========
        console.log(`[步骤 5/${index}] 等待Gemini完成图片生成...`);
        await waitForIdle();

        // 检查是否已中止
        if (isStopped) {
            throw new Error('用户中止任务');
        }

        console.log(`✅ 第 ${index}/${total} 张图片生成完成`);

        // ========== 步骤 5.5: 捕获当前生成的图片URL ==========
        // 传入生成前的图片数量，用于验证新图片是否出现
        await captureCurrentImageUrl(index, preGenerationImageCount);

        // ========== 步骤 6: 检查是否是最后一张，如果是则触发批量下载 ==========
        if (index === total) {
            console.log(`🎉 所有图片生成完毕，开始批量下载...`);
            await batchDownloadImagesFromList(directory);
        } else {
            console.log(`⏳ 等待下一张任务...`);
        }

        console.log(`========== 第 ${index}/${total} 张图片完成 ==========\n`);
        return { success: true };

    } catch (error) {
        console.error(`❌ 第 ${index}/${total} 张图片生成失败:`, error);
        throw error;
    }
}

// 输入提示词到Gemini输入框（提示词工程优化版）
async function inputPrompt(text) {
    console.log('正在输入提示词...');

    // 查找输入框 (Rich Text Editor 或 Textarea)
    const inputSelector = 'div[contenteditable="true"]'; // Gemini 通常用这个
    const inputEl = document.querySelector(inputSelector);

    if (inputEl) {
        console.log('找到输入框，准备输入');

        // 1. 聚焦（不要点击，直接focus）
        inputEl.focus();
        await sleep(200);

        // 2. 清空现有内容（安全方式，不触发点击）
        inputEl.textContent = '';

        // 3. 【核心优化】应用"提示词加持"
        // 自动添加前缀，强制触发绘图意图
        // 比如用户输入 "一只猫"，实际发送 "Create an image of: 一只猫"
        const commandPrefix = "Create an image of: ";
        const finalPrompt = commandPrefix + text;

        console.log(`原始提示词: ${text}`);
        console.log(`增强提示词: ${finalPrompt}`);

        // 4. 模拟输入(使用 document.execCommand 更安全)
        // 这个方法会触发正确的事件链，且不会误触其他元素
        const success = document.execCommand('insertText', false, finalPrompt);

        if (!success) {
            // 如果 execCommand 失败，回退到直接赋值
            console.log('execCommand失败，使用备用方法');
            inputEl.textContent = finalPrompt;
        }

        // 5. 触发 Input 事件确保 Angular/React 检测到变化
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(500); // 短暂等待
        console.log('✅ 提示词输入完成（已添加图片生成触发指令）');
    } else {
        throw new Error('未找到输入框，请确保在Gemini聊天页面');
    }
}

// 清空输入框
async function clearInputField() {
    console.log('清空输入框...');

    const selectors = [
        'div[contenteditable="true"]',
        'textarea[placeholder*="输入"]',
        'div.ql-editor',
        '[role="textbox"]'
    ];

    let inputElement = null;

    for (const selector of selectors) {
        inputElement = document.querySelector(selector);
        if (inputElement) {
            break;
        }
    }

    if (inputElement) {
        // 清空内容
        inputElement.textContent = '';
        inputElement.value = '';
        inputElement.innerHTML = '';

        // 触发事件
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('输入框已清空');
    } else {
        console.log('未找到输入框，跳过清空');
    }

    await sleep(300);
}

// 点击发送按钮（提交提示词）
async function clickSendButton() {
    console.log('正在查找发送按钮...');

    // 关键：只在输入区域内查找，避免误触页面顶部的导航元素
    // 1. 先定位到输入框
    const inputEl = document.querySelector('div[contenteditable="true"]');
    if (!inputEl) {
        throw new Error('未找到输入框，无法定位发送按钮');
    }

    // 2. 获取输入框的父级容器（通常包含输入框和发送按钮）
    const inputContainer = inputEl.closest('form, .input-area, .input-wrapper, .chat-input') || inputEl.parentElement;
    console.log('输入区域容器:', inputContainer);

    // 3. 只在该容器内查找发送按钮
    const sendButton = await waitForElement(
        () => {
            // 在容器内查找按钮
            const buttons = Array.from(inputContainer.querySelectorAll('button'));

            // 方式1：通过aria-label查找
            let btn = buttons.find(b => {
                const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
                return ariaLabel.includes('send') ||
                    ariaLabel.includes('发送') ||
                    ariaLabel.includes('傳送') || // 繁体中文
                    ariaLabel.includes('提交') || // 繁体中文/通用
                    ariaLabel.includes('submit');
            });

            if (btn && !btn.disabled) return btn;

            // 方式2：查找包含SVG图标的按钮（通常是发送图标）
            btn = buttons.find(b => {
                const svg = b.querySelector('svg');
                return svg && !b.disabled;
            });

            if (btn) return btn;

            return null;
        },
        10000,
        '未在输入区域找到发送按钮'
    );

    console.log('找到发送按钮，准备点击');
    sendButton.click();

    // 等待提示词提交
    await sleep(2000);
    console.log('提示词已提交');
}

// 点击"制作图片"按钮或从工具菜单选择图片生成
async function clickGenerateImageButton() {
    console.log('准备进入图片生成模式...');

    // 首先检查是否已经在图片生成模式
    const isInImageMode = await checkIfInImageMode();

    if (isInImageMode) {
        console.log('已经在图片生成模式，无需切换');
        return;
    }

    console.log('当前不在图片生成模式，从工具菜单选择"生成图片"');

    // 从"工具"菜单选择"生成图片"
    await selectImageModeFromToolsMenu();
}

// 检查是否已经在图片生成模式
async function checkIfInImageMode() {
    // 查找输入框下方的"图片"标签或图标
    const imageModeTags = [
        () => {
            // 查找包含"图片"文本的标签
            const elements = Array.from(document.querySelectorAll('*'));
            return elements.find(el => {
                const text = el.textContent;
                const isSmall = el.offsetHeight < 50 && el.offsetWidth < 200;
                return isSmall && (text === '图片' || text === '圖片' || text === 'Image' || text.includes('图像') || text.includes('圖像'));
            });
        },
        () => {
            // 查找图片图标
            const icons = Array.from(document.querySelectorAll('[aria-label*="图片"], [aria-label*="圖片"], [aria-label*="Image"]'));
            return icons.find(icon => icon.closest('button') || icon.closest('div[role="button"]'));
        }
    ];

    for (const checkFn of imageModeTags) {
        const element = checkFn();
        if (element) {
            console.log('检测到图片模式标签');
            return true;
        }
    }

    return false;
}

// 从工具菜单选择"生成图片"
async function selectImageModeFromToolsMenu() {
    console.log('打开工具菜单...');

    // 1. 查找并点击"工具"按钮
    const toolsButton = await waitForElement(
        () => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
            return buttons.find(btn => {
                const text = btn.textContent;
                const ariaLabel = btn.getAttribute('aria-label') || '';
                return text.includes('工具') ||
                    text.includes('Tools') ||
                    ariaLabel.includes('工具') ||
                    ariaLabel.includes('Tools');
            });
        },
        5000,
        '未找到工具按钮'
    );

    console.log('找到工具按钮，点击打开菜单');
    toolsButton.click();
    await sleep(800);

    // 2. 在菜单中查找"生成图片"选项
    const imageOption = await waitForElement(
        () => {
            const options = Array.from(document.querySelectorAll('div, button, li, [role="menuitem"]'));
            return options.find(opt => {
                const text = opt.textContent;
                return text.includes('生成图片') ||
                    text.includes('生成图像') ||
                    text.includes('產生圖片') || // 繁体中文
                    text.includes('Generate image') ||
                    text.includes('Image generation');
            });
        },
        3000,
        '未找到"生成图片"选项'
    );

    console.log('找到"生成图片"选项，点击选择');
    imageOption.click();
    await sleep(1500);
    console.log('已切换到图片生成模式');
}

// 选择Nano Banana Pro模型
async function selectNanoBananaProModel() {
    console.log('正在查找模型选择器...');

    try {
        // 等待模型选择器出现
        const modelSelector = await waitForElement(
            () => {
                // 查找包含"Nano Banana Pro"的选项
                const elements = Array.from(document.querySelectorAll('*'));
                return elements.find(el =>
                    el.textContent.includes('Nano Banana Pro') ||
                    el.textContent.includes('Show thinking')
                );
            },
            5000,
            null // 不抛出错误，可能已经选择了正确的模型
        );

        if (modelSelector) {
            console.log('找到Nano Banana Pro选项');

            // 如果是下拉菜单，先点击展开
            const dropdown = modelSelector.closest('select, [role="listbox"], [role="combobox"]');
            if (dropdown) {
                dropdown.click();
                await sleep(500);
            }

            // 点击Nano Banana Pro选项
            modelSelector.click();
            await sleep(1000);
            console.log('已选择Nano Banana Pro模型');
        } else {
            console.log('未找到模型选择器，可能已经是默认模型');
        }
    } catch (error) {
        console.log('模型选择跳过:', error.message);
    }
}

// 等待图片生成完成
async function waitForImageGeneration() {
    console.log('等待图片生成...');

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            observer.disconnect();
            reject(new Error('图片生成超时（90秒）'));
        }, 90000);

        // 使用MutationObserver监听DOM变化
        const observer = new MutationObserver((mutations) => {
            // 查找已加载的图片
            const loadedImage = document.querySelector('img.image.loaded');

            if (loadedImage && loadedImage.src && loadedImage.src.includes('googleusercontent.com')) {
                console.log('检测到图片生成完成!');
                clearTimeout(timeout);
                observer.disconnect();
                resolve(loadedImage.src);
            }
        });

        // 开始监听
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'src']
        });

        // 立即检查一次（可能图片已经存在）
        const existingImage = document.querySelector('img.image.loaded');
        if (existingImage && existingImage.src && existingImage.src.includes('googleusercontent.com')) {
            console.log('图片已存在');
            clearTimeout(timeout);
            observer.disconnect();
            resolve(existingImage.src);
        }
    });
}

// ========== 下载图片（=s0 高清图方案 V2.1） ==========
// 关键改进：更健壮的 URL 高清化逻辑
// ========== 批量下载图片（=s0 高清图方案 V3.0） ==========
// ========== 捕获当前生成的图片URL ==========
// ========== 统计有效图片数量 ==========
function countValidImages() {
    const images = Array.from(document.querySelectorAll('img[src*="googleusercontent.com"]'));
    const validImages = images.filter(img => {
        if (!img.src) return false;
        // 尺寸过滤
        if (img.naturalWidth <= 200 || img.naturalHeight <= 200) return false;
        // 排除头像和图标
        if (img.src.includes('profile_photo')) return false;
        if (img.src.includes('nano-banana')) return false;
        return true;
    });
    return validImages.length;
}

// ========== 捕获当前生成的图片URL ==========
async function captureCurrentImageUrl(index, preCount) {
    console.log(`[Capture ${index}] 正在捕获当前图片URL (生成前数量: ${preCount})...`);

    try {
        // 1. 轮询等待新图片出现
        // 有时候"Stop"按钮消失了，但图片DOM还没完全渲染出来
        const maxWaitTime = 30000; // 30秒超时
        const startTime = Date.now();
        let foundNewImage = false;
        let validImages = [];

        while (Date.now() - startTime < maxWaitTime) {
            // 获取当前有效图片
            const images = Array.from(document.querySelectorAll('img[src*="googleusercontent.com"]'));
            validImages = images.filter(img => {
                if (!img.complete) return false;
                if (!img.src) return false;
                // 尺寸过滤
                if (img.naturalWidth <= 200 || img.naturalHeight <= 200) return false;
                // 排除头像和图标
                if (img.src.includes('profile_photo')) return false;
                if (img.src.includes('nano-banana')) return false;
                return true;
            });

            // 检查数量是否增加
            if (validImages.length > preCount) {
                console.log(`[Capture ${index}] 检测到新图片 (当前数量: ${validImages.length})`);
                foundNewImage = true;
                break;
            }

            // 等待一下
            await sleep(500);
        }

        if (!foundNewImage) {
            console.warn(`[Capture ${index}] ⚠️ 等待新图片超时，尝试使用最后一张...`);
        }

        if (validImages.length === 0) {
            console.warn(`[Capture ${index}] 未找到有效图片，无法捕获`);
            return;
        }

        // 4. 取最后一张（最新生成的）
        const targetImg = validImages[validImages.length - 1];
        const originalUrl = targetImg.src;

        // 5. 高清化处理
        const fullSizeUrl = getFullSizeImageUrl(originalUrl);

        console.log(`[Capture ${index}] 捕获成功: ${fullSizeUrl}`);

        // 6. 存入列表
        batchImageUrls.push({
            index: index,
            url: fullSizeUrl
        });

    } catch (error) {
        console.error(`❌ [Capture ${index}] 捕获失败:`, error.message);
    }
}

// ========== 批量下载图片（基于已捕获的列表） ==========
async function batchDownloadImagesFromList(directory) {
    console.log(`[Batch Download] 启动批量下载流程，共 ${batchImageUrls.length} 张图片...`);

    if (batchImageUrls.length === 0) {
        console.warn(`[Batch Download] 列表为空，没有可下载的图片`);
        return;
    }

    try {
        // 遍历下载
        for (let i = 0; i < batchImageUrls.length; i++) {
            const item = batchImageUrls[i];
            const pageIndex = item.index;
            const url = item.url;

            console.log(`[Batch Download] 处理第 ${pageIndex} 张...`);

            // 构造文件名
            let filename = `page${pageIndex}.png`;
            if (directory) {
                const cleanDir = directory.replace(/^\/+|\/+$/g, '');
                if (cleanDir) {
                    filename = `${cleanDir}/${filename}`;
                }
            }

            // 发送下载请求
            console.log(`[Batch Download] 发送下载请求: URL=${url?.substring(0, 80)}...`);
            chrome.runtime.sendMessage({
                action: 'download_hq',
                url: url,
                filename: filename
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(`❌ [Batch Download] 图片 ${pageIndex} 通信错误:`, chrome.runtime.lastError.message);
                } else if (response && response.status === 'success') {
                    console.log(`✅ [Batch Download] 图片 ${pageIndex} 下载已启动`);
                } else {
                    console.error(`❌ [Batch Download] 图片 ${pageIndex} 下载失败, 响应:`, response);
                }
            });

            // 稍微间隔一下，避免瞬间发起太多请求
            await sleep(500);
        }

        console.log(`✅ [Batch Download] 批量下载请求发送完毕`);

    } catch (error) {
        console.error(`❌ [Batch Download] 批量下载流程异常:`, error.message);
    }
}

// ========== 获取完整尺寸图片 URL ==========
// Google CDN URL 格式示例：
// - https://lh3.googleusercontent.com/a/xxx=s64-c
// - https://lh3.googleusercontent.com/xxx=w400-h400
// - https://lh3.googleusercontent.com/xxx=s1024-rj
// - https://lh3.googleusercontent.com/xxx (无参数)
// 目标：替换为 =s0 获取原图尺寸
function getFullSizeImageUrl(originalUrl) {
    if (!originalUrl || !originalUrl.includes('googleusercontent.com')) {
        return originalUrl;
    }

    // 找到最后一个 = 符号的位置
    const lastEqualIndex = originalUrl.lastIndexOf('=');

    if (lastEqualIndex === -1) {
        // 没有参数，直接添加 =s0
        return originalUrl + '=s0';
    }

    // 截取基础 URL（= 之前的部分）并添加 =s0
    const baseUrl = originalUrl.substring(0, lastEqualIndex);
    return baseUrl + '=s0';
}




// ========== 核心函数：等待Gemini空闲 ==========
// 轮询检测：只要存在"停止生成"按钮，就说明还在忙
async function waitForIdle() {
    console.log('🔄 正在等待Gemini回复完成...');

    const maxWaitTime = 120000; // 最多等待2分钟
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            // 检查是否超时
            if (Date.now() - startTime > maxWaitTime) {
                clearInterval(checkInterval);
                reject(new Error('等待Gemini空闲超时'));
                return;
            }

            // 查找"停止生成"按钮（多种可能的选择器）
            const stopButton = document.querySelector(
                'button[aria-label*="Stop"], ' +
                'button[aria-label*="停止"], ' + // 简繁通用
                'button[aria-label*="停止回應"], ' + // 繁体中文
                'button[aria-label*="stop"], ' +
                'button mat-icon[data-mat-icon-name="stop"]'
            );

            if (!stopButton) {
                // 没有停止按钮，进一步确认是否有发送按钮（确保可以输入）
                const sendButton = document.querySelector(
                    'button[aria-label*="Send"], ' +
                    'button[aria-label*="发送"], ' +
                    'button[aria-label*="傳送"], ' + // 繁体中文
                    'button[aria-label*="send"]'
                );

                if (sendButton) {
                    console.log('✅ Gemini已就绪 (Idle)');
                    clearInterval(checkInterval);
                    resolve();
                }
            } else {
                console.log('⏳ Gemini正在生成中，继续等待...');
            }
        }, 1000); // 每秒检查一次
    });
}

// 辅助函数：获取当前输入区域范围内的预览图数量
function getScopedPreviewImages() {
    // 1. 尝试找到输入区域的容器 (通常包含 input-area 类或是在底部工具栏)
    const inputContainer = document.querySelector('div[class*="input-area"], footer, .input-area-container') || document.body;

    // 2. 在容器内查找预览图 (排除历史记录中的图片)
    // 历史记录中的图片通常在 chat-history 或 similar 容器中，而 footer/input-area 是独立的
    const previews = inputContainer.querySelectorAll('img[src^="blob:"], img[src^="data:"], [class*="preview"], [class*="thumbnail"]');

    // 3. 过滤掉明显不是预览图的元素 (比如头像)
    return Array.from(previews).filter(el =>
        (el.src && el.src.startsWith('blob:')) ||
        (el.style && el.style.backgroundImage && el.style.backgroundImage.includes('blob:'))
    );
}

// ========== 核心函数：上传图片到 Gemini (粘贴方案) ==========
async function uploadImagesToGemini(base64Images) {
    console.log('[Upload] 🚀 开始粘贴上传流程 (Plan D)，共', base64Images.length, '张图片');

    // Debug: 输出图片大小信息
    debugLog('🖼️ 参考图上传详情:');
    base64Images.forEach((b64, i) => {
        const sizeKB = Math.round(b64.length * 0.75 / 1024); // Base64 还原大小估算
        debugLog(`  图片 #${i + 1}: ~${sizeKB}KB (Base64长度: ${b64.length})`);
    });

    // 1. 找到输入框
    const inputArea = findInputArea();
    if (!inputArea) {
        throw new Error('[Upload] ❌ 未找到输入区域');
    }

    // 聚焦输入框确保事件正确处理
    inputArea.focus();
    await sleep(200);

    // 【新增】记录上传前的初始预览图数量 (基准值)
    const initialPreviews = getScopedPreviewImages();
    const initialCount = initialPreviews.length;
    console.log(`[Upload] 📊 初始预览图数量: ${initialCount} (将作为增量检测的基准)`);

    // 2. 转换为 File 对象并逐个粘贴
    // 为了稳定性，建议逐张粘贴
    for (let i = 0; i < base64Images.length; i++) {
        const b64 = base64Images[i];
        console.log(`[Upload] 🔄 正在处理第 ${i + 1}/${base64Images.length} 张图片...`);

        const resp = await fetch(b64);
        const blob = await resp.blob();
        const file = new File([blob], `ref_${i + 1}.png`, { type: 'image/png' });

        debugLog(`  📄 文件准备就绪: ${file.name}`);
        debugLog(`  📏 大小: ${(file.size / 1024).toFixed(2)}KB`);
        debugLog(`  🏷️ 类型: ${file.type}`);

        await uploadSingleImageViaPaste(inputArea, file);

        console.log(`[Upload] ✅ 第 ${i + 1} 张图片已粘贴，等待缓冲...`);
        // 间隔一下，避免处理冲突
        await sleep(1500); // 稍微增加间隔，确保多图稳定性
    }

    console.log(`[Upload] ⏳ 全部 ${base64Images.length} 张图片粘贴完成，等待 Gemini 解析...`);

    // 增加重试检测机制 (最多等待 20 秒)
    // 目标数量 = 初始数量 + 本次上传数量
    const targetCount = initialCount + base64Images.length;
    let currentCount = 0;

    for (let attempt = 1; attempt <= 20; attempt++) {
        await sleep(1000);

        const currentPreviews = getScopedPreviewImages();
        currentCount = currentPreviews.length;

        if (currentCount >= targetCount) {
            console.log(`[Upload] ✅ 在第 ${attempt} 次重试时检测到 ${currentCount} 张预览图 (目标: >=${targetCount})`);
            console.log('[Upload] 🎉 预览图数量验证通过！');
            break;
        } else {
            console.log(`[Upload] ⏳ 等待预览图... 当前: ${currentCount}, 目标: ${targetCount} (${attempt}/20)`);
        }
    }

    if (currentCount >= targetCount) {
        debugLog(`[Upload] 最终确认预览图数量: ${currentCount}`);
        console.log('[Upload] ✅ 图片上传流程确认成功');
        // 再额外等待一下，确保完全渲染
        await sleep(1000);
    } else {
        // 如果虽然没达到目标数量，但比初始数量多了，说明至少上传了一部分，可以考虑放行（或者是Gemini合并了图片）
        if (currentCount > initialCount) {
            console.warn(`[Upload] ⚠️ 警告: 仅检测到 ${currentCount} 张图 (初始: ${initialCount}, 目标: ${targetCount})，但已有新增，尝试继续...`);
        } else {
            throw new Error(`[Upload] ❌ 严重错误: 上传后预览图数量未增加 (初始: ${initialCount}, 当前: ${currentCount})`);
        }
    }

    console.log('[Upload] ✅ 粘贴流程完成');
}

// 单张图片粘贴逻辑
async function uploadSingleImageViaPaste(targetElement, file) {
    console.log('[Upload] 📋 触发 Paste 事件:', file.name);

    // 构造 DataTransfer
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

    // 构造 ClipboardEvent
    const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
        dataType: 'text/plain',
        data: ''
    });

    // 分发事件
    targetElement.dispatchEvent(pasteEvent);

    console.log('[Upload] ✅ Paste 事件已发送');
}

// 查找输入区域
function findInputArea() {
    const selectors = [
        'div[contenteditable="true"]',  // 主输入框
        '[role="textbox"]',
        'textarea',
        '.input-area'
    ];

    for (const sel of selectors) {
        const elem = document.querySelector(sel);
        if (elem) {
            console.log('[Upload] 找到输入区域:', sel);
            return elem;
        }
    }
    return null;
}

// ========== 核心函数：强制确保图片生成模式 ==========
async function ensureImageMode() {
    console.log('🎨 确保处于图片生成模式...');

    try {
        // 检查是否已经在图片模式（查找图片模式标识）
        const imageModeIndicator = document.querySelector(
            '[data-value="image_generation_tool"], ' +
            'div[aria-label*="图片"], ' +
            'div[aria-label*="Image"]'
        );

        if (imageModeIndicator) {
            console.log('✅ 已经在图片生成模式');
            return;
        }

        // 如果不在图片模式，从工具菜单选择
        console.log('📋 从工具菜单选择"生成图片"...');
        await selectImageModeFromToolsMenu();

    } catch (error) {
        console.warn('⚠️ 确保图片模式时出错:', error.message);
        // 不抛出错误，尝试继续
    }
}

// 等待元素出现
function waitForElement(selectorFn, timeout = 10000, errorMessage = '元素未找到') {
    return new Promise((resolve, reject) => {
        const element = selectorFn();
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const element = selectorFn();
            if (element) {
                observer.disconnect();
                clearTimeout(timer);
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        const timer = setTimeout(() => {
            observer.disconnect();
            if (errorMessage) {
                reject(new Error(errorMessage));
            } else {
                resolve(null);
            }
        }, timeout);
    });
}

// 延迟函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== 核心函数：强制使用 Pro 模式 ==========
// ========== 核心函数：强制使用 Pro 模式 (V2.0 强化版) ==========
async function ensureProMode() {
    console.log('🤖 启动模型模式检查 (Pro Check)...');

    try {
        // 1. 查找模型选择器触发按钮 (使用更精确的选择器)
        // 目标：.mat-mdc-menu-trigger.pill-ui-logo-container.under-input
        const triggerSelector = '.mat-mdc-menu-trigger.pill-ui-logo-container';

        let targetButton = await waitForElement(
            () => {
                const buttons = Array.from(document.querySelectorAll(triggerSelector));
                return buttons.find(btn => {
                    const text = btn.textContent || '';
                    // 排除非主模型选择器的干扰项
                    return !text.includes('Help') && !text.includes('帮助');
                });
            },
            5000,
            null
        );

        if (!targetButton) {
            console.log('ℹ️ 未找到模型选择器，可能已是 Pro 或界面结构异常，跳过切换。');
            return;
        }

        const currentText = (targetButton.textContent || '').trim();
        console.log(`📊 当前模型状态显示: [${currentText}]`);

        // 检查是否已经是 Pro
        if (currentText.toLowerCase().includes('pro') ||
            currentText.toLowerCase().includes('advanced') ||
            currentText.toLowerCase().includes('ultra')) {
            console.log('✅ 当前已是 Pro 模式，无需切换。');
            return;
        }

        // 检查是否是 Fast 模式 (快速模式)
        if (currentText.includes('Fast') || currentText.includes('快速') || currentText.includes('Flash')) {
            console.log('⚠️ 检测到 [快速] 模式，准备切换到 Pro...');

            // 2. 点击展开菜单
            targetButton.click();
            await sleep(1000); // 等待菜单动画

            // 3. 在菜单中查找 Pro 选项
            // 策略：查找 .mat-mdc-menu-item 及其内部的 .mode-title
            const proOption = await waitForElement(
                () => {
                    const menuItems = Array.from(document.querySelectorAll('.mat-mdc-menu-item, [role="menuitem"]'));
                    return menuItems.find(item => {
                        const titleEl = item.querySelector('.mode-title');
                        const text = (titleEl ? titleEl.textContent : item.textContent || '').toLowerCase();
                        return text.includes('pro') ||
                            text.includes('advanced') ||
                            text.includes('ultra');
                    });
                },
                3000,
                null
            );

            if (proOption) {
                const optionName = proOption.textContent.trim().split('\n')[0];
                console.log('👉 找到 Pro 选项，点击切换:', optionName);
                proOption.click();

                // 等待页面重新加载或模型切换生效
                await sleep(2500);
                console.log('✅ 切换动作执行完毕');
            } else {
                console.warn('❌ 菜单已打开，但未找到包含 "Pro" 文本的选项。');
                // 再次点击按钮尝试关闭菜单，避免遮挡
                targetButton.click();
            }
        } else {
            console.log('ℹ️ 当前模式既不是快速也不是 Pro，系统判定可能已是预览版或实验性 Pro 模式，跳过。');
        }

    } catch (error) {
        console.warn('⚠️ 尝试切换 Pro 模式时发生异常:', error.message);
    }
}
