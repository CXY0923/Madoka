/**
 * useChat Hook
 * Handles chat logic with smart search, auto page reading, and GitHub repo search
 */

import { useCallback } from 'react'
import { useChatContext } from '../context/ChatContext'
import { getActiveTab, sendToBackground } from '../../shared/messaging'

const GITHUB_CMD_PREFIX = /^\/(github|find|找项目)\s+/i

export function useChat() {
  const { state, addMessage, startResponse, finishResponse, dispatch, mode, pageContent } = useChatContext()

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || state.isResponding) return

      const trimmed = content.trim()
      const githubMatch = trimmed.match(GITHUB_CMD_PREFIX)
      const isGitHubSearch = !!githubMatch
      const userQuery = isGitHubSearch ? trimmed.replace(GITHUB_CMD_PREFIX, '').trim() : ''

      // GitHub 找项目：仅调用 handleGitHubSearch，不产生对话流式回复
      if (isGitHubSearch) {
        addMessage({ role: 'user', content })
        dispatch({ type: 'SET_STATUS', payload: 'responding' })
        startResponse()
        if (!userQuery) {
          finishResponse('请输入要搜索的项目描述，例如：Python 异步 Web 框架')
          return
        }
        try {
          const res = await sendToBackground<{
            success: boolean
            query?: string
            items?: Array<{
              full_name: string
              html_url: string
              description: string
              stargazers_count: number
              language: string
              updated_at: string
            }>
            error?: string
          }>({ action: 'githubSearch', userQuery })
          if (res.success && res.items?.length) {
            finishResponse(`找到以下项目（搜索串: ${res.query}）：`, res.items)
          } else {
            finishResponse(res.error ? `搜索失败: ${res.error}` : '未找到相关项目')
          }
        } catch (e) {
          finishResponse(`请求失败: ${(e as Error).message}`)
        }
        return
      }

      // Check if force search
      const forceSearch = trimmed.startsWith('/search ') || trimmed.startsWith('/搜索 ')

      addMessage({ role: 'user', content })
      dispatch({ type: 'SET_STATUS', payload: 'responding' })
      startResponse()

      const tab = await getActiveTab()
      const history = state.conversations
        .find(c => c.id === state.activeConversationId)
        ?.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })) || []

      const useSmartChat = mode === 'chat'

      chrome.runtime.sendMessage({
        action: useSmartChat ? 'smartChat' : 'chat',
        message: content,
        history,
        forceSearch,
        engine: state.currentEngine,
        pageContent: pageContent?.markdown,
        tabId: tab?.id,
        autoReadPage: useSmartChat && !pageContent,
      })

      if (pageContent) {
        dispatch({ type: 'SET_PAGE_CONTENT', payload: null })
      }
    },
    [state, addMessage, startResponse, finishResponse, dispatch, mode, pageContent]
  )

  return {
    sendMessage,
    isResponding: state.isResponding,
    status: state.status,
    searchStatus: state.searchStatus,
  }
}
