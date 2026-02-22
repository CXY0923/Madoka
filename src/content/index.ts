/**
 * Madoka Content Script
 * 处理页面读取、搜索结果解析和 Action Space 操作
 */

import { MadokaReader } from './reader'
import { MadokaSearchParser } from './parser'
import { MadokaActionParser } from './action-parser'
import { MadokaActionExecutor } from './action-executor'
import { getLinkSummaryPopup } from './link-summary-popup'
import { getTranslationPopup } from './translation-popup'
import { findElementBySelectors, findElementByText } from './selector-generator'
import { scrollToAndHighlight, clearAllHighlights } from './highlighter'
import type { SearchEngine } from '../shared/types'
import type { ActionParams, ActionStatus } from '../shared/action-types'

// 防止在 iframe 中运行
if (window.top !== window.self) {
  console.log('[Madoka Content] 跳过 iframe')
} else if ((window as unknown as { MadokaContentInitialized?: boolean }).MadokaContentInitialized) {
  console.log('[Madoka Content] 已初始化，跳过')
} else {
  ;(window as unknown as { MadokaContentInitialized: boolean }).MadokaContentInitialized = true

  console.log('[Madoka Content] 已加载:', location.href)

  // 等待 Reader 模块加载
  function waitForReader(): Promise<void> {
    return new Promise((resolve) => {
      const checkReader = () => {
        if ((window as unknown as { MadokaReader?: typeof MadokaReader }).MadokaReader) {
          resolve()
        } else {
          setTimeout(checkReader, 100)
        }
      }
      checkReader()

      setTimeout(() => {
        console.warn('[Madoka Content] Reader 模块加载超时')
        resolve()
      }, 5000)
    })
  }

  // 等待 ActionParser 模块加载
  function waitForActionParser(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if ((window as unknown as { MadokaActionParser?: typeof MadokaActionParser }).MadokaActionParser) {
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }
      check()

      setTimeout(() => {
        console.warn('[Madoka Content] ActionParser 模块加载超时')
        resolve()
      }, 5000)
    })
  }

  // 监听消息
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('[Madoka Content] 收到消息:', request.action)

    if (request.action === 'readPage') {
      ;(async () => {
        try {
          await waitForReader()

          if ((window as unknown as { MadokaReader?: typeof MadokaReader }).MadokaReader) {
            const result = await MadokaReader.readCurrentPage()
            sendResponse({
              title: result.meta.title,
              url: result.meta.url,
              content: result.content,
              length: result.content.length,
            })
          } else {
            sendResponse({
              title: document.title,
              url: location.href,
              content: document.body.innerText.slice(0, 10000),
              length: document.body.innerText.length,
            })
          }
        } catch (e) {
          console.error('[Madoka Content] 读取页面失败:', e)
          sendResponse({
            error: (e as Error).message,
            title: document.title,
            url: location.href,
            content: '',
            length: 0,
          })
        }
      })()

      return true
    }

    if (request.action === 'parseSearch') {
      try {
        const results = MadokaSearchParser.parseFromHTML(
          request.html as string,
          request.engine as SearchEngine
        )
        sendResponse({ success: true, results })
      } catch (e) {
        console.error('[Madoka Content] 解析搜索结果失败:', e)
        sendResponse({ success: false, error: (e as Error).message, results: [] })
      }
      return true
    }

    if (request.action === 'readHTML') {
      ;(async () => {
        try {
          await waitForReader()

          if ((window as unknown as { MadokaReader?: typeof MadokaReader }).MadokaReader) {
            const result = await MadokaReader.readFromHTML(
              request.html as string,
              request.url as string
            )
            sendResponse({
              success: true,
              title: result.meta.title,
              url: request.url,
              content: result.content,
              markdown: result.markdown,
              length: result.content.length,
            })
          } else {
            const parser = new DOMParser()
            const doc = parser.parseFromString(request.html as string, 'text/html')
            const text = doc.body?.innerText || ''
            sendResponse({
              success: true,
              title: doc.title,
              url: request.url,
              content: text.slice(0, 10000),
              markdown: text.slice(0, 10000),
              length: text.length,
            })
          }
        } catch (e) {
          console.error('[Madoka Content] 读取 HTML 失败:', e)
          sendResponse({
            success: false,
            error: (e as Error).message,
            content: '',
            markdown: '',
          })
        }
      })()

      return true
    }

    // ============ Action Space 相关消息 ============

    if (request.action === 'extractActionSpace') {
      ;(async () => {
        try {
          await waitForActionParser()

          if ((window as unknown as { MadokaActionParser?: typeof MadokaActionParser }).MadokaActionParser) {
            const actionSpace = await MadokaActionParser.extractCurrentPage()
            sendResponse({
              success: true,
              actionSpace,
            })
          } else {
            sendResponse({
              success: false,
              error: 'ActionParser 模块未加载',
            })
          }
        } catch (e) {
          console.error('[Madoka Content] 提取 Action Space 失败:', e)
          sendResponse({
            success: false,
            error: (e as Error).message,
          })
        }
      })()

      return true
    }

    if (request.action === 'executeAction') {
      ;(async () => {
        try {
          await waitForActionParser()

          const actionId = request.actionId as string
          const params = (request.params || {}) as ActionParams

          if ((window as unknown as { MadokaActionExecutor?: typeof MadokaActionExecutor }).MadokaActionExecutor) {
            const result = await MadokaActionExecutor.execute(actionId, params)
            sendResponse({
              success: true,
              result,
            })
          } else {
            sendResponse({
              success: false,
              error: 'ActionExecutor 模块未加载',
            })
          }
        } catch (e) {
          console.error('[Madoka Content] 执行 Action 失败:', e)
          sendResponse({
            success: false,
            error: (e as Error).message,
          })
        }
      })()

      return true
    }

    if (request.action === 'highlightAction') {
      try {
        const actionId = request.actionId as string
        const highlight = request.highlight as boolean
        const status = (request.status || 'pending') as ActionStatus

        if ((window as unknown as { MadokaActionExecutor?: typeof MadokaActionExecutor }).MadokaActionExecutor) {
          if (highlight) {
            MadokaActionExecutor.highlight(actionId, status)
          } else {
            MadokaActionExecutor.unhighlight(actionId)
          }
          sendResponse({ success: true })
        } else {
          sendResponse({ success: false, error: 'ActionExecutor 模块未加载' })
        }
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'clearHighlights') {
      try {
        if ((window as unknown as { MadokaActionExecutor?: typeof MadokaActionExecutor }).MadokaActionExecutor) {
          MadokaActionExecutor.clearAllHighlights()
          sendResponse({ success: true })
        } else {
          sendResponse({ success: false, error: 'ActionExecutor 模块未加载' })
        }
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'validateAction') {
      try {
        const actionId = request.actionId as string

        if ((window as unknown as { MadokaActionParser?: typeof MadokaActionParser }).MadokaActionParser) {
          const result = MadokaActionParser.validateActionId(actionId)
          sendResponse({
            success: true,
            valid: result.valid,
            reason: result.reason,
          })
        } else {
          sendResponse({ success: false, error: 'ActionParser 模块未加载' })
        }
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'clearActionIds') {
      try {
        if ((window as unknown as { MadokaActionParser?: typeof MadokaActionParser }).MadokaActionParser) {
          MadokaActionParser.clearActionIds()
          sendResponse({ success: true })
        } else {
          sendResponse({ success: false, error: 'ActionParser 模块未加载' })
        }
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    // ============ 链接总结弹窗 ============

    if (request.action === 'showLinkSummary') {
      try {
        const popup = getLinkSummaryPopup()
        popup.show({
          linkUrl: request.linkUrl as string,
          linkText: request.linkText as string,
        })
        sendResponse({ success: true })
      } catch (e) {
        console.error('[Madoka Content] 显示链接总结弹窗失败:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    // ============ Ping 响应 ============

    if (request.action === 'ping') {
      sendResponse({ success: true, initialized: true })
      return true
    }

    // ============ 高亮和跳转 ============

    if (request.action === 'highlightAndScroll') {
      try {
        const { selectors, text, contextBefore, contextAfter } = request as {
          selectors?: string[]
          text?: string
          contextBefore?: string
          contextAfter?: string
        }

        let element: Element | null = null

        // 策略 1: 使用选择器查找
        if (selectors && selectors.length > 0) {
          element = findElementBySelectors(selectors)
        }

        // 策略 2: 使用文本查找（回退）
        if (!element && text) {
          element = findElementByText(text, contextBefore, contextAfter)
        }

        if (element) {
          // 生成唯一的高亮 ID
          const highlightId = `highlight-${Date.now()}`
          
          // 滚动并高亮
          scrollToAndHighlight(element, highlightId, 'smooth')
          
          sendResponse({ success: true, highlightId })
        } else {
          sendResponse({ success: false, error: '无法找到目标元素' })
        }
      } catch (e) {
        console.error('[Madoka Content] 高亮失败:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    if (request.action === 'clearHighlights') {
      try {
        clearAllHighlights()
        sendResponse({ success: true })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
      return true
    }

    return false
  })

  // ============ 划词翻译 ============

  const MAX_TRANSLATE_LENGTH = 500
  const TRANSLATE_DEBOUNCE_MS = 150

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

  function setupSelectionTranslate(): void {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    document.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button !== 0) return
      const target = e.target as Element
      if (target?.closest?.('#madoka-translation-popup') || target?.closest?.('#madoka-translation-overlay')) {
        return
      }

      // 检查是否刚刚结束拖动，如果是则不触发翻译
      const popup = getTranslationPopup()
      if (popup.justFinishedDragging) {
        return
      }

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        const selection = window.getSelection()
        const text = selection?.toString()?.trim()
        if (!text || text.length === 0) return

        const textToTranslate = text.length > MAX_TRANSLATE_LENGTH
          ? text.substring(0, MAX_TRANSLATE_LENGTH)
          : text

        let rect: DOMRect | undefined
        if (selection?.rangeCount) {
          rect = selection.getRangeAt(0).getBoundingClientRect()
        }

        const popup = getTranslationPopup()
        popup.show({
          originalText: textToTranslate,
          isLoading: true,
          rect,
        })

        // 检查扩展上下文是否有效
        if (!isExtensionContextValid()) {
          popup.updateContent({
            originalText: textToTranslate,
            error: '扩展已更新，请刷新页面后重试',
          })
          return
        }

        const langpair = /[\u4e00-\u9fff]/.test(textToTranslate) ? 'zh|en' : 'en|zh'

        // 添加超时处理
        let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          timeoutId = null
          popup.updateContent({
            originalText: textToTranslate,
            error: '翻译请求超时，请重试',
          })
        }, 15000) // 15秒超时

        // 使用 try-catch 包装 sendMessage，捕获同步错误（如 Extension context invalidated）
        try {
          chrome.runtime.sendMessage(
            { action: 'translate', text: textToTranslate, langpair },
            (response: { success?: boolean; translatedText?: string; error?: string } | undefined) => {
              // 清除超时定时器
              if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
              }

              // 检查扩展上下文是否失效
              if (chrome.runtime.lastError) {
                const errorMsg = chrome.runtime.lastError.message || ''
                if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
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
              if (response?.success && response.translatedText) {
                popup.updateContent({
                  originalText: textToTranslate,
                  translatedText: response.translatedText,
                })
              } else {
                popup.updateContent({
                  originalText: textToTranslate,
                  error: response?.error || '翻译失败',
                })
              }
            }
          )
        } catch (e) {
          // 捕获同步错误（如 Extension context invalidated）
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }

          const errorMsg = (e as Error).message || ''
          if (errorMsg.includes('Extension context invalidated') || errorMsg.includes('context invalidated')) {
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
      }, TRANSLATE_DEBOUNCE_MS)
    })
  }

  // 初始化
  async function init() {
    await waitForReader()
    console.log('[Madoka Content] Reader 模块已就绪')

    await waitForActionParser()
    console.log('[Madoka Content] ActionParser 模块已就绪')

    setupSelectionTranslate()
    console.log('[Madoka Content] 划词翻译已启用')
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
}
