# Bug 原因详细讲解

## 问题现象

1. 翻译功能一直显示"正在翻译..."
2. 控制台报错：`Uncaught Error: Extension context invalidated.`

## 浏览器扩展架构基础

要理解这个 Bug，首先需要了解浏览器扩展的架构：

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器页面                            │
│  ┌─────────────────┐        ┌──────────────────────────┐   │
│  │   Content Script │        │      网页内容            │   │
│  │  (注入到页面中)   │        │                         │   │
│  │                 │        │                         │   │
│  │  - 可以访问 DOM  │        │                         │   │
│  │  - 可以访问部分  │        │                         │   │
│  │    chrome API   │        │                         │   │
│  └────────┬────────┘        └──────────────────────────┘   │
│           │                                                 │
│           │ 通过 chrome.runtime.sendMessage 通信           │
│           ▼                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Background Service Worker                 │   │
│  │                                                    │   │
│  │  - 处理 API 请求                                    │   │
│  │  - 管理扩展生命周期                                 │   │
│  │  - 调用翻译 API                                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 正常情况下的翻译流程

```
用户选中文本
    │
    ▼
触发 mouseup 事件
    │
    ▼
Content Script 显示弹窗"正在翻译..."
    │
    ▼
Content Script 调用 chrome.runtime.sendMessage
    │
    ▼
Background 接收消息，调用翻译 API
    │
    ▼
API 返回结果
    │
    ▼
Background 通过 sendResponse 返回结果
    │
    ▼
Content Script 回调函数执行
    │
    ▼
更新弹窗显示翻译结果
```

## 问题发生时的流程

当扩展代码更新（重新加载）时：

```
扩展重新加载
    │
    ▼
Background Service Worker 被终止并重启
    │
    ▼
Content Script 仍然保留在页面上
    │
    ▼
用户选中文本
    │
    ▼
Content Script 显示弹窗"正在翻译..."
    │
    ▼
Content Script 调用 chrome.runtime.sendMessage
    │
    ▼
💥 抛出异常：Extension context invalidated
    │
    ▼
代码执行中断，回调函数永远不会执行
    │
    ▼
弹窗永远显示"正在翻译..."（无法更新）
```

## 核心问题：同步异常 vs 异步错误

### 错误的理解（最初的修复思路）

```typescript
// ❌ 错误的理解
chrome.runtime.sendMessage(
  { action: 'translate', ... },
  (response) => {
    // 我以为错误会在这里返回
    if (chrome.runtime.lastError) {
      // 处理错误
    }
  }
)
```

我以为 `chrome.runtime.lastError` 会在回调中返回所有错误。

### 实际情况

```typescript
// ✅ 实际情况
chrome.runtime.sendMessage(
  { action: 'translate', ... },
  (response) => {
    // 如果扩展上下文失效，这行代码永远不会执行！
    if (chrome.runtime.lastError) {
      // 只能捕获异步错误
    }
  }
)
// 如果扩展上下文失效，sendMessage 本身会抛出同步异常
// 异常没有被捕获，代码执行中断
```

### 关键区别

| 错误类型 | 发生时机 | 捕获方式 | 示例 |
|---------|---------|---------|------|
| **同步异常** | 调用函数时立即抛出 | try-catch | Extension context invalidated |
| **异步错误** | 回调函数执行时 | chrome.runtime.lastError | 网络错误、API 错误 |

## 为什么之前的修复无效

### 第一次修复：只检查了 chrome.runtime.lastError

```typescript
chrome.runtime.sendMessage(
  { action: 'translate', ... },
  (response) => {
    // 检查扩展上下文是否失效
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message || ''
      if (errorMsg.includes('Extension context invalidated')) {
        // 处理错误
      }
    }
  }
)
```

**问题**：当扩展上下文失效时，`sendMessage` 会**立即抛出同步异常**，回调函数永远不会执行，所以 `chrome.runtime.lastError` 的检查永远不会运行。

### 第二次修复：添加了超时处理

```typescript
let timeoutId = setTimeout(() => {
  popup.updateContent({
    error: '翻译请求超时，请重试',
  })
}, 15000)

chrome.runtime.sendMessage(...)
```

**问题**：虽然添加了超时，但如果 `sendMessage` 抛出同步异常，代码执行中断，超时回调也不会被清除，但这不是主要问题。主要问题是异常没有被捕获。

## 正确的修复

```typescript
try {
  chrome.runtime.sendMessage(
    { action: 'translate', ... },
    (response) => {
      // 清除超时
      clearTimeout(timeoutId)
      
      // 检查异步错误
      if (chrome.runtime.lastError) {
        // 处理异步错误
      }
      
      // 处理响应
    }
  )
} catch (e) {
  // ✅ 捕获同步异常（如 Extension context invalidated）
  clearTimeout(timeoutId)
  
  const errorMsg = (e as Error).message
  if (errorMsg.includes('Extension context invalidated')) {
    popup.updateContent({
      error: '扩展已更新，请刷新页面后重试',
    })
  }
}
```

## 类比理解

可以把这个问题类比为：

### 打电话的类比

**正常情况**：
- 你打电话给朋友（sendMessage）
- 朋友接听，处理事情，然后回复你（回调执行）
- 如果朋友那边有问题，他会告诉你（chrome.runtime.lastError）

**扩展上下文失效的情况**：
- 你打电话给朋友
- 但是朋友的电话号码已经失效了（扩展重新加载）
- 电话系统立即报错"号码不存在"（抛出同步异常）
- 你连电话都没打通，更不可能听到朋友的回复

### 快递的类比

**正常情况**：
- 你寄出一个包裹（sendMessage）
- 快递员送达，收件人签收（回调执行）
- 如果收件人拒收，快递员会告诉你（chrome.runtime.lastError）

**扩展上下文失效的情况**：
- 你寄出一个包裹
- 但是快递公司的系统显示"该公司已注销"（抛出同步异常）
- 包裹根本没被收走，更不可能有签收反馈

## 总结

**根本原因**：
1. 扩展重新加载导致 Background Service Worker 重启
2. Content Script 仍然运行在页面上，但无法与新的 Background 通信
3. `chrome.runtime.sendMessage` 抛出同步异常 `Extension context invalidated`
4. 异常未被捕获，代码执行中断
5. 回调函数永远不会执行，弹窗无法更新

**解决方案**：
- 使用 `try-catch` 包装 `chrome.runtime.sendMessage` 调用
- 在 catch 块中捕获 `Extension context invalidated` 错误
- 更新弹窗显示友好的错误提示

**教训**：
- Chrome API 的错误可能是同步异常，也可能是异步错误
- 需要同时处理两种情况
- 不要假设所有错误都会在回调中返回
