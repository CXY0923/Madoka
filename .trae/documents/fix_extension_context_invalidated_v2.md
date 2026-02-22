# 修复 Extension Context Invalidated 错误计划 V2

## 问题深入分析

错误信息：`Uncaught Error: Extension context invalidated.`
位置：`assets/index.ts-BJjdu9Zy.js:475`

### 根本原因

当浏览器扩展重新加载（代码更新）时：
1. **Background Service Worker** 被终止并重新启动
2. **Content Script** 仍然保留在页面上（因为注入到 DOM 中）
3. Content Script 中所有对 `chrome.runtime` 的访问都会抛出错误
4. 这包括：
   - `chrome.runtime.sendMessage()`
   - `chrome.runtime.onMessage.addListener()`
   - `chrome.runtime.id` 访问
   - 任何 `chrome.runtime.*` 的调用

### 为什么之前的修复不够

之前的修复只在 `sendMessage` 时检查上下文，但问题是：
1. **消息监听器**在扩展重新加载后已经失效，但代码仍在运行
2. **所有 chrome API 调用**都会失败，不仅仅是 sendMessage
3. 需要一种机制来检测扩展已更新，并重新注入 content script

## 修复方案

### 方案 1：添加全局错误捕获和上下文检查（推荐）

在 content script 最外层包装所有 chrome API 调用：

```typescript
// 在 content/index.ts 顶部添加

/**
 * 检查扩展上下文是否有效
 */
function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime.id
  } catch {
    return false
  }
}

/**
 * 安全地发送消息到 background
 */
function sendMessageSafely(
  message: unknown,
  callback?: (response: unknown) => void
): boolean {
  if (!isExtensionContextValid()) {
    console.warn('[Madoka Content] Extension context invalidated, cannot send message')
    if (callback) {
      callback({ success: false, error: 'Extension context invalidated' })
    }
    return false
  }
  
  try {
    chrome.runtime.sendMessage(message, callback)
    return true
  } catch (e) {
    console.error('[Madoka Content] Failed to send message:', e)
    if (callback) {
      callback({ success: false, error: (e as Error).message })
    }
    return false
  }
}
```

### 方案 2：修改消息监听器注册

将 `chrome.runtime.onMessage.addListener` 包装在 try-catch 中：

```typescript
// 修改现有的消息监听
let messageListenerActive = false

try {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    // 检查上下文是否有效
    if (!isExtensionContextValid()) {
      sendResponse({ success: false, error: 'Extension context invalidated' })
      return false
    }
    
    messageListenerActive = true
    console.log('[Madoka Content] 收到消息:', request.action)
    // ... 原有逻辑
  })
} catch (e) {
  console.error('[Madoka Content] Failed to register message listener:', e)
}
```

### 方案 3：在翻译功能中添加全面的错误处理

修改 `setupSelectionTranslate` 函数，在所有 chrome API 调用处添加检查：

```typescript
function setupSelectionTranslate(): void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  document.addEventListener('mouseup', (e: MouseEvent) => {
    // 检查上下文
    if (!isExtensionContextValid()) {
      console.warn('[Madoka Content] Extension context invalidated, translation disabled')
      return
    }
    
    // ... 原有逻辑
    
    chrome.runtime.sendMessage(
      { action: 'translate', text: textToTranslate, langpair },
      (response) => {
        try {
          // 检查错误
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message || ''
            // 如果是上下文失效错误，显示友好提示
            if (errorMsg.includes('Extension context invalidated') || 
                errorMsg.includes('context invalidated')) {
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
        } catch (e) {
          // 捕获任何其他错误
          console.error('[Madoka Content] Error in translation callback:', e)
          popup.updateContent({
            originalText: textToTranslate,
            error: '翻译过程中发生错误',
          })
        }
      }
    )
  })
}
```

### 方案 4：检测扩展更新并自动刷新（可选高级方案）

在 background 中监听扩展更新，然后重新注入 content script：

```typescript
// 在 background/index.ts 中

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    console.log('[Madoka] Extension updated, reloading content scripts...')
    
    // 向所有标签页发送重新加载消息
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'extensionUpdated' })
        } catch {
          // 忽略错误，页面可能没有 content script
        }
      }
    }
  }
})
```

在 content script 中监听：

```typescript
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'extensionUpdated') {
    // 扩展已更新，提示用户刷新页面
    console.log('[Madoka Content] Extension updated, please refresh the page')
    // 可以显示一个提示弹窗
    return true
  }
  // ... 其他处理
})
```

## 实施步骤

### 步骤 1：添加全局辅助函数

在 `content/index.ts` 顶部添加 `isExtensionContextValid` 和 `sendMessageSafely` 函数。

### 步骤 2：修改消息监听器

将所有 `chrome.runtime.onMessage.addListener` 调用包装在 try-catch 中。

### 步骤 3：修改翻译功能

在 `setupSelectionTranslate` 中添加全面的错误处理。

### 步骤 4：检查其他 chrome API 调用

检查 `content/index.ts` 中所有其他 `chrome.runtime` 调用，添加相同的错误处理。

### 步骤 5：构建和测试

构建项目并在浏览器中测试：
1. 正常翻译功能
2. 扩展重新加载后的行为
3. 拖动功能

## 关键修改点

1. **content/index.ts:66** - 消息监听器注册
2. **content/index.ts:380-450** - 翻译功能
3. **content/index.ts:所有 chrome.runtime 调用** - 添加错误处理

## 预期结果

- 正常使用时翻译功能正常工作
- 扩展更新后，用户会看到友好的错误提示
- 不会再出现未捕获的 "Extension context invalidated" 错误
- 拖动功能正常工作
