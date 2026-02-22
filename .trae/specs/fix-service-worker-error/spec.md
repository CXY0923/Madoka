# 修复 Service Worker 注册失败 Spec

## Why

扩展加载时出现错误：
1. `Service worker registration failed. Status code: 15`
2. `Uncaught TypeError: Cannot read properties of undefined (reading 'onClicked')`

之前的修复（添加空检查）没有解决问题，错误依然存在。需要找出根本原因。

## What Changes

经过分析，发现以下可能原因：

1. **manifest.json 中 action 配置缺少 default_popup**：虽然没有 popup，但某些浏览器版本可能需要显式设置
2. **代码在模块顶层执行**：Service Worker 的模块在初始化时就执行代码，此时 `chrome.action` 可能确实未定义
3. **Vite 构建问题**：构建后的代码可能在某些环境下无法正确访问 chrome API
4. **权限问题**：可能需要 `action` 权限（虽然 Manifest V3 中 action 不需要显式权限）

## 解决方案

### 方案 1：延迟执行到 runtime.onInstalled/onStartup
将代码移到事件监听器中，确保 Service Worker 完全初始化后再执行。

### 方案 2：使用 try-catch 包装
捕获任何可能的错误，防止 Service Worker 注册失败。

### 方案 3：检查 manifest 配置
确保 action 配置完整，添加可能缺失的字段。

### 方案 4：移除 action.onClicked 监听
如果不需要点击图标打开侧边栏的功能，可以暂时移除这段代码。

## Impact

- affected code: `src/background/index.ts`
- affected file: `src/manifest.json`（可能需要修改）

## ADDED Requirements

### Requirement: Service Worker 正常注册
The system SHALL ensure Service Worker registers without errors.

#### Scenario: 扩展加载
- **WHEN** 用户加载扩展
- **THEN** Service Worker 成功注册
- **AND** 没有 JavaScript 错误

## MODIFIED Requirements

无

## REMOVED Requirements

无
