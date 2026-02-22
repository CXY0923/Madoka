# 修复 Extension Context Invalidated 错误计划

## 问题分析

错误信息：`Uncaught Error: Extension context invalidated.`

这个错误发生在浏览器扩展中，当：

1. 扩展被重新加载（代码更新、扩展重启）
2. Content Script 尝试与已失效的 Background Service Worker 通信
3. 页面上的旧 Content Script 实例仍在运行，但扩展上下文已刷新

## 根本原因

在 `content/index.ts` 中，翻译功能使用 `chrome.runtime.sendMessage` 发送消息，但没有处理扩展上下文失效的情况。

## 修复方案

### 1. 添加扩展上下文有效性检查

在发送消息前检查 `chrome.runtime.id` 是否存在：

```typescript
// 检查扩展上下文是否有效
function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime.id
  } catch {
    return false
  }
}
```

### 2. 修改翻译消息发送逻辑

在 `setupSelectionTranslate()` 函数中，发送消息前检查上下文：

```typescript
if (!isExtensionContextValid()) {
  popup.updateContent({
    originalText: textToTranslate,
    error: '扩展已更新，请刷新页面后重试',
  })
  return
}
```

### 3. 添加消息发送的错误处理

增强 `chrome.runtime.sendMessage` 的错误处理：

```typescript
chrome.runtime.sendMessage(
  { action: 'translate', text: textToTranslate, langpair },
  (response) => {
    // 检查上下文是否失效
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message || ''
      if (errorMsg.includes('Extension context invalidated')) {
        popup.updateContent({
          originalText: textToTranslate,
          error: '扩展已更新，请刷新页面后重试',
        })
      } else {
        popup.updateContent({
          originalText: textToTranslate,
          error: errorMsg || '翻译请求失败',
        })
      }
      return
    }
    // ... 原有逻辑
  }
)
```

### 4. 监听扩展更新事件

在 Content Script 中监听扩展更新/卸载事件，清理资源：

```typescript
// 监听扩展上下文变化
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true })
    return true
  }
  // ... 其他处理
})
```

### 5. 在 Background 中添加连接保持机制

定期发送心跳消息，检测连接状态：

```typescript
// 可选：定期向所有标签页发送心跳
setInterval(() => {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'ping' }).catch(() => {})
      }
    })
  })
}, 30000) // 每30秒
```

## 实施步骤

1. **修改** **`content/index.ts`**

   * 添加 `isExtensionContextValid()` 辅助函数

   * 修改翻译消息发送逻辑，添加上下文检查

   * 增强错误处理

2. **修改** **`content/translation-popup.ts`**

   * 确保拖动事件监听器正确清理（已完成）

   * 修复 `updateContent` 对空字符串的处理（已完成）

3. **修改** **`background/index.ts`**

   * 添加 ping 处理（已存在，确认可用）

   * 可选：添加心跳机制

4. **测试验证**

   * 正常翻译功能

   * 扩展重新加载后刷新页面

   * 拖动功能正常工作

## 文件变更清单

* `src/content/index.ts` - 添加上下文检查和错误处理

* `src/content/translation-popup.ts` - 已完成拖动事件清理和空字符串处理

## 预期结果

* 翻译功能正常工作

* 扩展更新后显示友好的错误提示

* 拖动功能正常工作且不会导致内存泄漏

