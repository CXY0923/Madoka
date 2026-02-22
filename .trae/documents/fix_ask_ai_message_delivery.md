# 修复"问 AI"消息未送达侧边栏问题

## 问题分析

现象：点击"问 AI"按钮显示"已发送"，但侧边栏中没有显示内容。

### 可能的原因

1. **侧边栏打开延迟**：`chrome.sidePanel.open()` 是异步的，但代码没有等待它完成
2. **消息发送时机**：在侧边栏完全打开之前就发送了消息
3. **Sidepanel 未准备好**：React 应用可能还在初始化，消息监听器尚未注册
4. **消息丢失**：`chrome.runtime.sendMessage` 在 sidepanel 未打开时发送会失败

### 当前代码流程

```
用户点击"问 AI"
    ↓
Content Script 发送消息到 Background
    ↓
Background 立即调用 sidePanel.open()（异步，不等待）
    ↓
Background 500ms 后发送消息到 sidepanel
    ↓
Sidepanel 可能还没准备好，消息丢失
```

## 解决方案

### 方案 1：使用 chrome.storage 作为消息队列（推荐）

使用 `chrome.storage.session` 存储原文，sidepanel 打开后自行读取：

```typescript
// background/index.ts
if (request.action === 'askAI') {
  const tabId = sender.tab?.id
  if (!tabId) {
    sendResponse({ success: false, error: '无法获取当前标签页' })
    return true
  }

  const text = request.text as string
  if (!text?.trim()) {
    sendResponse({ success: false, error: '原文为空' })
    return true
  }

  // 存储原文到 session storage
  await chrome.storage.session.set({ pendingQuestion: text })

  // 打开侧边栏
  await chrome.sidePanel.open({ tabId })

  sendResponse({ success: true })
  return true
}
```

```typescript
// sidepanel/InputArea.tsx
useEffect(() => {
  // 检查是否有待处理的问题
  const checkPendingQuestion = async () => {
    const result = await chrome.storage.session.get('pendingQuestion')
    if (result.pendingQuestion) {
      setInput(result.pendingQuestion)
      // 清除存储
      await chrome.storage.session.remove('pendingQuestion')
      // 自动发送
      setTimeout(() => {
        if (!isResponding) {
          sendMessage(result.pendingQuestion)
          setInput('')
        }
      }, 500)
    }
  }
  
  checkPendingQuestion()
  
  // 也监听消息（作为备用）
  const handleMessage = ...
  chrome.runtime.onMessage.addListener(handleMessage)
  return () => {
    chrome.runtime.onMessage.removeListener(handleMessage)
  }
}, [])
```

### 方案 2：轮询检查 sidepanel 是否准备好

Background 发送消息后，sidepanel 确认接收：

```typescript
// background/index.ts
if (request.action === 'askAI') {
  const tabId = sender.tab?.id
  if (!tabId) {
    sendResponse({ success: false, error: '无法获取当前标签页' })
    return true
  }

  const text = request.text as string
  if (!text?.trim()) {
    sendResponse({ success: false, error: '原文为空' })
    return true
  }

  // 打开侧边栏
  await chrome.sidePanel.open({ tabId })

  // 轮询发送消息，直到 sidepanel 接收成功
  let attempts = 0
  const maxAttempts = 10
  const interval = setInterval(async () => {
    attempts++
    try {
      await chrome.runtime.sendMessage({
        action: 'sendToSidepanel',
        text: text,
      })
      clearInterval(interval)
    } catch (e) {
      if (attempts >= maxAttempts) {
        clearInterval(interval)
        console.error('[Madoka BG] Failed to send message to sidepanel after max attempts')
      }
    }
  }, 500)

  sendResponse({ success: true })
  return true
}
```

### 方案 3：Sidepanel 主动请求数据

Sidepanel 打开后主动向 background 请求数据：

```typescript
// background/index.ts
// 存储待发送的问题
let pendingQuestion: string | null = null

if (request.action === 'askAI') {
  const tabId = sender.tab?.id
  if (!tabId) {
    sendResponse({ success: false, error: '无法获取当前标签页' })
    return true
  }

  const text = request.text as string
  if (!text?.trim()) {
    sendResponse({ success: false, error: '原文为空' })
    return true
  }

  // 存储问题
  pendingQuestion = text

  // 打开侧边栏
  await chrome.sidePanel.open({ tabId })

  sendResponse({ success: true })
  return true
}

// 处理 sidepanel 的请求
if (request.action === 'getPendingQuestion') {
  sendResponse({ question: pendingQuestion })
  pendingQuestion = null // 清空
  return true
}
```

```typescript
// sidepanel/InputArea.tsx
useEffect(() => {
  // 组件挂载后请求待处理的问题
  const fetchPendingQuestion = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getPendingQuestion' })
      if (response?.question) {
        setInput(response.question)
        setTimeout(() => {
          if (!isResponding) {
            sendMessage(response.question)
            setInput('')
          }
        }, 500)
      }
    } catch (e) {
      console.log('[Madoka Sidepanel] No pending question')
    }
  }
  
  fetchPendingQuestion()
}, [])
```

## 推荐方案

**方案 1（chrome.storage）** 是最可靠的，因为：

1. 不依赖消息传递的时机
2. Sidepanel 可以在任何时候检查存储
3. 即使 sidepanel 重新加载，数据仍然存在

## 实施计划

### 修改文件

1. **src/background/index.ts**

   * 使用 `chrome.storage.session.set()` 存储原文

   * 等待 `sidePanel.open()` 完成

2. **src/sidepanel/components/InputArea.tsx**

   * 组件挂载时检查 `chrome.storage.session`

   * 获取原文后自动填入并发送

   * 清除存储

### 预期结果

* 点击"问 AI"后，原文被可靠地存储

* 侧边栏打开后自动获取原文

* 原文填入输入框并自动发送

* 用户可以看到 AI 的回答

