/**
 * Context Reference Types
 * 类似 Cursor 的 @file 引用系统，但用于浏览器资源
 */

// ============ 基础类型 ============

/**
 * 上下文引用类型
 */
export type ContextRefType = 'tab' | 'bookmark' | 'history' | 'page'

/**
 * 基础上下文引用
 */
export interface ContextRef {
  /** 引用类型 */
  type: ContextRefType
  /** 唯一标识符 */
  id: string
  /** 显示标题 */
  title: string
  /** URL */
  url: string
  /** Favicon URL */
  favicon?: string
  /** 预览片段 */
  snippet?: string
  /** 添加时间 */
  addedAt: number
}

// ============ 具体引用类型 ============

/**
 * Tab 引用
 */
export interface TabRef extends ContextRef {
  type: 'tab'
  /** Chrome Tab ID */
  tabId: number
  /** Window ID */
  windowId: number
  /** 是否是当前活动标签 */
  active: boolean
  /** 是否固定 */
  pinned?: boolean
}

/**
 * 书签引用
 */
export interface BookmarkRef extends ContextRef {
  type: 'bookmark'
  /** Chrome Bookmark ID */
  bookmarkId: string
  /** 所属文件夹路径 */
  folder?: string
  /** 添加时间 */
  dateAdded?: number
}

/**
 * 历史记录引用
 */
export interface HistoryRef extends ContextRef {
  type: 'history'
  /** 访问次数 */
  visitCount?: number
  /** 最后访问时间 */
  lastVisitTime?: number
}

/**
 * 当前页面引用
 */
export interface PageRef extends ContextRef {
  type: 'page'
  /** 页面内容（Markdown） */
  content?: string
  /** 内容长度 */
  contentLength?: number
}

// ============ 联合类型 ============

export type AnyContextRef = TabRef | BookmarkRef | HistoryRef | PageRef

// ============ 上下文容器 ============

/**
 * 附加的上下文
 */
export interface AttachedContext {
  /** 所有引用 */
  refs: AnyContextRef[]
  /** 已解析的内容 Map<id, content> */
  resolvedContent: Record<string, string>
  /** 正在解析的引用 ID */
  resolvingIds: string[]
}

/**
 * 初始空上下文
 */
export const emptyAttachedContext: AttachedContext = {
  refs: [],
  resolvedContent: {},
  resolvingIds: [],
}

// ============ Picker 相关类型 ============

/**
 * Picker 分类
 */
export type PickerCategory = 'tabs' | 'bookmarks' | 'history' | 'current'

/**
 * Picker 项
 */
export interface PickerItem {
  category: PickerCategory
  ref: AnyContextRef
  matchScore?: number
}

/**
 * Picker 分组
 */
export interface PickerGroup {
  category: PickerCategory
  label: string
  icon: string
  items: PickerItem[]
}

// ============ 消息类型 ============

/**
 * 获取上下文的请求
 */
export interface GetContextRequest {
  action: 'getTabs' | 'getBookmarks' | 'getHistory' | 'getCurrentPage'
  query?: string
  maxResults?: number
}

/**
 * 解析上下文内容的请求
 */
export interface ResolveContextRequest {
  action: 'resolveContext'
  ref: AnyContextRef
}

/**
 * 上下文响应
 */
export interface ContextResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ============ 辅助函数 ============

/**
 * 获取引用类型的图标
 */
export function getContextIcon(type: ContextRefType): string {
  switch (type) {
    case 'tab': return '🌐'
    case 'bookmark': return '🔖'
    case 'history': return '🕐'
    case 'page': return '📄'
    default: return '📎'
  }
}

/**
 * 获取引用类型的标签
 */
export function getContextLabel(type: ContextRefType): string {
  switch (type) {
    case 'tab': return 'Tab'
    case 'bookmark': return 'Bookmark'
    case 'history': return 'History'
    case 'page': return 'Page'
    default: return 'Context'
  }
}

/**
 * 格式化时间差
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  
  return new Date(timestamp).toLocaleDateString()
}

/**
 * 从 URL 提取域名
 */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
