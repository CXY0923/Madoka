/**
 * Context API
 * 获取浏览器上下文：Tabs、Bookmarks、History
 */

import type {
  TabRef,
  BookmarkRef,
  HistoryRef,
  PageRef,
  AnyContextRef,
} from '../shared/context-types'

// ============ Tabs API ============

/**
 * 获取所有打开的标签页
 */
export async function getAllTabs(): Promise<TabRef[]> {
  try {
    const tabs = await chrome.tabs.query({})
    
    return tabs
      .filter(tab => tab.id && tab.url && !tab.url.startsWith('chrome://'))
      .map(tab => ({
        type: 'tab' as const,
        id: `tab-${tab.id}`,
        tabId: tab.id!,
        windowId: tab.windowId!,
        title: tab.title || 'Untitled',
        url: tab.url!,
        favicon: tab.favIconUrl,
        active: tab.active,
        pinned: tab.pinned,
        addedAt: Date.now(),
      }))
      .sort((a, b) => {
        // 活动标签排在前面
        if (a.active && !b.active) return -1
        if (!a.active && b.active) return 1
        // 固定标签排在前面
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return 0
      })
  } catch (e) {
    console.error('[Madoka Context] Failed to get tabs:', e)
    return []
  }
}

/**
 * 搜索标签页
 */
export async function searchTabs(query: string): Promise<TabRef[]> {
  const allTabs = await getAllTabs()
  
  if (!query.trim()) return allTabs
  
  const lowerQuery = query.toLowerCase()
  return allTabs.filter(tab =>
    tab.title.toLowerCase().includes(lowerQuery) ||
    tab.url.toLowerCase().includes(lowerQuery)
  )
}

// ============ Bookmarks API ============

/**
 * 递归展平书签树
 */
async function flattenBookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  parentPath: string = ''
): Promise<BookmarkRef[]> {
  const results: BookmarkRef[] = []
  
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath}/${node.title}` : node.title
    
    if (node.url) {
      // 这是一个书签
      results.push({
        type: 'bookmark',
        id: `bookmark-${node.id}`,
        bookmarkId: node.id,
        title: node.title || 'Untitled',
        url: node.url,
        folder: parentPath || undefined,
        dateAdded: node.dateAdded,
        addedAt: Date.now(),
      })
    }
    
    if (node.children) {
      // 这是一个文件夹，递归处理
      const childResults = await flattenBookmarkTree(node.children, currentPath)
      results.push(...childResults)
    }
  }
  
  return results
}

/**
 * 获取所有书签
 */
export async function getAllBookmarks(): Promise<BookmarkRef[]> {
  try {
    const tree = await chrome.bookmarks.getTree()
    return flattenBookmarkTree(tree)
  } catch (e) {
    console.error('[Madoka Context] Failed to get bookmarks:', e)
    return []
  }
}

/**
 * 搜索书签
 */
export async function searchBookmarks(query: string): Promise<BookmarkRef[]> {
  try {
    if (!query.trim()) {
      // 无查询时返回最近添加的书签
      const all = await getAllBookmarks()
      return all
        .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
        .slice(0, 20)
    }
    
    const results = await chrome.bookmarks.search(query)
    
    return results
      .filter(b => b.url)
      .map(b => ({
        type: 'bookmark' as const,
        id: `bookmark-${b.id}`,
        bookmarkId: b.id,
        title: b.title || 'Untitled',
        url: b.url!,
        dateAdded: b.dateAdded,
        addedAt: Date.now(),
      }))
  } catch (e) {
    console.error('[Madoka Context] Failed to search bookmarks:', e)
    return []
  }
}

// ============ History API ============

/**
 * 获取历史记录
 */
export async function getHistory(
  query: string = '',
  maxResults: number = 20
): Promise<HistoryRef[]> {
  try {
    const items = await chrome.history.search({
      text: query,
      maxResults,
      startTime: Date.now() - 7 * 24 * 3600 * 1000, // 最近7天
    })
    
    return items
      .filter(h => h.url && !h.url.startsWith('chrome://'))
      .map(h => ({
        type: 'history' as const,
        id: `history-${encodeURIComponent(h.url!).slice(0, 100)}`,
        title: h.title || h.url!,
        url: h.url!,
        visitCount: h.visitCount,
        lastVisitTime: h.lastVisitTime,
        addedAt: Date.now(),
      }))
  } catch (e) {
    console.error('[Madoka Context] Failed to get history:', e)
    return []
  }
}

// ============ Current Page API ============

/**
 * 获取当前页面信息
 */
export async function getCurrentPage(): Promise<PageRef | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (!tab || !tab.id || !tab.url) return null
    
    return {
      type: 'page',
      id: `page-${tab.id}`,
      title: tab.title || 'Current Page',
      url: tab.url,
      favicon: tab.favIconUrl,
      addedAt: Date.now(),
    }
  } catch (e) {
    console.error('[Madoka Context] Failed to get current page:', e)
    return null
  }
}

// ============ Content Resolution ============

/**
 * 解析上下文内容（获取页面实际内容）
 */
export async function resolveContextContent(ref: AnyContextRef): Promise<string> {
  console.log('[Madoka Context] Resolving content for:', ref.type, ref.title)
  
  try {
    if (ref.type === 'tab') {
      const tabRef = ref as TabRef
      
      // 注入脚本读取页面内容
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabRef.tabId },
        func: () => {
          // 尝试使用 MadokaReader
          const reader = (window as unknown as { MadokaReader?: { readCurrentPage: () => Promise<{ content: string }> } }).MadokaReader
          if (reader) {
            return reader.readCurrentPage().then(r => r.content)
          }
          
          // 降级：简单提取文本
          const title = document.title
          const text = document.body.innerText
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 8000)
          
          return `# ${title}\n\nURL: ${location.href}\n\n${text}`
        },
      })
      
      const content = await results[0]?.result
      return typeof content === 'string' ? content : ''
    }
    
    if (ref.type === 'page') {
      // 当前页面，同样通过 tab 读取
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return ''
      
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const reader = (window as unknown as { MadokaReader?: { readCurrentPage: () => Promise<{ content: string }> } }).MadokaReader
          if (reader) {
            return reader.readCurrentPage().then(r => r.content)
          }
          
          const title = document.title
          const text = document.body.innerText
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 8000)
          
          return `# ${title}\n\nURL: ${location.href}\n\n${text}`
        },
      })
      
      const content = await results[0]?.result
      return typeof content === 'string' ? content : ''
    }
    
    if (ref.type === 'bookmark' || ref.type === 'history') {
      // 对于书签和历史，需要在后台打开页面读取
      // 使用已有的 fetchPageInRealTab
      const { fetchPageInRealTab } = await import('./search')
      const html = await fetchPageInRealTab(ref.url)
      
      // 简单提取文本
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)
      
      return `# ${ref.title}\n\nURL: ${ref.url}\n\n${text}`
    }
    
    return ''
  } catch (e) {
    console.error('[Madoka Context] Failed to resolve content:', e)
    return `[Failed to load content from ${ref.url}]`
  }
}

// ============ 统一搜索 ============

/**
 * 统一搜索所有上下文类型
 */
export async function searchAllContexts(query: string): Promise<{
  tabs: TabRef[]
  bookmarks: BookmarkRef[]
  history: HistoryRef[]
  currentPage: PageRef | null
}> {
  const [tabs, bookmarks, history, currentPage] = await Promise.all([
    searchTabs(query),
    searchBookmarks(query),
    getHistory(query, 10),
    getCurrentPage(),
  ])
  
  return { tabs, bookmarks, history, currentPage }
}
