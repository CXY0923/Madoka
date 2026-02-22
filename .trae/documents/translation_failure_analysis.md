# 翻译功能失效原因分析

## 问题描述
用户反馈："翻译功能失效，一直显示正在翻译"

## 根本原因分析

### 1. API 问题（最可能的原因）

**翻译 API 使用的是 MyMemory：**
```typescript
const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`
```

**问题：**
- MyMemory 是免费的翻译 API，有严格的请求限制（每小时 1000 次）
- 该 API 在国内网络环境下可能无法访问或响应极慢
- API 返回错误时，代码没有正确处理超时情况

**证据：**
```typescript
const res = await fetch(url)  // 没有超时处理！
```

如果 fetch 请求挂起（网络问题），翻译会一直显示"正在翻译..."

### 2. 拖动功能引入的问题

用户提到："我添加了可拖动弹窗后就出问题了"

**可能的问题：**

#### A. 事件监听器冲突
```typescript
// translation-popup.ts 中的拖动事件
header.addEventListener('mousedown', startDrag)
document.addEventListener('mousemove', doDrag)
document.addEventListener('mouseup', stopDrag)
```

这些事件监听器在弹窗关闭时**没有被清理**，导致：
- 内存泄漏
- 事件处理函数累积
- 可能干扰其他功能

#### B. 弹窗状态管理问题
```typescript
let translationPopup: TranslationPopup | null = null

export function getTranslationPopup(): TranslationPopup {
  if (!translationPopup) {
    translationPopup = new TranslationPopup()
  }
  return translationPopup
}
```

使用单例模式，但如果弹窗状态（isOpen, popup 元素等）没有正确重置，可能导致：
- 新翻译请求无法正确显示结果
- updateContent 被调用时 popup 元素已经不存在

### 3. 异步处理逻辑问题

**翻译流程：**
1. 用户选中文本 → 显示弹窗（显示"正在翻译..."）
2. 发送消息到 background
3. Background 调用 API
4. API 返回结果
5. 更新弹窗内容

**潜在问题点：**

#### A. 回调地狱和 this 指向
```typescript
chrome.runtime.sendMessage(
  { action: 'translate', ... },
  (response) => {
    // 这里的 popup 是闭包中的变量
    popup.updateContent({...})  // 如果弹窗已关闭，popup 对象可能已失效
  }
)
```

#### B. 没有超时处理
如果 API 请求超过一定时间没有响应，应该显示错误而不是一直"正在翻译"

### 4. 网络/扩展上下文问题

**Extension Context Invalidated** 错误：
- 当扩展重新加载时发生
- 但这应该是偶发情况，不是翻译失效的主要原因

## 诊断步骤

### 步骤 1：检查 API 是否可用
```bash
curl "https://api.mymemory.translated.net/get?q=hello&langpair=en|zh"
```

### 步骤 2：查看浏览器控制台
1. 打开任意网页
2. 按 F12 打开开发者工具
3. 切换到 Console 标签
4. 选中文本触发翻译
5. 查看是否有错误信息

### 步骤 3：检查 Background 控制台
1. 打开 `chrome://extensions/`
2. 找到 Madoka 扩展
3. 点击"背景页"（或"service worker"）
4. 查看 Console 中的错误

## 修复方案

### 方案 1：添加 API 超时处理（最紧急）

```typescript
// background/index.ts
if (request.action === 'translate') {
  ;(async () => {
    try {
      const text = request.text as string
      const langpair = (request.langpair as string) || 'en|zh'
      if (!text || !text.trim()) {
        sendResponse({ success: false, error: '待翻译文本为空' })
        return
      }
      
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`
      
      // 添加超时处理
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
      
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      
      const json = (await res.json()) as {
        responseData?: { translatedText?: string }
        responseStatus?: number
      }
      const translatedText = json.responseData?.translatedText?.trim() ?? ''
      if (translatedText) {
        sendResponse({ success: true, translatedText })
      } else {
        sendResponse({
          success: false,
          error: json.responseStatus === 200 ? '翻译结果为空' : `API 错误: ${json.responseStatus ?? res.status}`,
        })
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        sendResponse({ success: false, error: '翻译请求超时，请检查网络连接' })
      } else {
        console.error('[Madoka BG] Translate failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    }
  })()
  return true
}
```

### 方案 2：修复拖动事件清理

确保 `cleanupDragEvents` 在 `close()` 中被调用，并且正确清理所有事件监听器。

### 方案 3：添加备用翻译 API

如果 MyMemory 失败，可以尝试其他免费 API：
- Google Translate API（需要 API key）
- LibreTranslate
- 或者使用 LLM API（项目中已有 Tongyi API）

### 方案 4：改进错误处理和用户反馈

在 content script 中添加：
```typescript
// 如果 10 秒后还没有收到响应，显示超时错误
const timeoutId = setTimeout(() => {
  popup.updateContent({
    originalText: textToTranslate,
    error: '翻译请求超时，请重试',
  })
}, 10000)

chrome.runtime.sendMessage(
  { action: 'translate', text: textToTranslate, langpair },
  (response) => {
    clearTimeout(timeoutId)  // 清除超时定时器
    // ... 原有逻辑
  }
)
```

## 最可能的根本原因

**MyMemory API 在国内网络环境下无法访问或响应极慢**，导致 fetch 请求挂起，翻译一直显示"正在翻译..."

建议：
1. 首先添加超时处理
2. 考虑更换为更稳定的翻译 API
3. 或者使用项目中已有的 Tongyi LLM API 进行翻译
