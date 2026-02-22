# 最终修复 Extension Context Invalidated 错误

## 问题确认

错误信息：
```
Uncaught Error: Extension context invalidated.
上下文: https://nova.yuque.com/lqogh0/lplocr/lg9mg0rg07tcdb36
堆叠追踪: assets/index.ts-BJjdu9Zy.js:475 (匿名函数)
```

翻译一直显示"正在翻译..."

## 根本原因

**扩展上下文失效**意味着：
1. 扩展代码已更新/重新加载
2. Background Service Worker 已重启
3. Content Script 仍然运行在页面上，但无法与新的 Background 通信
4. 所有 `chrome.runtime` 调用都会抛出错误

## 为什么之前的修复无效

之前的修复在 `sendMessage` 的回调中检查 `chrome.runtime.lastError`，但问题是：
- 当扩展上下文失效时，`chrome.runtime.sendMessage` 本身就会抛出异常
- 这个异常没有被 try-catch 捕获
- 代码执行中断，回调永远不会执行
- 弹窗永远显示"正在翻译..."

## 正确的修复方案

### 方案：包装所有 chrome.runtime 调用

需要在调用 `chrome.runtime.sendMessage` 的地方添加 try-catch：

```typescript
// content/index.ts

try {
  chrome.runtime.sendMessage(
    { action: 'translate', text: textToTranslate, langpair },
    (response) => {
      // 清除超时定时器
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // 检查扩展上下文是否失效
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
      
      // 处理响应...
    }
  )
} catch (e) {
  // 捕获同步错误（如 Extension context invalidated）
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  
  const errorMsg = (e as Error).message || ''
  if (errorMsg.includes('Extension context invalidated') || 
      errorMsg.includes('context invalidated')) {
    popup.updateContent({
      originalText: textToTranslate,
      error: '扩展已更新，请刷新页面后重试',
    })
  } else {
    popup.updateContent({
      originalText: textToTranslate,
      error: '翻译请求失败: ' + errorMsg,
    })
  }
}
```

## 实施步骤

### 步骤 1：修改 content/index.ts

找到 `chrome.runtime.sendMessage` 调用（约第 450 行），添加 try-catch 包装。

### 步骤 2：检查其他 chrome.runtime 调用

检查 content/index.ts 中所有其他 `chrome.runtime` 调用，添加相同的错误处理。

### 步骤 3：构建和测试

```bash
npm run build
```

然后在浏览器中测试：
1. 加载扩展
2. 在页面选中文本触发翻译
3. 刷新扩展（模拟更新）
4. 再次选中文本，应该显示"扩展已更新，请刷新页面后重试"

## 关键修改点

**文件**: `src/content/index.ts`
**位置**: 约第 450 行的 `chrome.runtime.sendMessage` 调用
**修改**: 添加 try-catch 包装

## 预期结果

- 正常使用时翻译功能正常工作
- 扩展更新后，用户会看到"扩展已更新，请刷新页面后重试"提示
- 不会再出现未捕获的 "Extension context invalidated" 错误
- 不会一直显示"正在翻译..."
