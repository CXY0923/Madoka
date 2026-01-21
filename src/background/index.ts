/**
 * Madoka Background Service Worker
 * Handles search, content reading, API calls, and Action Space operations
 */

import type { SearchEngine, SearchContext } from '../shared/types'
import type { ActionParams, ActionSpace, ActionResult } from '../shared/action-types'
import type { AnyContextRef } from '../shared/context-types'
import { getConfig, saveConfig } from './config'
import { searchAndRead } from './search'
import { handleChat, callTongyiAPI, analyzeSearchNeed, extractSearchKeywords, callTongyiAPIForOptimize } from './api'
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

      console.log('[Madoka BG] Search query:', searchQuery)

      try {
        searchContext = await searchAndRead(searchQuery, {
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
})

// Open Side Panel on extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

// Set Side Panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Madoka] Failed to set Side Panel behavior:', error))

console.log('[Madoka] Background Service Worker started')
