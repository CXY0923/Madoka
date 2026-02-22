/**
 * Madoka Background Service Worker
 * Handles search, content reading, API calls, and Action Space operations
 */

import type { SearchEngine, SearchContext } from '../shared/types'
import type { ActionParams, ActionSpace, ActionResult } from '../shared/action-types'
import type { AnyContextRef } from '../shared/context-types'
import { getConfig, saveConfig } from './config'
import { searchAndRead, searchAndReadMultiRound } from './search'
import {
  handleChat,
  callTongyiAPI,
  analyzeSearchNeed,
  extractSearchKeywords,
  condenseQuestion,
  callTongyiAPIForOptimize,
} from './api'
import {
  getAllTabs,
  searchTabs,
  searchBookmarks,
  getHistory,
  getCurrentPage,
  resolveContextContent,
  searchAllContexts,
} from './context'

/**
 * Get the current active tab
 */
async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab || null
}

/**
 * Send message to Content Script
 */
async function sendToContentScript<T>(
  tabId: number,
  message: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response as T)
      }
    })
  })
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Madoka BG] Received message:', request.action)

  if (request.action === 'chat') {
    handleChatRequest(request, sender)
    return true
  }

  if (request.action === 'smartChat') {
    handleSmartChatRequest(request, sender)
    return true
  }

  if (request.action === 'search') {
    searchAndRead(request.query, request.options)
      .then((results) => sendResponse({ success: true, data: results }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'getConfig') {
    getConfig().then((config) => sendResponse(config))
    return true
  }

  if (request.action === 'saveConfig') {
    saveConfig(request.config).then((success) => sendResponse({ success }))
    return true
  }

  if (request.action === 'readPage') {
    handleReadPageRequest(request, sendResponse)
    return true
  }

  // ============ 划词翻译 ============

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
          console.error('[Madoka BG] Translate timeout')
          sendResponse({ success: false, error: '翻译请求超时，请检查网络连接' })
        } else {
          console.error('[Madoka BG] Translate failed:', e)
          sendResponse({ success: false, error: (e as Error).message })
        }
      }
    })()
    return true
  }

  // ============ Ask AI - 发送原文到侧边栏 ============

  if (request.action === 'askAI') {
    // 从 sender 对象同步获取 tabId（保持在用户手势上下文中）
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

    // 异步处理：存储原文并打开侧边栏
    ;(async () => {
      try {
        // 存储原文到 session storage（sidepanel 打开后会读取）
        await chrome.storage.session.set({ pendingQuestion: text })

        // 打开侧边栏
        await chrome.sidePanel.open({ tabId })

        sendResponse({ success: true })
      } catch (e) {
        console.error('[Madoka BG] Ask AI failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // ============ Action Space Messages ============

  if (request.action === 'extractActionSpace') {
    ;(async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab found' })
          return
        }

        const response = await sendToContentScript<{
          success: boolean
          actionSpace?: ActionSpace
          error?: string
        }>(tabId, { action: 'extractActionSpace' })

        sendResponse(response)
      } catch (e) {
        console.error('[Madoka BG] Failed to extract Action Space:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'executeAction') {
    ;(async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab found' })
          return
        }

        const response = await sendToContentScript<{
          success: boolean
          result?: ActionResult
          error?: string
        }>(tabId, {
          action: 'executeAction',
          actionId: request.actionId,
          params: request.params as ActionParams,
        })

        sendResponse(response)
      } catch (e) {
        console.error('[Madoka BG] Failed to execute Action:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'highlightAction') {
    ;(async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab found' })
          return
        }

        const response = await sendToContentScript<{ success: boolean; error?: string }>(tabId, {
          action: 'highlightAction',
          actionId: request.actionId,
          highlight: request.highlight,
          status: request.status,
        })

        sendResponse(response)
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'clearHighlights') {
    ;(async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab found' })
          return
        }

        const response = await sendToContentScript<{ success: boolean; error?: string }>(tabId, {
          action: 'clearHighlights',
        })

        sendResponse(response)
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'validateAction') {
    ;(async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab found' })
          return
        }

        const response = await sendToContentScript<{
          success: boolean
          valid?: boolean
          reason?: string
          error?: string
        }>(tabId, {
          action: 'validateAction',
          actionId: request.actionId,
        })

        sendResponse(response)
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'clearActionIds') {
    ;(async () => {
      try {
        const tabId = request.tabId || (await getActiveTab())?.id
        if (!tabId) {
          sendResponse({ success: false, error: 'No active tab found' })
          return
        }

        const response = await sendToContentScript<{ success: boolean; error?: string }>(tabId, {
          action: 'clearActionIds',
        })

        sendResponse(response)
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // ============ Context Reference Messages ============

  if (request.action === 'getTabs') {
    ;(async () => {
      try {
        const query = request.query || ''
        const tabs = query ? await searchTabs(query) : await getAllTabs()
        sendResponse({ success: true, data: tabs })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'getBookmarks') {
    ;(async () => {
      try {
        const bookmarks = await searchBookmarks(request.query || '')
        sendResponse({ success: true, data: bookmarks })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'getHistory') {
    ;(async () => {
      try {
        const history = await getHistory(request.query || '', request.maxResults || 20)
        sendResponse({ success: true, data: history })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'getCurrentPage') {
    ;(async () => {
      try {
        const page = await getCurrentPage()
        sendResponse({ success: true, data: page })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'searchAllContexts') {
    ;(async () => {
      try {
        const results = await searchAllContexts(request.query || '')
        sendResponse({ success: true, data: results })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'resolveContext') {
    ;(async () => {
      try {
        const ref = request.ref as AnyContextRef
        const content = await resolveContextContent(ref)
        sendResponse({ success: true, data: content })
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // ============ Prompt Optimization ============

  if (request.action === 'optimizePrompt') {
    ;(async () => {
      try {
        const userInput = request.input as string
        const systemPrompt = request.systemPrompt as string | undefined
        
        if (!userInput || !userInput.trim()) {
          sendResponse({ success: false, error: 'Input is empty' })
          return
        }

        const optimizedPrompt = await callTongyiAPIForOptimize(userInput, systemPrompt)
        sendResponse({ success: true, data: optimizedPrompt })
      } catch (e) {
        console.error('[Madoka BG] Failed to optimize prompt:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  return false
})

/**
 * Handle read page request
 */
async function handleReadPageRequest(
  request: { tabId?: number },
  sendResponse: (response: unknown) => void
) {
  try {
    const tabId = request.tabId || (await getActiveTab())?.id
    if (!tabId) {
      sendResponse({ success: false, error: 'No active tab found' })
      return
    }

    const response = await sendToContentScript<{
      success: boolean
      content?: string
      title?: string
      url?: string
      length?: number
      error?: string
    }>(tabId, { action: 'readPage' })

    sendResponse(response)
  } catch (e) {
    sendResponse({ success: false, error: (e as Error).message })
  }
}

/**
 * Handle smart chat request with AI-based search decision
 */
async function handleSmartChatRequest(
  request: {
    message: string
    history?: { role: string; content: string }[]
    engine?: SearchEngine
    pageContent?: string
    tabId?: number
    autoReadPage?: boolean
  },
  sender: chrome.runtime.MessageSender
) {
  const tabId = sender.tab?.id || request.tabId
  const isFromSidePanel = !sender.tab

  const sendToUI = (message: Record<string, unknown>) => {
    if (isFromSidePanel) {
      chrome.runtime.sendMessage(message).catch(() => {})
    } else if (tabId) {
      chrome.tabs.sendMessage(tabId, message).catch(() => {})
    }
  }

  try {
    let pageContent = request.pageContent || null
    let searchContext: SearchContext | null = null

    console.log('[Madoka BG] Smart chat request:', {
      message: request.message,
      hasPageContent: !!pageContent,
      autoReadPage: request.autoReadPage,
    })

    // Auto-read page if requested and no content provided
    if (request.autoReadPage && !pageContent && tabId) {
      sendToUI({ action: 'status', message: '📖 Reading page context...' })
      
      try {
        const readResult = await sendToContentScript<{
          success: boolean
          content?: string
          title?: string
          url?: string
          length?: number
        }>(tabId, { action: 'readPage' })

        if (readResult.success && readResult.content) {
          pageContent = readResult.content
          console.log('[Madoka BG] Page read successfully:', readResult.length, 'chars')
        }
      } catch (e) {
        console.warn('[Madoka BG] Failed to read page:', e)
      }
    }

    // Use AI to analyze if search is needed
    sendToUI({ action: 'status', message: '🤔 Analyzing query...' })
    
    const searchAnalysis = await analyzeSearchNeed(request.message)
    console.log('[Madoka BG] Search analysis:', searchAnalysis)

    if (searchAnalysis.needsSearch) {
      sendToUI({ action: 'status', message: '🔍 Searching the web...' })

      // Extract optimized search query
      let searchQuery = searchAnalysis.searchQuery || request.message
      if (!searchAnalysis.searchQuery && searchAnalysis.confidence < 0.8) {
        // Use AI to extract better keywords
        searchQuery = await extractSearchKeywords(request.message)
      }
      // 追问转独立问题（Condense Question）
      searchQuery = await condenseQuestion(searchQuery, request.history || [])

      console.log('[Madoka BG] Search query:', searchQuery)

      try {
        searchContext = await searchAndReadMultiRound(searchQuery, {
          engine: request.engine,
          tabId,
        })

        if (searchContext.results && searchContext.results.length > 0) {
          sendToUI({
            action: 'searchResults',
            results: searchContext.results.map((r) => ({
              title: r.title,
              link: r.link,
              snippet: r.snippet,
            })),
          })
          sendToUI({ action: 'status', message: `📚 Found ${searchContext.results.length} results` })
        } else {
          sendToUI({ action: 'status', message: '⚠️ No search results found' })
        }
      } catch (e) {
        console.error('[Madoka BG] Search failed:', e)
        sendToUI({ action: 'status', message: '⚠️ Search failed, answering directly...' })
      }
    }

    // Build messages with context
    const messages = await handleChat(request.message, request.history || [], {
      pageContent: pageContent || undefined,
      searchContext: searchContext || undefined,
    })

    // Call API with streaming
    sendToUI({ action: 'status', message: null }) // Clear status
    
    let fullResponse = ''
    await callTongyiAPI(messages, (chunk, content) => {
      fullResponse = content
      sendToUI({
        action: 'streamChunk',
        chunk,
        content,
      })
    })

    // Send completion message
    sendToUI({
      action: 'streamEnd',
      content: fullResponse,
      searchContext: searchContext
        ? {
            query: searchContext.query,
            engine: searchContext.engine,
            count: searchContext.results.length,
          }
        : null,
    })
  } catch (e) {
    console.error('[Madoka BG] Smart chat failed:', e)
    sendToUI({
      action: 'error',
      message: (e as Error).message,
    })
  }
}

/**
 * Handle legacy chat request (backward compatibility)
 */
async function handleChatRequest(
  request: {
    message: string
    history?: { role: string; content: string }[]
    forceSearch?: boolean
    engine?: SearchEngine
    pageContent?: string
    tabId?: number
  },
  sender: chrome.runtime.MessageSender
) {
  // Use smart chat for all requests now
  await handleSmartChatRequest(
    {
      ...request,
      autoReadPage: false, // Preserve original behavior for legacy calls
    },
    sender
  )
}

// Initialize on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Madoka] Extension installed/updated')

  const config = await getConfig()
  await saveConfig(config)

  // Create context menu for link summarization
  chrome.contextMenus.create({
    id: 'madoka-summarize-link',
    title: '📝 Madoka: 总结此链接',
    contexts: ['link'],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'madoka-summarize-link' && info.linkUrl && tab?.id) {
    console.log('[Madoka] Summarizing link:', info.linkUrl)

    try {
      // Open side panel
      await chrome.sidePanel.open({ windowId: tab.windowId })

      // Wait for side panel to open
      await delay(500)

      // Send message to side panel to show link summary
      await chrome.runtime.sendMessage({
        action: 'showLinkSummaryInSidepanel',
        linkUrl: info.linkUrl,
        linkText: (info as { linkText?: string }).linkText || info.linkUrl,
      })
    } catch (e) {
      console.error('[Madoka] Failed to show link summary in sidepanel:', e)
      // Show error notification to user
      await showErrorNotification('无法显示链接总结', '请刷新页面后重试，或检查扩展权限设置')
    }
  }
})

/**
 * Send message to content script with retry
 */
async function sendToContentScriptWithRetry(
  tabId: number,
  message: Record<string, unknown>,
  maxRetries = 3
): Promise<void> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      await sendToContentScript(tabId, message)
      console.log(`[Madoka] Message sent successfully on attempt ${i + 1}`)
      return
    } catch (e) {
      lastError = e as Error
      console.warn(`[Madoka] Attempt ${i + 1} failed:`, (e as Error).message)

      if (i < maxRetries - 1) {
        // Wait before retry (exponential backoff)
        await delay(200 * Math.pow(2, i))
      }
    }
  }

  throw lastError || new Error('Failed to send message after retries')
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Show error notification to user
 */
async function showErrorNotification(title: string, message: string): Promise<void> {
  try {
    // Use chrome.notifications if available
    if (chrome.notifications) {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'public/icons/icon128.png',
        title,
        message,
      })
    }
  } catch (e) {
    console.error('[Madoka] Failed to show notification:', e)
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Fetch link content
  if (request.action === 'fetchLinkContent') {
    ;(async () => {
      try {
        const url = request.url as string
        const content = await fetchLinkContent(url)
        sendResponse({ success: true, data: content })
      } catch (e) {
        console.error('[Madoka] Failed to fetch link content:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // Summarize content
  if (request.action === 'summarizeContent') {
    ;(async () => {
      try {
        const { title, url, content } = request
        const summary = await summarizeContent(title, url, content)
        sendResponse({ success: true, summary })
      } catch (e) {
        console.error('[Madoka] Failed to summarize content:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // Summarize content with points (for jump functionality)
  if (request.action === 'summarizeContentWithPoints') {
    ;(async () => {
      try {
        const { title, url, content } = request as { title: string; url: string; content: string }
        const result = await summarizeContentWithPoints(title, url, content)
        sendResponse({ success: true, result })
      } catch (e) {
        console.error('[Madoka] Failed to summarize content with points:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // Jump to quote in target page
  if (request.action === 'jumpToQuote') {
    ;(async () => {
      try {
        const { url, selectors, text, contextBefore, contextAfter } = request as {
          url: string
          selectors: string[]
          text: string
          contextBefore: string
          contextAfter: string
        }
        await jumpToQuote(url, selectors, text, contextBefore, contextAfter)
        sendResponse({ success: true })
      } catch (e) {
        console.error('[Madoka] Failed to jump to quote:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // View source - 按照 sidepaneltest 的方式
  if (request.action === 'viewSource') {
    ;(async () => {
      try {
        const { url, point } = request as {
          url: string
          point: {
            summary: string
            verbatimQuote: string
            selectors?: string[]
            contextBefore?: string
            contextAfter?: string
          }
        }
        await viewSource(url, point)
        sendResponse({ success: true })
      } catch (e) {
        console.error('[Madoka] Failed to view source:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }
})

/**
 * Fetch content from a URL using Jina Reader
 */
async function fetchLinkContent(url: string): Promise<{
  title: string
  url: string
  content: string
  length: number
}> {
  // Use Jina Reader to fetch content
  const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
  
  const response = await fetch(jinaUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/plain',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch content: ${response.status}`)
  }

  const text = await response.text()
  
  // Parse the response (Jina Reader returns markdown format)
  const lines = text.split('\n')
  const title = lines[0]?.replace(/^#\s*/, '') || 'Untitled'
  const content = text.slice(title.length + 1).trim()

  return {
    title,
    url,
    content: content.slice(0, 15000), // Limit content length
    length: content.length,
  }
}

/**
 * Summarize content using LLM
 */
async function summarizeContent(
  title: string,
  url: string,
  content: string
): Promise<string> {
  const { getConfig } = await import('./config')
  const config = await getConfig()

  const summaryPrompt = `请对以下网页内容进行总结，要求：
1. 提取核心观点和关键信息
2. 总结内容简洁明了，不超过300字
3. 使用中文回答
4. 如果内容包含技术信息，请保留关键的技术细节

网页标题：${title}
网页URL：${url}

网页内容：
${content.slice(0, 8000)}

请提供总结：`

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: '你是一个专业的内容总结助手，擅长提取网页的核心内容。' },
        { role: 'user', content: summaryPrompt },
      ],
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} - ${errorText}`)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content || '无法生成总结'
}

/**
 * Summarize content with key points for jump functionality
 */
async function summarizeContentWithPoints(
  title: string,
  url: string,
  content: string
): Promise<{ summary: string; points: Array<{ summary: string; verbatimQuote: string; selectors: string[]; contextBefore: string; contextAfter: string }> }> {
  const { getConfig } = await import('./config')
  const config = await getConfig()

  const summaryPrompt = `你是一位专业的内容分析助手。请对以下网页内容进行深度分析，提取核心要点。

【任务要求】
1. 总体总结：用简洁的语言概括页面核心内容（100-200字）
2. 关键要点：提取3-5个最具代表性的要点，每个要点必须包含：
   - summary: 一句话概括该要点
   - verbatimQuote: 从原文完整摘录的关键段落（至少包含完整的一句话，不要截断）
   - contextBefore: quote前30-50个字符的上下文
   - contextAfter: quote后30-50个字符的上下文

【重要规则】
- verbatimQuote必须是原文的完整摘录，不能修改、省略或概括
- 选择最具信息量的段落，避免选择标题、导航等无关内容
- 确保contextBefore和contextAfter能帮助唯一定位原文位置

【输出格式】
必须只返回纯JSON，不要包含markdown代码块、解释文字或任何其他内容。

JSON格式：
{
  "summary": "总体总结",
  "points": [
    {
      "summary": "要点概括",
      "verbatimQuote": "原文完整摘录",
      "contextBefore": "前文上下文",
      "contextAfter": "后文上下文"
    }
  ]
}

【页面信息】
标题：${title}
URL：${url}

【页面内容】
${content.slice(0, 8000)}

请返回JSON格式的分析结果：`

  const response = await fetch(config.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: '你是一个专业的内容总结助手，擅长提取网页的核心内容并以JSON格式返回。' },
        { role: 'user', content: summaryPrompt },
      ],
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API request failed: ${response.status} - ${errorText}`)
  }

  const json = await response.json()
  let content_text = json.choices?.[0]?.message?.content || ''
  
  console.log('[Madoka] Raw LLM response:', content_text.substring(0, 500))
  
  // Parse JSON response with multiple fallback strategies
  let result: { summary: string; points: any[] } | null = null
  
  // Strategy 1: Try to extract JSON from markdown code block
  const codeBlockMatch = content_text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    try {
      result = JSON.parse(codeBlockMatch[1])
      console.log('[Madoka] Parsed JSON from code block')
    } catch (e) {
      console.log('[Madoka] Failed to parse code block as JSON')
    }
  }
  
  // Strategy 2: Try to find JSON object directly
  if (!result) {
    const jsonObjectMatch = content_text.match(/\{[\s\S]*"summary"[\s\S]*"points"[\s\S]*\}/)
    if (jsonObjectMatch) {
      try {
        result = JSON.parse(jsonObjectMatch[0])
        console.log('[Madoka] Parsed JSON object directly')
      } catch (e) {
        console.log('[Madoka] Failed to parse JSON object directly')
      }
    }
  }
  
  // Strategy 3: Try entire content
  if (!result) {
    try {
      result = JSON.parse(content_text)
      console.log('[Madoka] Parsed entire content as JSON')
    } catch (e) {
      console.log('[Madoka] Failed to parse entire content as JSON')
    }
  }
  
  // Strategy 4: Try to clean and parse
  if (!result) {
    try {
      // Remove common prefixes/suffixes that might break JSON
      const cleaned = content_text
        .replace(/^[^{]*/, '') // Remove everything before first {
        .replace(/[^}]*$/, '') // Remove everything after last }
      result = JSON.parse(cleaned)
      console.log('[Madoka] Parsed cleaned content as JSON')
    } catch (e) {
      console.log('[Madoka] Failed to parse cleaned content')
    }
  }
  
  if (result) {
    // Ensure points have correct format
    if (result.points && Array.isArray(result.points)) {
      result.points = result.points.map((point: { summary?: string; verbatimQuote?: string; text?: string; contextBefore?: string; contextAfter?: string }) => ({
        summary: point.summary || point.text || '',
        verbatimQuote: point.verbatimQuote || point.text || '',
        selectors: [], // Will be generated on the target page
        contextBefore: point.contextBefore || '',
        contextAfter: point.contextAfter || '',
      }))
    }
    
    console.log('[Madoka] Successfully parsed result:', { summary: result.summary?.substring(0, 50), pointsCount: result.points?.length })
    return result
  }
  
  // Fallback: return plain summary without points
  console.warn('[Madoka] All JSON parsing strategies failed, using plain text')
  console.warn('[Madoka] Raw content:', content_text.substring(0, 200))
  return {
    summary: content_text.substring(0, 500) || '无法生成总结',
    points: [],
  }
}

/**
 * Jump to quote in target page
 */
async function jumpToQuote(
  url: string,
  selectors: string[],
  text: string,
  contextBefore: string,
  contextAfter: string
): Promise<void> {
  // Open or focus the target tab
  const tabs = await chrome.tabs.query({ url: url + '*' })
  let targetTab: chrome.tabs.Tab
  
  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab
    targetTab = tabs[0]
    await chrome.tabs.update(targetTab.id!, { active: true })
    await chrome.windows.update(targetTab.windowId, { focused: true })
  } else {
    // Create new tab
    targetTab = await chrome.tabs.create({ url, active: true })
  }
  
  if (!targetTab.id) {
    throw new Error('无法创建或定位标签页')
  }
  
  // Wait for tab to load
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // Send message to content script to highlight and scroll
  try {
    await sendToContentScriptWithRetry(targetTab.id, {
      action: 'highlightAndScroll',
      selectors,
      text,
      contextBefore,
      contextAfter,
    }, 3)
  } catch (e) {
    console.error('[Madoka] Failed to highlight in target page:', e)
    throw new Error('无法在目标页面中高亮文本，请确保页面已完全加载')
  }
}

/**
 * View source - 按照 sidepaneltest 的方式使用 executeScript 注入高亮
 */
async function viewSource(
  url: string,
  point: {
    summary: string
    verbatimQuote: string
    selectors?: string[]
    contextBefore?: string
    contextAfter?: string
  }
): Promise<void> {
  console.log('[Madoka] ========== View Source Start ==========')
  console.log('[Madoka] URL:', url)
  console.log('[Madoka] Point:', {
    summary: point.summary,
    verbatimQuote: point.verbatimQuote,
    selectors: point.selectors,
    contextBefore: point.contextBefore,
    contextAfter: point.contextAfter,
  })

  // Open or focus the target tab
  const tabs = await chrome.tabs.query({ url: url + '*' })
  console.log('[Madoka] Found tabs:', tabs.length, tabs.map(t => ({ id: t.id, url: t.url })))
  
  let targetTab: chrome.tabs.Tab

  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab
    targetTab = tabs[0]
    console.log('[Madoka] Focusing existing tab:', targetTab.id)
    await chrome.tabs.update(targetTab.id!, { active: true })
    await chrome.windows.update(targetTab.windowId, { focused: true })
  } else {
    // Create new tab
    console.log('[Madoka] Creating new tab for URL:', url)
    targetTab = await chrome.tabs.create({ url, active: true })
  }

  if (!targetTab.id) {
    throw new Error('无法创建或定位标签页')
  }

  console.log('[Madoka] Target tab ID:', targetTab.id)

  // Wait for tab to load
  console.log('[Madoka] Waiting for tab to load...')
  await new Promise(resolve => setTimeout(resolve, 1500))
  console.log('[Madoka] Wait complete, injecting script...')

  // Use executeScript to inject highlight code directly - 按照 sidepaneltest 的方式
  try {
    const injectionResult = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: (quote: string, selectors: string[], contextBefore: string, contextAfter: string) => {
        console.log('[Content] ========== Injected Script Start ==========')
        console.log('[Content] Quote:', quote)
        console.log('[Content] Selectors:', selectors)
        console.log('[Content] ContextBefore:', contextBefore)
        console.log('[Content] ContextAfter:', contextAfter)
        
        // 查找元素的函数
        function findElementBySelectors(selectors: string[]): Element | null {
          console.log('[Content] Trying selectors:', selectors)
          for (let i = 0; i < selectors.length; i++) {
            const selector = selectors[i]
            try {
              console.log(`[Content] Trying selector ${i + 1}/${selectors.length}: "${selector}"`)
              const element = document.querySelector(selector)
              if (element) {
                console.log(`[Content] ✓ Found element with selector "${selector}":`, element)
                return element
              } else {
                console.log(`[Content] ✗ Selector "${selector}" returned null`)
              }
            } catch (e) {
              console.error(`[Content] ✗ Invalid selector "${selector}":`, e)
              continue
            }
          }
          console.log('[Content] All selectors failed')
          return null
        }

        // 基于文本查找元素 - 放宽匹配条件
        function findElementByText(
          text: string,
          contextBefore?: string,
          contextAfter?: string
        ): Element | null {
          console.log('[Content] Searching by text:', text)
          console.log('[Content] ContextBefore:', contextBefore)
          console.log('[Content] ContextAfter:', contextAfter)
          
          if (!text || text.trim().length === 0) {
            console.log('[Content] ✗ Empty text provided')
            return null
          }
          
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
          let node: Text | null
          let matchCount = 0
          const candidates: Array<{ element: Element; score: number; text: string }> = []

          while ((node = walker.nextNode() as Text)) {
            if (node.textContent) {
              const nodeText = node.textContent.trim()
              // 使用模糊匹配：文本包含关系或相似度
              if (nodeText.includes(text) || text.includes(nodeText)) {
                matchCount++
                const parent = node.parentElement
                if (parent) {
                  const parentText = parent.textContent || ''
                  console.log(`[Content] Found text match #${matchCount}, parent text:`, parentText.substring(0, 100))
                  
                  // 计算匹配分数
                  let score = 0
                  
                  // 文本完全匹配得高分
                  if (nodeText === text) score += 100
                  else if (nodeText.includes(text)) score += 80
                  else if (text.includes(nodeText)) score += 60
                  
                  // 上下文匹配（放宽条件：如果上下文为空，不扣分）
                  if (contextBefore && parentText.includes(contextBefore)) {
                    score += 10
                    console.log(`[Content] ✓ ContextBefore matched (+10)`)
                  } else if (contextBefore) {
                    score -= 5
                    console.log(`[Content] ~ ContextBefore not matched (-5)`)
                  }
                  
                  if (contextAfter && parentText.includes(contextAfter)) {
                    score += 10
                    console.log(`[Content] ✓ ContextAfter matched (+10)`)
                  } else if (contextAfter) {
                    score -= 5
                    console.log(`[Content] ~ ContextAfter not matched (-5)`)
                  }
                  
                  // 优先选择文本长度接近的元素（更精确）
                  const lengthDiff = Math.abs(parentText.length - text.length)
                  score -= lengthDiff * 0.1
                  
                  candidates.push({ element: parent, score, text: parentText })
                  console.log(`[Content] Candidate score: ${score.toFixed(1)}`)
                }
              }
            }
          }
          
          if (candidates.length === 0) {
            console.log(`[Content] Text search complete. No matches found for: "${text}"`)
            return null
          }
          
          // 按分数排序，返回最高分的元素
          candidates.sort((a, b) => b.score - a.score)
          console.log(`[Content] Total candidates: ${candidates.length}`)
          console.log(`[Content] Best match (score: ${candidates[0].score.toFixed(1)}):`, candidates[0].text.substring(0, 100))
          
          return candidates[0].element
        }

        // 创建高亮覆盖层 - 使用绝对定位跟随滚动
        function createHighlightOverlay(element: Element): void {
          console.log('[Content] Creating highlight overlay for element:', element)
          
          // 移除已有的高亮
          const existing = document.getElementById('summary-highlight-container')
          if (existing) {
            console.log('[Content] Removing existing highlight')
            existing.remove()
          }

          // 创建容器 - 使用绝对定位覆盖整个文档
          const container = document.createElement('div')
          container.id = 'summary-highlight-container'
          Object.assign(container.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: `${document.documentElement.scrollWidth}px`,
            height: `${document.documentElement.scrollHeight}px`,
            pointerEvents: 'none',
            zIndex: '2147483647',
            overflow: 'hidden',
          })

          // 创建覆盖层
          const overlay = document.createElement('div')
          overlay.className = 'summary-highlight-overlay'

          // 计算元素相对于文档的位置（考虑滚动）
          const rect = element.getBoundingClientRect()
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
          const absoluteTop = rect.top + scrollTop
          const absoluteLeft = rect.left + scrollLeft
          const padding = 12

          console.log('[Content] Element position:', {
            rectTop: rect.top,
            rectLeft: rect.left,
            scrollTop: scrollTop,
            scrollLeft: scrollLeft,
            absoluteTop: absoluteTop,
            absoluteLeft: absoluteLeft,
            width: rect.width,
            height: rect.height,
          })

          Object.assign(overlay.style, {
            position: 'absolute',
            top: `${absoluteTop - padding}px`,
            left: `${absoluteLeft - padding}px`,
            width: `${rect.width + padding * 2}px`,
            height: `${rect.height + padding * 2}px`,
            borderRadius: '8px',
            background: 'rgba(255, 235, 59, 0.25)',
            border: '3px solid rgba(255, 193, 7, 0.9)',
            boxShadow: '0 0 15px rgba(255, 193, 7, 0.6), 0 0 30px rgba(255, 193, 7, 0.3)',
            animation: 'summary-highlight-breathe 2s ease-in-out infinite',
            pointerEvents: 'none',
            transition: 'top 0.1s ease-out, left 0.1s ease-out',
          })

          // 添加呼吸灯动画样式
          const style = document.createElement('style')
          style.textContent = `
            @keyframes summary-highlight-breathe {
              0%, 100% { 
                box-shadow: 0 0 15px rgba(255, 193, 7, 0.6), 0 0 30px rgba(255, 193, 7, 0.3);
                border-color: rgba(255, 193, 7, 0.9);
                background: rgba(255, 235, 59, 0.25);
              }
              50% { 
                box-shadow: 0 0 25px rgba(255, 193, 7, 0.9), 0 0 50px rgba(255, 193, 7, 0.5), 0 0 75px rgba(255, 193, 7, 0.3);
                border-color: rgba(255, 215, 0, 1);
                background: rgba(255, 235, 59, 0.4);
              }
            }
          `
          container.appendChild(style)
          container.appendChild(overlay)
          document.body.appendChild(container)
          console.log('[Content] Highlight overlay created and appended to body')

          // 滚动到元素
          console.log('[Content] Scrolling to element...')
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })

          // 添加滚动和resize监听，更新高亮位置
          let scrollTimeout: number | null = null
          const updateHighlightPosition = () => {
            if (scrollTimeout) {
              clearTimeout(scrollTimeout)
            }
            scrollTimeout = window.setTimeout(() => {
              const newRect = element.getBoundingClientRect()
              const newScrollTop = window.pageYOffset || document.documentElement.scrollTop
              const newScrollLeft = window.pageXOffset || document.documentElement.scrollLeft
              const newAbsoluteTop = newRect.top + newScrollTop
              const newAbsoluteLeft = newRect.left + newScrollLeft
              
              overlay.style.top = `${newAbsoluteTop - padding}px`
              overlay.style.left = `${newAbsoluteLeft - padding}px`
              
              console.log('[Content] Updated highlight position:', {
                top: newAbsoluteTop - padding,
                left: newAbsoluteLeft - padding,
              })
            }, 10)
          }

          window.addEventListener('scroll', updateHighlightPosition, { passive: true })
          window.addEventListener('resize', updateHighlightPosition, { passive: true })

          // 3秒后移除高亮和监听器
          setTimeout(() => {
            console.log('[Content] Removing highlight after 3 seconds')
            window.removeEventListener('scroll', updateHighlightPosition)
            window.removeEventListener('resize', updateHighlightPosition)
            container.remove()
          }, 3000)
        }

        // 主逻辑
        console.log('[Content] ========== Starting Search ==========')

        // 策略 1: 使用选择器查找
        let element: Element | null = null
        if (selectors && selectors.length > 0) {
          console.log('[Content] Strategy 1: Using CSS selectors')
          element = findElementBySelectors(selectors)
        } else {
          console.log('[Content] Strategy 1: Skipped (no selectors provided)')
        }

        // 策略 2: 使用文本查找
        if (!element && quote) {
          console.log('[Content] Strategy 2: Using text search')
          element = findElementByText(quote, contextBefore, contextAfter)
        } else if (!element) {
          console.log('[Content] Strategy 2: Skipped (no quote provided)')
        }

        if (element) {
          console.log('[Content] ✓✓✓ SUCCESS: Found element, creating highlight')
          
          // 生成选择器
          const generatedSelectors = generateSelectorsForElement(element)
          console.log('[Content] Generated selectors:', generatedSelectors)
          
          createHighlightOverlay(element)
          console.log('[Content] ========== Complete ==========')
        } else {
          console.error('[Content] ✗✗✗ FAILED: Could not find element for quote:', quote)
          console.error('[Content] Selectors tried:', selectors)
          console.error('[Content] Quote:', quote)
          console.error('[Content] ContextBefore:', contextBefore)
          console.error('[Content] ContextAfter:', contextAfter)
          alert('无法在页面中找到对应的文本位置\n\nQuote: ' + quote.substring(0, 50) + '...')
        }
        
        // 生成选择器的函数
        function generateSelectorsForElement(element: Element): string[] {
          const selectors: string[] = []
          
          // 1. ID 选择器
          if (element.id) {
            selectors.push(`#${element.id}`)
          }
          
          // 2. Class 选择器
          if (element.classList.length > 0) {
            const classSelector = '.' + Array.from(element.classList).join('.')
            selectors.push(classSelector)
          }
          
          // 3. 属性选择器
          const attrNames = ['data-article-id', 'data-post-id', 'data-content-id', 'data-block-id', 'data-section-id']
          for (const attr of attrNames) {
            const value = element.getAttribute(attr)
            if (value) {
              selectors.push(`[${attr}="${value}"]`)
            }
          }
          
          // 4. 完整路径选择器
          const path: string[] = []
          let current: Element | null = element
          while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase()
            if (current.id) {
              selector = `#${current.id}`
              path.unshift(selector)
              break
            }
            if (current.classList.length > 0) {
              selector += '.' + Array.from(current.classList).slice(0, 2).join('.')
            }
            // 添加 nth-child
            const parent = current.parentElement
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                child => child.tagName === current!.tagName
              )
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1
                selector += `:nth-of-type(${index})`
              }
            }
            path.unshift(selector)
            current = current.parentElement
          }
          selectors.push(path.join(' > '))
          
          return [...new Set(selectors)]
        }
      },
      args: [
        point.verbatimQuote,
        point.selectors || [],
        point.contextBefore || '',
        point.contextAfter || '',
      ],
    })

    console.log('[Madoka] Script injection result:', injectionResult)
    console.log('[Madoka] ✓ Highlight injected successfully')
    console.log('[Madoka] ========== View Source End ==========')
  } catch (e) {
    console.error('[Madoka] ✗ Failed to inject highlight:', e)
    console.error('[Madoka] ========== View Source Failed ==========')
    throw new Error('无法在目标页面中注入高亮代码: ' + (e as Error).message)
  }
}

// Open Side Panel on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

// Set Side Panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Madoka] Failed to set Side Panel behavior:', error))

console.log('[Madoka] Background Service Worker started')
