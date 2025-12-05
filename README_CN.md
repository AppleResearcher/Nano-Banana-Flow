# 🍌 Nano Banana Flow

> 大香蕉批量生图神器 - Gemini AI 图片批量生成工具

[![Version](https://img.shields.io/badge/version-1.1.0-gold.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://github.com/AppleResearcher/Nano-Banana-Flow)

[English](README.md)

一个强大的 Chrome 浏览器扩展，帮助您在 Gemini 页面上批量生成图片并自动下载保存。

## ✨ 功能特性

- 🎨 **批量生图**：一次输入多个提示词，自动逐个生成图片
- 📥 **自动下载**：生成的图片自动下载并按序命名（page1.png, page2.png...）
- 📊 **实时进度**：直观的进度条显示当前生成状态
- 💾 **智能保存**：自动保存上次输入的提示词
- 🎯 **简单易用**：现代化 UI 设计，操作直观
- ⏹️ **任务控制**：支持随时停止正在进行的任务

## 📦 安装步骤

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

## 🔧 常见问题

### Q: 插件无法找到输入框？
请确保在 `https://gemini.google.com/app` 页面，且页面已完全加载。如果仍有问题，尝试刷新页面。

### Q: 图片生成超时？
默认超时时间为 2 分钟。如果网络较慢，建议检查网络连接。

### Q: 下载失败？
- 确保扩展有下载权限
- 尝试使用简单的目录名（避免特殊字符）
- 刷新 Gemini 页面后重试

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

## 📄 许可证

MIT License

---

**享受批量生图的乐趣！** 🍌
