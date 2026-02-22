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
import { handleGitHubSearch } from './githubSearch'
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

  if (request.action === 'githubSearch') {
    const userQuery = (request.userQuery as string) || ''
    handleGitHubSearch(userQuery)
      .then((result) => sendResponse(result))
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

        const result = await sendToContentScript<ActionSpace>(tabId, {
          action: 'extractActionSpace',
        })
        sendResponse({ success: true, data: result })
      } catch (e) {
        console.error('[Madoka BG] Extract ActionSpace failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'executeAction') {
    ;(async () => {
      try {
        const { tabId, actionId, params } = request as {
          tabId?: number
          actionId: string
          params: ActionParams
        }
        const targetTabId = tabId || (await getActiveTab())?.id
        if (!targetTabId) {
          sendResponse({ success: false, error: 'No active tab found' })
          return
        }

        const result = await sendToContentScript<ActionResult>(targetTabId, {
          action: 'executeAction',
          actionId,
          params,
        })
        sendResponse(result)
      } catch (e) {
        console.error('[Madoka BG] Execute action failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'getAllContexts') {
    ;(async () => {
      try {
        const contexts = await searchAllContexts(request.query as string)
        sendResponse({ success: true, data: contexts })
      } catch (e) {
        console.error('[Madoka BG] Get all contexts failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  if (request.action === 'getContextContent') {
    ;(async () => {
      try {
        const content = await resolveContextContent(request.ref as AnyContextRef)
        sendResponse({ success: true, data: content })
      } catch (e) {
        console.error('[Madoka BG] Get context content failed:', e)
        sendResponse({ success: false, error: (e as Error).message })
      }
    })()
    return true
  }

  // Context-related messages
  if (request.action === 'getAllTabs') {
    getAllTabs()
      .then((tabs) => sendResponse({ success: true, data: tabs }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'searchTabs') {
    searchTabs(request.query as string)
      .then((tabs) => sendResponse({ success: true, data: tabs }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'searchBookmarks') {
    searchBookmarks(request.query as string)
      .then((bookmarks) => sendResponse({ success: true, data: bookmarks }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'getHistory') {
    getHistory(request.query as string, request.maxResults as number)
      .then((history) => sendResponse({ success: true, data: history }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'getCurrentPage') {
    getCurrentPage()
      .then((page) => sendResponse({ success: true, data: page }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  // ============ API Proxy ============

  if (request.action === 'callTongyiAPI') {
    callTongyiAPI(request.messages, request.stream as boolean)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'analyzeSearchNeed') {
    analyzeSearchNeed(request.question as string)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'extractSearchKeywords') {
    extractSearchKeywords(request.question as string)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'condenseQuestion') {
    condenseQuestion(request.history as string, request.question as string)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  if (request.action === 'callTongyiAPIForOptimize') {
    callTongyiAPIForOptimize(request.messages)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((e: Error) => sendResponse({ success: false, error: e.message }))
    return true
  }

  return false
})

/**
 * Handle chat request
 */
async function handleChatRequest(
  request: Record<string, unknown>,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const tabId = sender.tab?.id
  if (!tabId) return

  try {
    await handleChat(
      request.messages as Array<{ role: string; content: string }>,
      request.stream as boolean,
      (chunk) => {
        chrome.tabs.sendMessage(tabId, {
          action: 'chatStream',
          chunk,
        })
      }
    )
  } catch (e) {
    console.error('[Madoka BG] Chat failed:', e)
    chrome.tabs.sendMessage(tabId, {
      action: 'chatStream',
      chunk: { error: (e as Error).message },
    })
  }
}

/**
 * Handle smart chat request with search
 */
async function handleSmartChatRequest(
  request: Record<string, unknown>,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const tabId = sender.tab?.id
  if (!tabId) return

  try {
    const { question, searchResults } = await searchAndReadMultiRound(
      request.question as string,
      request.history as string,
      (content) => {
        chrome.tabs.sendMessage(tabId, {
          action: 'chatStream',
          chunk: { content },
        })
      }
    )

    // Send final answer
    await handleChat(
      [
        {
          role: 'system',
          content: `Based on the following search results, answer the user's question:\n\n${searchResults}`,
        },
        { role: 'user', content: question },
      ],
      true,
      (chunk) => {
        chrome.tabs.sendMessage(tabId, {
          action: 'chatStream',
          chunk,
        })
      }
    )
  } catch (e) {
    console.error('[Madoka BG] Smart chat failed:', e)
    chrome.tabs.sendMessage(tabId, {
      action: 'chatStream',
      chunk: { error: (e as Error).message },
    })
  }
}

/**
 * Handle read page request
 */
async function handleReadPageRequest(
  request: Record<string, unknown>,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const tab = await getActiveTab()
    if (!tab?.id) {
      sendResponse({ success: false, error: 'No active tab' })
      return
    }

    const content = await sendToContentScript<{ content: string; title: string; url: string }>(
      tab.id,
      { action: 'readPage' }
    )
    sendResponse({ success: true, data: content })
  } catch (e) {
    console.error('[Madoka BG] Read page failed:', e)
    sendResponse({ success: false, error: (e as Error).message })
  }
}

/**
 * Initialize extension
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Madoka] Extension installed')
})

console.log('[Madoka] Background service worker started')
