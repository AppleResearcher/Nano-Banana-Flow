# 🍌 Nano Banana Flow

> **只要香蕉🍌不下班，一直生图到天亮**
>
> 大香蕉批量生图神器 - Gemini AI 图片批量生成工具
> 
> 【我的博客】分享更多AI工具和教程：https://gt.topgpt.us

![Nano Banana Flow Preview](https://gt.topgpt.us/upload/v1.2.0.png)

[![Version](https://img.shields.io/badge/version-1.2.0-gold.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)

[English Contents](README_EN.md)

> **只要香蕉 🍌 不下班，一直生图到天亮。**

一款强大的 Chrome 插件，旨在帮助您在 Gemini 上实现**批量生图**并**自动下载**，彻底释放双手。

## ✨ 特性

- 🎨 **批量生图**：一次性输入多个提示词，全自动逐条生成。
- 📥 **自动下载**：生成后自动下载，支持自定义保存目录。
- 📄 **TXT 快速导入**：[v1.2.0+] 支持从本地 TXT 文件一键导入海量提示词。
- 🖼️ **智能图生图**：[v1.2.0+] 支持本地参考图上传，根据文件名自动匹配（如 `1_image.jpg` 匹配第一条）。
- 📊 **实时进度**：直观的进度条显示，实时掌握生成动态。
- 💾 **自动保存**：自动记录最后一次输入的提示词，不怕意外关闭。
- ⏹️ **灵活控制**：支持随时停止任务，保护您的 Gemini 配额。

---

## 📦 安装教程

### 开发者模式加载

1. **下载插件文件**
   - Clone 本项目或下载 ZIP 包

2. **打开 Chrome 扩展程序页面**
   - 在 Chrome 地址栏输入：`chrome://extensions/`

3. **启用开发者模式**
   - 在页面右上角，打开"开发者模式"开关

4. **加载插件**
   - 点击"加载已解压的扩展程序"
   - 选择插件文件所在的文件夹

5. **完成！**
   - 插件图标会出现在 Chrome 工具栏
   - 如果没有看到，点击拼图图标 📌 固定插件

## 🚀 使用教程

### 第一步：打开 Gemini 页面

访问 [https://gemini.google.com/app](https://gemini.google.com/app) 并确保已登录
> **注**：v1.1.1 版本已完整支持繁体中文界面（港澳台）。

### 第二步：准备提示词

在插件输入框中，每行输入一个提示词：

```
一只可爱的猫咪坐在窗边
一只金毛犬在公园玩耍
一朵盛开的玫瑰花
```

### 第三步：开始生成

1. 点击插件图标打开界面
2. 粘贴或输入提示词（每行一个）
3. 可选：设置保存目录
4. 点击"🎨 批量生成"按钮
5. 等待自动生成和下载

### 第四步：查看结果

- 图片自动下载到默认下载目录（或您指定的目录）
- 文件命名格式：`page1.png`, `page2.png`, `page3.png`...

## 🔧 常见问题 (FAQ)

### 基础功能
- **Q: 工具主要做什么？**
  一次性输入多行提示词，全自动逐个生成图片并下载到本地，无需人工值守。
- **Q: 如何输入提示词？**
  每行一个。例如：
  ```
  一只在太空行走的猫
  赛博朋克风格的街道
  ```
- **Q: 文件名格式？**
  按序命名：`page1.png`, `page2.png`... 保存在浏览器默认下载文件夹。

### 故障排除
- **Q: 插件无法找到输入框？**
  1. 确保在 `https://gemini.google.com/app`。
  2. **刷新页面**（通常是因为输入框未加载完成）。
  3. 检查网络节点是否导致了网址变更。
- **Q: 我的操作系统界面是繁体中文为什么卡在生成第一张图片？**
  请升级到 **v1.1.1** 及以上版本（已修复）。如仍有问题，尝试临时切换系统语言为英文/简体中文。
- **Q: 下载下来是 .html 文件？**
  这是因为浏览器拦截了自动下载。请在地址栏点击"锁"图标 → 网站设置 → **允许自动下载 (Automatic downloads)**。
- **Q: 侧边栏挡住视线？**
  点击插件图标可以收起/展开侧边栏，不会中断任务。

### 下载地址
*   **GitHub 主仓库**：[Releases 下载](https://github.com/AppleResearcher/Nano-Banana-Flow/releases) (最新版本)
*   **国内网盘**：[百度网盘](https://pan.baidu.com/s/1I9DMwu_NQVhAqIGeqgEa7g?pwd=saec) (提取码: `saec`)
*   **海外网盘**：[Google Drive](https://drive.google.com/file/d/1aK4ls54SSc64WcK56pQpYyKxoIEXIiUv/view?usp=sharing)

## 📁 项目结构

```
Nano-Banana-Flow/
├── manifest.json      # 扩展配置文件
├── popup.html         # 弹窗界面
├── popup.css          # 界面样式
├── popup.js           # 弹窗逻辑
├── content.js         # 内容脚本（核心）
├── background.js      # 后台服务
├── icons/             # 图标资源
└── images/            # 主题图片
```

## 🛠️ 技术栈

- **Manifest V3**：Chrome 最新扩展标准
- **Content Script**：DOM 操作和页面交互
- **Service Worker**：后台任务管理
- **Chrome APIs**：Downloads API、Storage API

## 📝 更新日志

### v1.2.0 (2025-12-24)
- ✅ **UI 紧凑重构**：界面更精致，空间利用率大幅提升。
- ✅ **智能垫图**：支持直接导入图片，按文件名（如 `1_xx.jpg`）自动匹配提示词。
- ✅ **流程优化**：底部公告栏支持动态配置，新增丰富实用工具。

### v1.1.1 (2025-12-14)
- ✅ 新增对繁体中文界面（港澳台）的支持
- ✅ 修复了在繁体环境下无法识别"发送"和"停止"按钮的问题
- ⚠️ 注意：目前已验证港澳台地区，其他语言环境尚未完整测试

### v1.1.0 (2025-12-05)
- ✅ 修复了 statusIndicator 缺失导致的初始化错误
- ✅ 增强了消息传递的调试日志
- ✅ 优化了下载流程的错误处理
- ✅ 清理了冗余代码和文档

### v1.0.1
- 初始版本发布
- 批量生成图片功能
- 自动下载功能
- 进度显示功能


## 🎉 加入高质量 AI 交流群

> **扫码添加微信，我拉你进群**  
> 氛围友好 · 高密度交流 · 不水群 · 长期共建 🤝

<div align="center">
  <img src="https://gt.topgpt.us/upload/qr1.png" alt="AI交流群二维码" width="260" />
</div>

---

## ☕ 支持作者 · 请我喝杯咖啡

如果这个工具 / 内容 **对你有帮助**，  
欢迎请我喝杯咖啡 ☕️  
你的支持是我 **持续更新和深度创作** 的动力。

<div align="center">
  <img src="https://gt.topgpt.us/upload/qr2.png" alt="赞赏二维码" width="260" />
</div>

---

🙏 感谢你的支持与同行  
🤖 **一起把 AI 用到更高级的地方**

---

## 📄 开源协议与版权声明 / License & Attribution

本项目遵循 **MIT 开源协议** 发布。我们秉持开放共享的精神，鼓励技术交流与创新。您可以在协议允许的范围内免费使用、修改和分发本项目代码。

**⚠️ 引用规范 (Attribution Requirement)：**

开源不代表无主。如果您基于本项目进行了二次开发、修改，或在您的发布中使用了本项目的核心代码，**请务必遵循国际开源社区规范，在您的产品说明、代码仓库 README 或版权声明中显式注明原作者及出处**，并包含指向本项目 GitHub 仓库的链接：

> **Original Project:** [Nano Banana Flow](https://github.com/AppleResearcher/Nano-Banana-Flow)
> **Author:** AppleResearcher

尊重开发者的劳动成果，共建良好的开源生态。
Respect the work of developers and help build a healthy open source ecosystem.

---

**享受批量生图的乐趣！** 🍌
