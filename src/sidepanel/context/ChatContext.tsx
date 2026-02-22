/**
 * Chat Context
 * Global state management with multi-conversation support
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import type {
  ChatStatus,
  Message,
  BackgroundMessage,
  SearchResult,
  SearchEngine,
  PageContent,
} from '../../shared/types'
import type {
  ActionSpace,
  ActionPlanItem,
  ActionResult,
  ActionParams,
  ActionStatus,
  Action,
} from '../../shared/action-types'
import type {
  AnyContextRef,
  AttachedContext,
  TabRef,
  BookmarkRef,
  HistoryRef,
  PageRef,
} from '../../shared/context-types'
import { emptyAttachedContext } from '../../shared/context-types'
import { onBackgroundMessage, sendToBackground } from '../../shared/messaging'
import type { Theme } from '../styles/theme'
import { initializeTheme, setTheme as setDocTheme } from '../styles/theme'

// ============ Types ============

export type AppMode = 'chat' | 'agent'
export type ViewState = 'chat' | 'settings' | 'linkSummary'

// Conversation type
export interface Conversation {
  id: string
  title: string
  mode: AppMode
  messages: Message[]
  createdAt: number
  updatedAt: number
  pageContent: PageContent | null
  // Agent state per conversation
  agent: AgentState
  // Context references (like Cursor's @file)
  attachedContext: AttachedContext
}

// Agent state
interface AgentState {
  isAgentMode: boolean
  actionSpace: ActionSpace | null
  actionPlan: ActionPlanItem[]
  currentActionIndex: number
  isExecuting: boolean
  executionHistory: ActionResult[]
}

// Link summary state
export interface LinkSummaryState {
  url: string
  title: string
  summary: string
  points: Array<{
    summary: string
    verbatimQuote: string
    selectors?: string[]
    contextBefore?: string
    contextAfter?: string
  }>
  loading: boolean
  error?: string
}

// App state
interface AppState {
  // Multi-conversation
  conversations: Conversation[]
  activeConversationId: string | null
  
  // UI state
  sidebarOpen: boolean
  theme: Theme
  view: ViewState
  
  // Chat state
  status: ChatStatus
  isResponding: boolean
  searchStatus: string | null
  currentEngine: SearchEngine
  
  // Link summary state
  linkSummary: LinkSummaryState | null
}

// Initial agent state
const initialAgentState: AgentState = {
  isAgentMode: false,
  actionSpace: null,
  actionPlan: [],
  currentActionIndex: 0,
  isExecuting: false,
  executionHistory: [],
}

// Create new conversation
function createConversation(mode: AppMode = 'chat'): Conversation {
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: 'New Conversation',
    mode,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pageContent: null,
    agent: { ...initialAgentState },
    attachedContext: { ...emptyAttachedContext },
  }
}

// Initial state
const initialConversation = createConversation()
const initialState: AppState = {
  conversations: [initialConversation],
  activeConversationId: initialConversation.id,
  sidebarOpen: true,
  theme: 'light',
  view: 'chat',
  status: 'idle',
  isResponding: false,
  searchStatus: null,
  currentEngine: 'bing',
  linkSummary: null,
}

// ============ Actions ============

type AppAction =
  // Conversation actions
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'DELETE_CONVERSATION'; payload: string }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: string }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'UPDATE_CONVERSATION_TITLE'; payload: { id: string; title: string } }
  // Message actions (for active conversation)
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'FINISH_RESPONSE'; payload: string }
  // UI actions
  | { type: 'SET_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_VIEW'; payload: ViewState }
  | { type: 'SET_MODE'; payload: AppMode }
  // Chat state actions
  | { type: 'SET_STATUS'; payload: ChatStatus }
  | { type: 'SET_ENGINE'; payload: SearchEngine }
  | { type: 'SET_PAGE_CONTENT'; payload: PageContent | null }
  | { type: 'SET_SEARCH_STATUS'; payload: string | null }
  // Agent actions
  | { type: 'SET_AGENT_MODE'; payload: boolean }
  | { type: 'SET_ACTION_SPACE'; payload: ActionSpace | null }
  | { type: 'SET_ACTION_PLAN'; payload: ActionPlanItem[] }
  | { type: 'SET_CURRENT_ACTION_INDEX'; payload: number }
  | { type: 'SET_EXECUTING'; payload: boolean }
  | { type: 'UPDATE_ACTION_STATUS'; payload: { actionId: string; status: ActionStatus; result?: ActionResult } }
  | { type: 'ADD_EXECUTION_RESULT'; payload: ActionResult }
  | { type: 'RESET_AGENT' }
  // Context reference actions
  | { type: 'ADD_CONTEXT_REF'; payload: AnyContextRef }
  | { type: 'REMOVE_CONTEXT_REF'; payload: string }
  | { type: 'CLEAR_CONTEXT_REFS' }
  | { type: 'SET_CONTEXT_RESOLVING'; payload: { id: string; resolving: boolean } }
  | { type: 'SET_RESOLVED_CONTENT'; payload: { id: string; content: string } }
  // Link summary actions
  | { type: 'SET_LINK_SUMMARY'; payload: LinkSummaryState }
  | { type: 'CLEAR_LINK_SUMMARY' }
  | { type: 'UPDATE_LINK_SUMMARY'; payload: Partial<LinkSummaryState> }
  // Hydration
  | { type: 'HYDRATE'; payload: Partial<AppState> }

// Helper to get active conversation
function getActiveConversation(state: AppState): Conversation | null {
  return state.conversations.find(c => c.id === state.activeConversationId) || null
}

// Helper to update active conversation
function updateActiveConversation(
  state: AppState,
  updater: (conv: Conversation) => Conversation
): AppState {
  const activeConv = getActiveConversation(state)
  if (!activeConv) return state
  
  return {
    ...state,
    conversations: state.conversations.map(c =>
      c.id === activeConv.id ? updater(c) : c
    ),
  }
}

// ============ Reducer ============

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Conversation actions
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload }
    
    case 'ADD_CONVERSATION':
      return {
        ...state,
        conversations: [action.payload, ...state.conversations],
        activeConversationId: action.payload.id,
      }
    
    case 'DELETE_CONVERSATION': {
      const remaining = state.conversations.filter(c => c.id !== action.payload)
      const newActive = remaining.length > 0 
        ? (state.activeConversationId === action.payload ? remaining[0].id : state.activeConversationId)
        : null
      
      // If no conversations left, create a new one
      if (remaining.length === 0) {
        const newConv = createConversation()
        return {
          ...state,
          conversations: [newConv],
          activeConversationId: newConv.id,
        }
      }
      
      return {
        ...state,
        conversations: remaining,
        activeConversationId: newActive,
      }
    }
    
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversationId: action.payload }
    
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.payload.id
            ? { ...c, ...action.payload.updates, updatedAt: Date.now() }
            : c
        ),
      }
    
    case 'UPDATE_CONVERSATION_TITLE':
      return {
        ...state,
        conversations: state.conversations.map(c =>
          c.id === action.payload.id
            ? { ...c, title: action.payload.title, updatedAt: Date.now() }
            : c
        ),
      }
    
    // Message actions
    case 'ADD_MESSAGE':
      return updateActiveConversation(state, conv => ({
        ...conv,
        messages: [...conv.messages, action.payload],
        updatedAt: Date.now(),
        // Auto-generate title from first user message
        title: conv.messages.length === 0 && action.payload.role === 'user'
          ? action.payload.content.slice(0, 30) + (action.payload.content.length > 30 ? '...' : '')
          : conv.title,
      }))
    
    case 'UPDATE_MESSAGE':
      return updateActiveConversation(state, conv => ({
        ...conv,
        messages: conv.messages.map(msg =>
          msg.id === action.payload.id ? { ...msg, content: action.payload.content } : msg
        ),
      }))
    
    case 'CLEAR_MESSAGES':
      return updateActiveConversation(state, conv => ({
        ...conv,
        messages: [],
        title: 'New Conversation',
      }))
    
    case 'FINISH_RESPONSE':
      return {
        ...updateActiveConversation(state, conv => ({
          ...conv,
          messages: conv.messages.map(msg =>
            msg.isStreaming ? { ...msg, content: action.payload, isStreaming: false } : msg
          ),
        })),
        status: 'idle',
        isResponding: false,
        searchStatus: null,
      }
    
    // UI actions
    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.payload }
    
    case 'SET_THEME':
      return { ...state, theme: action.payload }
    
    case 'SET_VIEW':
      return { ...state, view: action.payload }
    
    case 'SET_MODE':
      return updateActiveConversation(state, conv => ({
        ...conv,
        mode: action.payload,
        agent: action.payload === 'agent' ? conv.agent : { ...initialAgentState },
      }))
    
    // Chat state actions
    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
        isResponding: action.payload !== 'idle',
      }
    
    case 'SET_ENGINE':
      return { ...state, currentEngine: action.payload }
    
    case 'SET_PAGE_CONTENT':
      return updateActiveConversation(state, conv => ({
        ...conv,
        pageContent: action.payload,
      }))
    
    case 'SET_SEARCH_STATUS':
      return { ...state, searchStatus: action.payload }
    
    // Agent actions
    case 'SET_AGENT_MODE':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: { ...conv.agent, isAgentMode: action.payload },
      }))
    
    case 'SET_ACTION_SPACE':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: { ...conv.agent, actionSpace: action.payload },
      }))
    
    case 'SET_ACTION_PLAN':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: { ...conv.agent, actionPlan: action.payload, currentActionIndex: 0 },
      }))
    
    case 'SET_CURRENT_ACTION_INDEX':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: { ...conv.agent, currentActionIndex: action.payload },
      }))
    
    case 'SET_EXECUTING':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: { ...conv.agent, isExecuting: action.payload },
      }))
    
    case 'UPDATE_ACTION_STATUS':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: {
          ...conv.agent,
          actionPlan: conv.agent.actionPlan.map(item =>
            item.action.actionId === action.payload.actionId
              ? { ...item, status: action.payload.status, result: action.payload.result }
              : item
          ),
        },
      }))
    
    case 'ADD_EXECUTION_RESULT':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: {
          ...conv.agent,
          executionHistory: [...conv.agent.executionHistory, action.payload],
        },
      }))
    
    case 'RESET_AGENT':
      return updateActiveConversation(state, conv => ({
        ...conv,
        agent: { ...initialAgentState },
      }))
    
    // Context reference actions
    case 'ADD_CONTEXT_REF':
      return updateActiveConversation(state, conv => {
        // 避免重复添加
        if (conv.attachedContext.refs.some(r => r.id === action.payload.id)) {
          return conv
        }
        return {
          ...conv,
          attachedContext: {
            ...conv.attachedContext,
            refs: [...conv.attachedContext.refs, action.payload],
          },
        }
      })
    
    case 'REMOVE_CONTEXT_REF':
      return updateActiveConversation(state, conv => ({
        ...conv,
        attachedContext: {
          ...conv.attachedContext,
          refs: conv.attachedContext.refs.filter(r => r.id !== action.payload),
          resolvedContent: Object.fromEntries(
            Object.entries(conv.attachedContext.resolvedContent).filter(([k]) => k !== action.payload)
          ),
          resolvingIds: conv.attachedContext.resolvingIds.filter(id => id !== action.payload),
        },
      }))
    
    case 'CLEAR_CONTEXT_REFS':
      return updateActiveConversation(state, conv => ({
        ...conv,
        attachedContext: { ...emptyAttachedContext },
      }))
    
    case 'SET_CONTEXT_RESOLVING':
      return updateActiveConversation(state, conv => ({
        ...conv,
        attachedContext: {
          ...conv.attachedContext,
          resolvingIds: action.payload.resolving
            ? [...conv.attachedContext.resolvingIds, action.payload.id]
            : conv.attachedContext.resolvingIds.filter(id => id !== action.payload.id),
        },
      }))
    
    case 'SET_RESOLVED_CONTENT':
      return updateActiveConversation(state, conv => ({
        ...conv,
        attachedContext: {
          ...conv.attachedContext,
          resolvedContent: {
            ...conv.attachedContext.resolvedContent,
            [action.payload.id]: action.payload.content,
          },
          resolvingIds: conv.attachedContext.resolvingIds.filter(id => id !== action.payload.id),
        },
      }))
    
    // Link summary actions
    case 'SET_LINK_SUMMARY':
      return { ...state, linkSummary: action.payload, view: 'linkSummary' }
    
    case 'CLEAR_LINK_SUMMARY':
      return { ...state, linkSummary: null, view: 'chat' }
    
    case 'UPDATE_LINK_SUMMARY':
      return {
        ...state,
        linkSummary: state.linkSummary ? { ...state.linkSummary, ...action.payload } : null,
      }
    
    case 'HYDRATE':
      return { ...state, ...action.payload }
    
    default:
      return state
  }
}

// ============ Context ============

interface ChatContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  
  // Convenience getters
  activeConversation: Conversation | null
  messages: Message[]
  mode: AppMode
  agent: AgentState
  pageContent: PageContent | null
  attachedContext: AttachedContext
  
  // Conversation methods
  createNewConversation: (mode?: AppMode) => string
  switchConversation: (id: string) => void
  deleteConversation: (id: string) => void
  
  // Message methods
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, content: string) => void
  clearMessages: () => void
  
  // UI methods
  setView: (view: ViewState) => void
  setMode: (mode: AppMode) => void
  toggleSidebar: () => void
  setTheme: (theme: Theme) => void
  
  // Chat methods
  setEngine: (engine: SearchEngine) => void
  startResponse: () => string
  finishResponse: (content: string) => void
  setSearchResults: (messageId: string, results: SearchResult[]) => void
  
  // Agent methods
  extractActionSpace: () => Promise<ActionSpace | null>
  createActionPlan: (actions: Action[]) => void
  executeAction: (actionId: string, params?: ActionParams) => Promise<ActionResult | null>
  confirmAction: (actionId: string) => Promise<void>
  skipAction: (actionId: string) => void
  cancelPlan: () => void
  highlightAction: (actionId: string, highlight: boolean) => Promise<void>
  resetAgent: () => void
  
  // Context reference methods
  addContextRef: (ref: AnyContextRef) => void
  removeContextRef: (id: string) => void
  clearContextRefs: () => void
  resolveContextRef: (ref: AnyContextRef) => Promise<string>
  fetchTabs: (query?: string) => Promise<TabRef[]>
  fetchBookmarks: (query?: string) => Promise<BookmarkRef[]>
  fetchHistory: (query?: string, maxResults?: number) => Promise<HistoryRef[]>
  fetchCurrentPage: () => Promise<PageRef | null>
}

const ChatContext = createContext<ChatContextType | null>(null)

// ============ Provider ============

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const currentAssistantId = useRef<string | null>(null)
  const initialized = useRef(false)

  // Convenience getters
  const activeConversation = getActiveConversation(state)
  const messages = activeConversation?.messages || []
  const mode = activeConversation?.mode || 'chat'
  const agent = activeConversation?.agent || initialAgentState
  const pageContent = activeConversation?.pageContent || null
  const attachedContext = activeConversation?.attachedContext || emptyAttachedContext

  // Initialize from storage
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const init = async () => {
      // Initialize theme
      const theme = await initializeTheme()
      dispatch({ type: 'SET_THEME', payload: theme })

      // Load conversations from storage
      try {
        const result = await chrome.storage.local.get(['conversations', 'activeConversationId', 'sidebarOpen'])
        
        if (result.conversations && result.conversations.length > 0) {
          dispatch({ type: 'SET_CONVERSATIONS', payload: result.conversations })
          if (result.activeConversationId) {
            dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: result.activeConversationId })
          }
        }
        
        if (typeof result.sidebarOpen === 'boolean') {
          dispatch({ type: 'SET_SIDEBAR_OPEN', payload: result.sidebarOpen })
        }
      } catch (e) {
        console.error('[ChatContext] Failed to load from storage:', e)
      }
    }

    init()
  }, [])

  // Persist to storage
  useEffect(() => {
    if (!initialized.current) return

    const save = async () => {
      try {
        await chrome.storage.local.set({
          conversations: state.conversations,
          activeConversationId: state.activeConversationId,
          sidebarOpen: state.sidebarOpen,
        })
      } catch (e) {
        console.error('[ChatContext] Failed to save to storage:', e)
      }
    }

    // Debounce save
    const timer = setTimeout(save, 500)
    return () => clearTimeout(timer)
  }, [state.conversations, state.activeConversationId, state.sidebarOpen])

  // ============ Conversation Methods ============

  const createNewConversation = useCallback((newMode: AppMode = 'chat'): string => {
    const conv = createConversation(newMode)
    dispatch({ type: 'ADD_CONVERSATION', payload: conv })
    return conv.id
  }, [])

  const switchConversation = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: id })
  }, [])

  const deleteConversation = useCallback((id: string) => {
    dispatch({ type: 'DELETE_CONVERSATION', payload: id })
  }, [])

  // ============ Message Methods ============

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>): string => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const fullMessage: Message = {
      ...message,
      id,
      timestamp: Date.now(),
    }
    dispatch({ type: 'ADD_MESSAGE', payload: fullMessage })
    return id
  }, [])

  const updateMessage = useCallback((id: string, content: string) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { id, content } })
  }, [])

  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' })
  }, [])

  // ============ UI Methods ============

  const setView = useCallback((view: ViewState) => {
    dispatch({ type: 'SET_VIEW', payload: view })
  }, [])

  const setMode = useCallback((newMode: AppMode) => {
    dispatch({ type: 'SET_MODE', payload: newMode })
  }, [])

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'SET_SIDEBAR_OPEN', payload: !state.sidebarOpen })
  }, [state.sidebarOpen])

  const setTheme = useCallback((theme: Theme) => {
    setDocTheme(theme)
    dispatch({ type: 'SET_THEME', payload: theme })
  }, [])

  // ============ Chat Methods ============

  const setEngine = useCallback((engine: SearchEngine) => {
    dispatch({ type: 'SET_ENGINE', payload: engine })
  }, [])

  const startResponse = useCallback((): string => {
    const id = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    })
    currentAssistantId.current = id
    dispatch({ type: 'SET_STATUS', payload: 'responding' })
    return id
  }, [addMessage])

  const finishResponse = useCallback((content: string) => {
    dispatch({ type: 'FINISH_RESPONSE', payload: content })
    currentAssistantId.current = null
  }, [])

  const setSearchResults = useCallback((messageId: string, _results: SearchResult[]) => {
    // Update message with search results
    const msg = messages.find(m => m.id === messageId)
    if (msg) {
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: { id: messageId, content: msg.content },
      })
    }
  }, [messages])

  // ============ Agent Methods ============

  const extractActionSpace = useCallback(async (): Promise<ActionSpace | null> => {
    try {
      const response = await sendToBackground<{
        success: boolean
        actionSpace?: ActionSpace
        error?: string
      }>({ action: 'extractActionSpace' })

      if (response.success && response.actionSpace) {
        dispatch({ type: 'SET_ACTION_SPACE', payload: response.actionSpace })
        dispatch({ type: 'SET_AGENT_MODE', payload: true })
        return response.actionSpace
      } else {
        console.error('[ChatContext] Failed to extract Action Space:', response.error)
        return null
      }
    } catch (e) {
      console.error('[ChatContext] Failed to extract Action Space:', e)
      return null
    }
  }, [])

  const createActionPlan = useCallback((actions: Action[]) => {
    const planItems: ActionPlanItem[] = actions.map(action => ({
      action,
      status: 'pending' as ActionStatus,
    }))
    dispatch({ type: 'SET_ACTION_PLAN', payload: planItems })
  }, [])

  const executeAction = useCallback(async (actionId: string, params?: ActionParams): Promise<ActionResult | null> => {
    try {
      dispatch({ type: 'SET_EXECUTING', payload: true })
      dispatch({ type: 'UPDATE_ACTION_STATUS', payload: { actionId, status: 'executing' } })

      const response = await sendToBackground<{
        success: boolean
        result?: ActionResult
        error?: string
      }>({
        action: 'executeAction',
        actionId,
        params,
      })

      if (response.success && response.result) {
        dispatch({
          type: 'UPDATE_ACTION_STATUS',
          payload: {
            actionId,
            status: response.result.success ? 'success' : 'failed',
            result: response.result,
          },
        })
        dispatch({ type: 'ADD_EXECUTION_RESULT', payload: response.result })
        return response.result
      } else {
        dispatch({
          type: 'UPDATE_ACTION_STATUS',
          payload: {
            actionId,
            status: 'failed',
            result: {
              success: false,
              actionId,
              error: response.error || 'Unknown error',
              domChanged: false,
              urlChanged: false,
              duration: 0,
            },
          },
        })
        return null
      }
    } catch (e) {
      console.error('[ChatContext] Failed to execute Action:', e)
      return null
    } finally {
      dispatch({ type: 'SET_EXECUTING', payload: false })
    }
  }, [])

  const confirmAction = useCallback(async (actionId: string) => {
    const result = await executeAction(actionId)
    if (result) {
      dispatch({
        type: 'SET_CURRENT_ACTION_INDEX',
        payload: agent.currentActionIndex + 1,
      })
    }
  }, [executeAction, agent.currentActionIndex])

  const skipAction = useCallback((actionId: string) => {
    dispatch({ type: 'UPDATE_ACTION_STATUS', payload: { actionId, status: 'skipped' } })
    dispatch({ type: 'SET_CURRENT_ACTION_INDEX', payload: agent.currentActionIndex + 1 })
  }, [agent.currentActionIndex])

  const cancelPlan = useCallback(() => {
    dispatch({ type: 'RESET_AGENT' })
    sendToBackground({ action: 'clearHighlights' }).catch(() => {})
  }, [])

  const highlightAction = useCallback(async (actionId: string, highlight: boolean) => {
    try {
      await sendToBackground({
        action: 'highlightAction',
        actionId,
        highlight,
        status: 'pending',
      })
    } catch (e) {
      console.error('[ChatContext] Failed to highlight:', e)
    }
  }, [])

  const resetAgent = useCallback(() => {
    dispatch({ type: 'RESET_AGENT' })
  }, [])

  // ============ Context Reference Methods ============

  const addContextRef = useCallback((ref: AnyContextRef) => {
    dispatch({ type: 'ADD_CONTEXT_REF', payload: ref })
  }, [])

  const removeContextRef = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_CONTEXT_REF', payload: id })
  }, [])

  const clearContextRefs = useCallback(() => {
    dispatch({ type: 'CLEAR_CONTEXT_REFS' })
  }, [])

  const resolveContextRef = useCallback(async (ref: AnyContextRef): Promise<string> => {
    // 检查是否已解析
    if (attachedContext.resolvedContent[ref.id]) {
      return attachedContext.resolvedContent[ref.id]
    }

    // 标记为正在解析
    dispatch({ type: 'SET_CONTEXT_RESOLVING', payload: { id: ref.id, resolving: true } })

    try {
      const response = await sendToBackground<{ success: boolean; data?: string; error?: string }>({
        action: 'resolveContext',
        ref,
      })

      if (response.success && response.data) {
        dispatch({ type: 'SET_RESOLVED_CONTENT', payload: { id: ref.id, content: response.data } })
        return response.data
      } else {
        dispatch({ type: 'SET_CONTEXT_RESOLVING', payload: { id: ref.id, resolving: false } })
        return ''
      }
    } catch (e) {
      console.error('[ChatContext] Failed to resolve context:', e)
      dispatch({ type: 'SET_CONTEXT_RESOLVING', payload: { id: ref.id, resolving: false } })
      return ''
    }
  }, [attachedContext.resolvedContent])

  const fetchTabs = useCallback(async (query?: string): Promise<TabRef[]> => {
    try {
      const response = await sendToBackground<{ success: boolean; data?: TabRef[]; error?: string }>({
        action: 'getTabs',
        query,
      })
      return response.success ? (response.data || []) : []
    } catch (e) {
      console.error('[ChatContext] Failed to fetch tabs:', e)
      return []
    }
  }, [])

  const fetchBookmarks = useCallback(async (query?: string): Promise<BookmarkRef[]> => {
    try {
      const response = await sendToBackground<{ success: boolean; data?: BookmarkRef[]; error?: string }>({
        action: 'getBookmarks',
        query,
      })
      return response.success ? (response.data || []) : []
    } catch (e) {
      console.error('[ChatContext] Failed to fetch bookmarks:', e)
      return []
    }
  }, [])

  const fetchHistory = useCallback(async (query?: string, maxResults?: number): Promise<HistoryRef[]> => {
    try {
      const response = await sendToBackground<{ success: boolean; data?: HistoryRef[]; error?: string }>({
        action: 'getHistory',
        query,
        maxResults,
      })
      return response.success ? (response.data || []) : []
    } catch (e) {
      console.error('[ChatContext] Failed to fetch history:', e)
      return []
    }
  }, [])

  const fetchCurrentPage = useCallback(async (): Promise<PageRef | null> => {
    try {
      const response = await sendToBackground<{ success: boolean; data?: PageRef; error?: string }>({
        action: 'getCurrentPage',
      })
      return response.success ? (response.data || null) : null
    } catch (e) {
      console.error('[ChatContext] Failed to fetch current page:', e)
      return null
    }
  }, [])

  // ============ Background Message Listener ============

  useEffect(() => {
    const unsubscribe = onBackgroundMessage((message: BackgroundMessage) => {
      switch (message.action) {
        case 'streamChunk':
          if (currentAssistantId.current) {
            updateMessage(currentAssistantId.current, message.content)
          }
          break

        case 'streamEnd':
          finishResponse(message.content)
          break

        case 'searchResults':
          dispatch({ type: 'SET_SEARCH_STATUS', payload: `📖 Reading ${message.results.length} results...` })
          break

        case 'status':
          dispatch({ type: 'SET_SEARCH_STATUS', payload: message.message })
          break

        case 'error':
          dispatch({ type: 'SET_STATUS', payload: 'idle' })
          addMessage({
            role: 'system',
            content: `❌ ${message.message}`,
          })
          break
      }
    })

    return unsubscribe
  }, [addMessage, updateMessage, finishResponse])

  // ============ Context Value ============

  const value: ChatContextType = {
    state,
    dispatch,
    activeConversation,
    messages,
    mode,
    agent,
    pageContent,
    attachedContext,
    createNewConversation,
    switchConversation,
    deleteConversation,
    addMessage,
    updateMessage,
    clearMessages,
    setView,
    setMode,
    toggleSidebar,
    setTheme,
    setEngine,
    startResponse,
    finishResponse,
    setSearchResults,
    extractActionSpace,
    createActionPlan,
    executeAction,
    confirmAction,
    skipAction,
    cancelPlan,
    highlightAction,
    resetAgent,
    addContextRef,
    removeContextRef,
    clearContextRefs,
    resolveContextRef,
    fetchTabs,
    fetchBookmarks,
    fetchHistory,
    fetchCurrentPage,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// ============ Hook ============

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider')
  }
  return context
}
