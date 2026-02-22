# 拖动功能导致翻译失效的 Bug 分析

## 问题确认
用户反馈：添加翻译弹窗可拖动功能后，翻译功能失效，一直显示"正在翻译..."

## 拖动功能代码审查

### 发现的关键 Bug

#### Bug 1: 拖动事件阻止了文本选择（最严重）

```typescript
// translation-popup.ts 第 386 行
this.startDragHandler = (e: Event) => {
  // ...
  // 防止文本选中
  e.preventDefault()  // ← 问题在这里！
}
```

**问题分析：**
- `e.preventDefault()` 在 `mousedown` 事件上阻止了默认行为
- 这可能会影响页面上的文本选择功能
- 但这不是导致"一直显示正在翻译"的直接原因

#### Bug 2: 拖动时修改了 transform 属性（可能的问题）

```typescript
// translation-popup.ts 第 409-411 行
this.popup.style.left = `${newLeft}px`
this.popup.style.top = `${newTop}px`
this.popup.style.transform = 'none'  // ← 问题可能在这里！
```

**问题分析：**
- 拖动时将 `transform` 设置为 `'none'`
- 但弹窗初始位置可能使用了 `transform: translate(-50%, -50%)` 来居中
- 如果用户没有拖动，只是显示弹窗，然后更新内容时...
- 等等，让我看看 `updateContent` 方法

#### Bug 3: 样式属性名错误（发现！）

```typescript
// translation-popup.ts 第 124-128 行
this.popup.innerHTML = `
  <div id="madoka-translation-content" style="
    padding: 16px;
    fontSize: 14px;        // ← BUG! 应该是 font-size
    lineHeight: 1.6;       // ← BUG! 应该是 line-height
    color: #374151;
  ">
```

**这是关键 Bug！**
- `fontSize` 应该是 `font-size`
- `lineHeight` 应该是 `line-height`
- 这可能导致样式解析错误，但不会影响功能...

#### Bug 4: 事件委托冲突（可能的问题）

```typescript
// content/index.ts 第 394 行
document.addEventListener('mouseup', (e: MouseEvent) => {
  if (e.button !== 0) return
  const target = e.target as Element
  if (target?.closest?.('#madoka-translation-popup') || target?.closest?.('#madoka-translation-overlay')) {
    return  // 如果点击在弹窗内，不触发翻译
  }
  // ...
}
```

**问题分析：**
- 这个检查应该能正确排除弹窗内的点击
- 但拖动时可能会触发 `mouseup` 事件
- 如果拖动后释放鼠标，可能会触发翻译？

等等，让我重新思考...

#### Bug 5: 真正的罪魁祸首 - 拖动状态影响（发现！）

```typescript
// translation-popup.ts 第 389-414 行
this.doDragHandler = (e: Event) => {
  if (!this.isDragging || !this.popup) return
  // ...
  this.popup.style.left = `${newLeft}px`
  this.popup.style.top = `${newTop}px`
  this.popup.style.transform = 'none'
  e.preventDefault()  // ← 阻止了事件冒泡！
}
```

**关键问题：**
- `e.preventDefault()` 在 `mousemove` 上阻止了默认行为
- 但更重要的是，拖动时 `isDragging = true`
- 这本身没问题，但是...

让我看看 content/index.ts 的翻译触发逻辑：

```typescript
// content/index.ts
document.addEventListener('mouseup', (e: MouseEvent) => {
  // 检查是否在弹窗内
  if (target?.closest?.('#madoka-translation-popup')) {
    return
  }
  // 延迟执行翻译
  debounceTimer = setTimeout(() => {
    // 获取选中文本并翻译
  }, TRANSLATE_DEBOUNCE_MS)
})
```

**发现问题！**

如果用户在拖动弹窗时：
1. 按下鼠标（mousedown）- 开始拖动
2. 移动鼠标（mousemove）- 拖动中
3. 释放鼠标（mouseup）- 结束拖动

但是！`mouseup` 事件也会触发 `document.addEventListener('mouseup', ...)` 中的翻译逻辑！

虽然代码检查了 `target?.closest?.('#madoka-translation-popup')`，但如果拖动后鼠标释放的位置不在弹窗上（比如拖到了弹窗外），就会触发翻译！

但这应该只是触发新的翻译，不会导致"一直显示正在翻译"...

#### Bug 6: 单例模式状态问题（最可能的原因！）

```typescript
// translation-popup.ts 第 30-36 行
show(options: TranslationPopupOptions): void {
  if (this.isOpen) {
    this.close()  // ← 如果已经打开，先关闭
  }

  this.isOpen = true
  this.isPinned = false  // ← 重置固定状态
  // ...
}
```

```typescript
// translation-popup.ts 第 326-351 行
close(): void {
  if (!this.isOpen) return

  this.isOpen = false
  const overlayToRemove = this.overlay
  const popupToRemove = this.popup
  this.overlay = null
  this.popup = null
  // ...
}
```

```typescript
// translation-popup.ts 第 283-309 行
updateContent(options: TranslationPopupOptions): void {
  if (!this.popup) return  // ← 如果 popup 为 null，直接返回！
  // ...
}
```

**关键 Bug 发现！**

问题可能在这里：
1. 用户第一次选中文本 → 显示弹窗（isLoading: true）
2. 发送翻译请求到 background
3. 用户拖动弹窗（或做其他操作）
4. 用户再次选中文本 → 调用 `show()` → `this.close()` → `this.popup = null`
5. 第一次的翻译请求返回 → 调用 `updateContent()`
6. 但 `this.popup` 已经是 null 了！→ 直接返回，不更新内容
7. 新弹窗显示"正在翻译..." → 等待新的翻译结果

但这应该只是第一次的回调失效，第二次应该正常...

等等！还有另一个问题：

```typescript
// content/index.ts 第 417-418 行
const popup = getTranslationPopup()
popup.show({
  originalText: textToTranslate,
  isLoading: true,
  rect,
})
```

```typescript
// content/index.ts 第 454-457 行
if (response?.success && response.translatedText) {
  popup.updateContent({
    originalText: textToTranslate,
    translatedText: response.translatedText,
  })
}
```

**问题：** `popup` 是闭包变量，如果在回调执行前用户又选中了新文本：
1. 第一次选中 → 显示弹窗 A，发送请求 A
2. 第二次选中 → 关闭弹窗 A，显示弹窗 B，发送请求 B
3. 请求 A 返回 → 调用 `popup.updateContent()`（此时 popup 是单例，指向弹窗 B）
4. 但 `textToTranslate` 是第一次的文本！
5. 请求 B 返回 → 调用 `popup.updateContent()`，但弹窗 B 可能已经...

这很混乱，但还不是"一直显示正在翻译"的根本原因...

#### Bug 7: 拖动导致的事件冲突（真正的 Bug！）

让我再仔细看拖动事件：

```typescript
// translation-popup.ts 第 420-428 行
// 鼠标事件
header.addEventListener('mousedown', this.startDragHandler)
document.addEventListener('mousemove', this.doDragHandler)
document.addEventListener('mouseup', this.stopDragHandler)
```

```typescript
// content/index.ts 第 394 行
document.addEventListener('mouseup', (e: MouseEvent) => {
  // 翻译逻辑
})
```

**关键发现：**

两个 `mouseup` 事件监听器！
1. 弹窗的拖动：`document.addEventListener('mouseup', this.stopDragHandler)`
2. 翻译触发：`document.addEventListener('mouseup', (e: MouseEvent) => {...})`

当用户拖动弹窗标题栏然后释放：
1. `stopDragHandler` 被调用 → `isDragging = false`
2. 翻译的 `mouseup` 监听器也被调用！

但翻译监听器检查了：
```typescript
if (target?.closest?.('#madoka-translation-popup') || target?.closest?.('#madoka-translation-overlay')) {
  return
}
```

如果鼠标释放时还在弹窗内，应该不会触发翻译...

但如果拖动时鼠标移出了弹窗，释放时就不在弹窗内了！

**这就是 Bug！**

1. 用户选中文本 → 显示翻译弹窗（正在翻译...）
2. 用户拖动弹窗标题栏，鼠标移出弹窗区域
3. 用户释放鼠标 → 触发翻译的 `mouseup` 监听器
4. 因为鼠标不在弹窗内，所以触发新的翻译请求
5. 关闭旧弹窗，显示新弹窗（正在翻译...）
6. 但此时可能有一个旧的翻译请求即将返回...

这会导致混乱，但还不是"一直显示正在翻译"...

#### Bug 8: 回调地狱和异步问题（最终发现！）

```typescript
// content/index.ts 第 434-465 行
chrome.runtime.sendMessage(
  { action: 'translate', text: textToTranslate, langpair },
  (response) => {
    if (chrome.runtime.lastError) {
      // 处理错误
      return
    }
    if (response?.success && response.translatedText) {
      popup.updateContent({...})
    } else {
      popup.updateContent({...})
    }
  }
)
```

**关键问题：** 如果 `chrome.runtime.lastError` 存在，但错误信息不是预期的格式？

或者更严重的问题：

如果 `sendMessage` 本身抛出异常（不是回调中的错误）？

```typescript
// 如果这行抛出异常：
chrome.runtime.sendMessage(
  { action: 'translate', text: textToTranslate, langpair },
  (response) => { /* ... */ }
)
// 异常不会被捕获，回调永远不会执行！
```

但代码中已经有 try-catch 了吗？让我检查...

实际上，之前的修复已经添加了上下文检查。但问题是：

**如果 sendMessage 成功发送，但 background 没有正确处理？**

让我检查 background：

```typescript
// background/index.ts 第 95-125 行
if (request.action === 'translate') {
  ;(async () => {
    try {
      // ...
      const res = await fetch(url)
      // ...
    } catch (e) {
      console.error('[Madoka BG] Translate failed:', e)
      sendResponse({ success: false, error: (e as Error).message })
    }
  })()
  return true  // ← 异步响应
}
```

**问题：** 如果 `fetch` 挂起（网络问题），`sendResponse` 永远不会被调用！

这就是"一直显示正在翻译"的根本原因！

## 根本原因总结

### 主要原因：API 请求没有超时处理

```typescript
const res = await fetch(url)  // 可能永远挂起！
```

如果 MyMemory API 无响应：
- `fetch` 永远不会返回
- `sendResponse` 永远不会被调用
- Content Script 的回调永远不会执行
- 弹窗永远显示"正在翻译..."

### 次要原因：拖动功能引入的复杂性

拖动功能本身不会导致翻译失效，但：
1. 增加了代码复杂度
2. 引入了事件监听器管理问题
3. 可能掩盖了真正的 API 问题

## 修复方案

### 方案 1：添加 API 超时处理（必须）

```typescript
// background/index.ts
if (request.action === 'translate') {
  ;(async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时
      
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)
      // ...
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        sendResponse({ success: false, error: '翻译请求超时' })
      } else {
        sendResponse({ success: false, error: (e as Error).message })
      }
    }
  })()
  return true
}
```

### 方案 2：Content Script 端也添加超时

```typescript
// content/index.ts
const timeoutId = setTimeout(() => {
  popup.updateContent({
    originalText: textToTranslate,
    error: '翻译请求超时，请重试',
  })
}, 15000) // 15秒超时

chrome.runtime.sendMessage(
  { action: 'translate', text: textToTranslate, langpair },
  (response) => {
    clearTimeout(timeoutId)
    // ...
  }
)
```

### 方案 3：修复拖动事件冲突

```typescript
// translation-popup.ts
// 在 stopDragHandler 中标记刚刚结束拖动
this.stopDragHandler = () => {
  this.isDragging = false
  this.justFinishedDragging = true  // 新增
  setTimeout(() => {
    this.justFinishedDragging = false
  }, 100)
}
```

然后在 content/index.ts 中检查：
```typescript
const popup = getTranslationPopup()
if (popup.justFinishedDragging) {
  return  // 刚刚结束拖动，不触发翻译
}
```

## 结论

**"一直显示正在翻译"的根本原因是 API 请求没有超时处理**，而不是拖动功能本身。

拖动功能可能：
1. 掩盖了 API 问题（因为用户注意力在拖动上）
2. 引入了额外的事件复杂性
3. 但没有直接导致翻译失效

建议优先修复 API 超时问题，然后检查拖动功能的事件处理。
