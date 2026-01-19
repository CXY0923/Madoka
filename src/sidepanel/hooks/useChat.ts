/**
 * useChat Hook
 * Handles chat logic with smart search and auto page reading
 */

import { useCallback } from 'react'
import { useChatContext } from '../context/ChatContext'
import { getActiveTab } from '../../shared/messaging'

export function useChat() {
  const { state, addMessage, startResponse, dispatch, mode, pageContent } = useChatContext()

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || state.isResponding) return

      // Check if force search
      const forceSearch = content.startsWith('/search ') || content.startsWith('/搜索 ')

      // Add user message
      addMessage({
        role: 'user',
        content,
      })

      // Set status
      dispatch({ type: 'SET_STATUS', payload: 'responding' })

      // Start assistant response
      startResponse()

      // Get current tab
      const tab = await getActiveTab()

      // Build history messages
      const history = state.conversations
        .find(c => c.id === state.activeConversationId)
        ?.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role,
          content: m.content,
        })) || []

      // In chat mode, use smart chat with auto page reading
      const useSmartChat = mode === 'chat'

      // Send chat request
      chrome.runtime.sendMessage({
        action: useSmartChat ? 'smartChat' : 'chat',
        message: content,
        history,
        forceSearch,
        engine: state.currentEngine,
        pageContent: pageContent?.markdown,
        tabId: tab?.id,
        autoReadPage: useSmartChat && !pageContent, // Auto-read if no page content in chat mode
      })

      // Clear page content after sending
      if (pageContent) {
        dispatch({ type: 'SET_PAGE_CONTENT', payload: null })
      }
    },
    [state, addMessage, startResponse, dispatch, mode, pageContent]
  )

  return {
    sendMessage,
    isResponding: state.isResponding,
    status: state.status,
    searchStatus: state.searchStatus,
  }
}
