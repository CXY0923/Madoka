# 最终修复 Service Worker 注册失败 Spec

## Why

之前的修复尝试（延迟执行 + try-catch）仍然无法解决问题，错误依然存在：
- `Service worker registration failed. Status code: 15`
- `Uncaught TypeError: Cannot read properties of undefined (reading 'onClicked')`

根本原因是代码中第 1530 行的 `initializeExtension()` 立即执行，在 Service Worker 初始化时就访问了 `chrome.action`。

## What Changes

### 根本原因分析

```typescript
// 第 1530 行 - 这行代码在模块加载时立即执行
initializeExtension()
```

虽然函数内部有 try-catch，但错误发生在 Service Worker 注册阶段，导致整个 Service Worker 无法启动。

### 解决方案

**方案 1：移除立即执行调用**
只保留 `onInstalled` 和 `onStartup` 事件监听，完全移除第 1530 行的立即执行调用。

**方案 2：使用可选链操作符**
```typescript
chrome.action?.onClicked?.addListener(...)
```

**方案 3：完全移除 action.onClicked**
如果不需要点击图标打开侧边栏的功能，直接删除相关代码。

## 推荐方案

**方案 1 + 方案 2 组合**：
1. 移除立即执行的 `initializeExtension()` 调用
2. 使用可选链操作符进一步保护
3. 保留事件监听用于正常启动场景

## Impact

- affected code: `src/background/index.ts` (第 1529-1530 行)

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
