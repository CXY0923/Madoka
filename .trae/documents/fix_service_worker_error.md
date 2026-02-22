# 修复 Service Worker 注册失败和 onClicked 错误

## 问题分析

错误信息：
1. `Service worker registration failed. Status code: 15`
2. `Uncaught TypeError: Cannot read properties of undefined (reading 'onClicked')`

### 根本原因

`chrome.action` API 在 Manifest V3 中需要特定的权限或配置。错误表明 `chrome.action` 对象未定义，可能原因：

1. **manifest.json 中 action 配置问题**：虽然配置了 `action`，但可能有其他问题
2. **代码执行时机问题**：`chrome.action.onClicked` 在 Service Worker 启动时立即执行，但此时 API 可能未准备好
3. **权限问题**：虽然 manifest 中有 `activeTab` 权限，但可能需要其他权限
4. **Service Worker 注册失败**：Status code 15 通常表示 Service Worker 脚本有错误

## 解决方案

### 方案 1：添加空检查（推荐）

在访问 `chrome.action` 之前添加空检查：

```typescript
// Open Side Panel on extension icon click
if (chrome.action) {
  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId })
    }
  })
} else {
  console.error('[Madoka] chrome.action is not available')
}
```

### 方案 2：延迟初始化

将事件监听器包装在 `chrome.runtime.onStartup` 或 `chrome.runtime.onInstalled` 中：

```typescript
// Open Side Panel on extension icon click
chrome.runtime.onStartup.addListener(() => {
  chrome.action?.onClicked?.addListener((tab) => {
    if (tab.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId })
    }
  })
})
```

### 方案 3：检查 manifest 配置

确保 manifest.json 中 action 配置正确：

```json
{
  "action": {
    "default_icon": {
      "16": "public/icons/icon16.png",
      "48": "public/icons/icon48.png",
      "128": "public/icons/icon128.png"
    },
    "default_title": "打开 Madoka 助手",
    "default_popup": ""  // 如果不使用 popup，可以留空或省略
  }
}
```

### 方案 4：移除 setPanelBehavior（如果不需要）

`setPanelBehavior` 可能与 `onClicked` 冲突：

```typescript
// 只保留一个方式打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId })
  }
})

// 移除 setPanelBehavior，或者只使用 setPanelBehavior
// chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
```

## 推荐修复

**方案 1 + 方案 4 的组合**：

1. 添加空检查防止 undefined 错误
2. 移除 `setPanelBehavior`，只使用 `onClicked`
3. 添加错误处理

```typescript
// Open Side Panel on extension icon click
if (typeof chrome !== 'undefined' && chrome.action) {
  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch((error) => {
        console.error('[Madoka] Failed to open side panel:', error)
      })
    }
  })
} else {
  console.warn('[Madoka] chrome.action is not available, side panel click handler not registered')
}
```

## 文件变更

- `src/background/index.ts` - 修改 action.onClicked 相关代码

## 预期结果

- Service Worker 正常注册
- 不再出现 `Cannot read properties of undefined` 错误
- 点击扩展图标可以正常打开侧边栏
