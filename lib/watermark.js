/**
 * Watermark removal library for Nano-Banana-Flow
 * Integrated from gemini-watermark-remover core logic
 */

const WatermarkLib = (function() {
    // --- alphaMap.js ---
    function calculateAlphaMap(bgCaptureImageData) {
        const { width, height, data } = bgCaptureImageData;
        const alphaMap = new Float32Array(width * height);
        for (let i = 0; i < alphaMap.length; i++) {
            const idx = i * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const maxChannel = Math.max(r, g, b);
            alphaMap[i] = maxChannel / 255.0;
        }
        return alphaMap;
    }

    // --- blendModes.js ---
    const ALPHA_THRESHOLD = 0.002;
    const MAX_ALPHA = 0.99;
    const LOGO_VALUE = 255;

    function removeWatermark(imageData, alphaMap, position) {
        const { x, y, width, height } = position;
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const imgIdx = ((y + row) * imageData.width + (x + col)) * 4;
                const alphaIdx = row * width + col;
                let alpha = alphaMap[alphaIdx];
                if (alpha < ALPHA_THRESHOLD) continue;
                alpha = Math.min(alpha, MAX_ALPHA);
                const oneMinusAlpha = 1.0 - alpha;
                for (let c = 0; c < 3; c++) {
                    const watermarked = imageData.data[imgIdx + c];
                    const original = (watermarked - alpha * LOGO_VALUE) / oneMinusAlpha;
                    imageData.data[imgIdx + c] = Math.max(0, Math.min(255, Math.round(original)));
                }
            }
        }
    }

    // --- watermarkEngine.js helpers ---
    function detectWatermarkConfig(imageWidth, imageHeight) {
        if (imageWidth > 1024 && imageHeight > 1024) {
            return { logoSize: 96, marginRight: 64, marginBottom: 64 };
        } else {
            return { logoSize: 48, marginRight: 32, marginBottom: 32 };
        }
    }

    function calculateWatermarkPosition(imageWidth, imageHeight, config) {
        const { logoSize, marginRight, marginBottom } = config;
        return {
            x: imageWidth - marginRight - logoSize,
            y: imageHeight - marginBottom - logoSize,
            width: logoSize,
            height: logoSize
        };
    }

    class WatermarkEngine {
        constructor(bgCaptures) {
            this.bgCaptures = bgCaptures;
            this.alphaMaps = {};
        }

        static async create() {
            const bg48 = new Image();
            const bg96 = new Image();
            
            // Use chrome.runtime.getURL to load assets from the extension
            const bg48Path = chrome.runtime.getURL('images/bg_48.png');
            const bg96Path = chrome.runtime.getURL('images/bg_96.png');

            await Promise.all([
                new Promise((resolve, reject) => {
                    bg48.onload = resolve;
                    bg48.onerror = () => reject(new Error('Failed to load bg_48.png'));
                    bg48.src = bg48Path;
                }),
                new Promise((resolve, reject) => {
                    bg96.onload = resolve;
                    bg96.onerror = () => reject(new Error('Failed to load bg_96.png'));
                    bg96.src = bg96Path;
                })
            ]);

            return new WatermarkEngine({ bg48, bg96 });
        }

        async getAlphaMap(size) {
            if (this.alphaMaps[size]) return this.alphaMaps[size];
            const bgImage = size === 48 ? this.bgCaptures.bg48 : this.bgCaptures.bg96;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bgImage, 0, 0);
            const imageData = ctx.getImageData(0, 0, size, size);
            const alphaMap = calculateAlphaMap(imageData);
            this.alphaMaps[size] = alphaMap;
            return alphaMap;
        }

        async removeWatermarkFromImage(image) {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const config = detectWatermarkConfig(canvas.width, canvas.height);
            const position = calculateWatermarkPosition(canvas.width, canvas.height, config);
            const alphaMap = await this.getAlphaMap(config.logoSize);
            removeWatermark(imageData, alphaMap, position);
            ctx.putImageData(imageData, 0, 0);
            return canvas;
        }
    }

    return { WatermarkEngine };
})();

// Re-export for easier use in content.js
if (typeof window !== 'undefined') {
    window.WatermarkEngine = WatermarkLib.WatermarkEngine;
}
