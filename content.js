// Content Script - 注入到Gemini页面
console.log('Gemini Auto PPT Generator: Content script loaded');

// 当前任务状态
let currentTask = null;
let isProcessing = false;
let isStopped = false; // 中止标志
let batchImageUrls = []; // 批量下载图片URL缓存

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] 📨 收到消息:', message.action);

    if (message.action === 'generateImage') {
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

        // ========== 步骤 0.8: 上传参考图 (如果存在) ==========
        if (images && images.length > 0) {
            console.log(`[步骤 0.8/${index}] 正在上传 ${images.length} 张参考图...`);
            await uploadImagesToGemini(images);
            console.log(`[步骤 0.8/${index}] 参考图上传完成，等待解析...`);
            await sleep(2000); // 给 Gemini 一点处理图片的时间
        }

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

// ========== 核心函数：上传图片到 Gemini (混合方案) ==========
async function uploadImagesToGemini(base64Images) {
    console.log('[Upload] 🚀 开始上传流程，共', base64Images.length, '张图片');

    // 混合策略：点击"上传文件"按钮 + 拦截动态创建的 input

    // Step 1: 查找"上传文件"按钮
    console.log('[Upload] 步骤1：查找"上传文件"按钮...');
    const uploadButton = findUploadButton();

    if (!uploadButton) {
        console.warn('[Upload] ⚠️ 未找到上传按钮，尝试拖放方案...');
        return await uploadViaDropEvent(base64Images);
    }

    console.log('[Upload] ✅ 找到上传按钮');

    // Step 2: 设置 MutationObserver 监听 input 创建
    console.log('[Upload] 步骤2：监听 input 创建...');

    const fileInput = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            observer.disconnect();
            console.warn('[Upload] ⏱️ 等待 input 超时，尝试拖放方案');
            resolve(null);
        }, 5000);

        const observer = new MutationObserver(() => {
            const inputs = document.querySelectorAll('input[type="file"]');
            for (const input of inputs) {
                // 查找未被处理过的新 input
                if (!input.dataset.processed) {
                    console.log('[Upload] ✅ 检测到新 input!');
                    clearTimeout(timeout);
                    observer.disconnect();
                    input.dataset.processed = 'true';
                    resolve(input);
                    return;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 点击按钮触发
        console.log('[Upload] 🖱️ 点击上传按钮...');
        uploadButton.click();
    });

    // 如果没找到 input，回退到拖放
    if (!fileInput) {
        return await uploadViaDropEvent(base64Images);
    }

    // Step 3: 转换文件
    console.log('[Upload] 步骤3：转换文件...');
    const files = await Promise.all(base64Images.map(async (b64, idx) => {
        const resp = await fetch(b64);
        const blob = await resp.blob();
        return new File([blob], `ref_${idx + 1}.png`, { type: 'image/png' });
    }));

    console.log('[Upload] ✅ 已准备', files.length, '个文件');

    // Step 4: 注入文件到 input
    console.log('[Upload] 步骤4：注入文件到 input...');
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    fileInput.files = dt.files;

    // Step 5: 触发事件
    console.log('[Upload] 步骤5：触发 change 事件...');
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));

    // Step 6: 等待处理
    console.log('[Upload] ⏳ 等待 Gemini 处理...');
    await sleep(3000);

    console.log('[Upload] ✅ 上传流程完成');
}

// 查找"上传文件"按钮
function findUploadButton() {
    // 方法1：通过文本内容查找
    const allElements = document.querySelectorAll('button, [role="menuitem"], div[class*="menu"]');

    for (const elem of allElements) {
        const text = elem.textContent?.trim() || '';
        if (text === '上传文件' || text === 'Upload file' || text === '上傳文件') {
            console.log('[Upload] 通过文本找到按钮:', text);
            return elem;
        }
    }

    // 方法2：通过 class 查找 (Angular Material 特征)
    const matButtons = document.querySelectorAll('[class*="menu-text"]');
    for (const btn of matButtons) {
        if (btn.textContent?.includes('上传文件')) {
            console.log('[Upload] 通过 class 找到按钮');
            return btn.closest('button') || btn.parentElement;
        }
    }

    return null;
}

// 备用：拖放方案
async function uploadViaDropEvent(base64Images) {
    console.log('[Upload] 🎯 使用拖放备用方案');

    const inputArea = findInputArea();
    if (!inputArea) {
        throw new Error('[Upload] ❌ 未找到输入区域');
    }

    const files = await Promise.all(base64Images.map(async (b64, idx) => {
        const resp = await fetch(b64);
        const blob = await resp.blob();
        return new File([blob], `ref_${idx + 1}.png`, { type: 'image/png' });
    }));

    const dataTransfer = new DataTransfer();
    files.forEach(f => dataTransfer.items.add(f));

    const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer
    });

    inputArea.dispatchEvent(dropEvent);
    await sleep(3000);

    console.log('[Upload] ✅ 拖放完成');
}

async function waitForUploadComplete() {
    // 轮询检测：上传后会出现预览图
    const maxWait = 15000;
    const start = Date.now();

    return new Promise((resolve) => {
        const check = setInterval(() => {
            const previewSelectors = [
                'img[src^="blob:"]',
                'img[src^="data:image"]',
                '[class*="preview"]',
                '[class*="thumbnail"]',
                '[class*="uploaded"]'
            ];

            let found = false;
            for (const sel of previewSelectors) {
                if (document.querySelector(sel)) {
                    found = true;
                    break;
                }
            }

            if (found || Date.now() - start > maxWait) {
                console.log(found ? '[Upload] ✅ 检测到预览' : '[Upload] ⏱️ 等待超时');
                clearInterval(check);
                resolve();
            }
        }, 800);
    });
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
