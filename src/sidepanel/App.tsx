/**
 * Madoka App
 * Cursor-style browser agent with Chat/Agent modes
 */

import { useState, useEffect } from 'react'
import { ChatProvider, useChatContext } from './context/ChatContext'
import { Sidebar } from './components/layout/Sidebar'
import { MessageList } from './components/MessageList'
import { Composer } from './components/composer'
import { SettingsPanel } from './components/SettingsPanel'
import { ActionPlan } from './components/ActionPlan'
import { LinkSummaryPanel } from './components/LinkSummaryPanel'
import { AnimatePresence, motion } from 'framer-motion'

function MainContent() {
  const {
    state,
    messages,
    mode,
    agent,
    toggleSidebar,
    confirmAction,
    skipAction,
    cancelPlan,
    highlightAction,
    dispatch,
  } = useChatContext()
  const { view, isResponding, sidebarOpen, linkSummary } = state

  // Listen for messages from background
  useEffect(() => {
    const listener = (message: any) => {
      if (message.action === 'showLinkSummaryInSidepanel') {
        console.log('[App] Received showLinkSummaryInSidepanel:', message)
        // Initialize link summary state
        dispatch({
          type: 'SET_LINK_SUMMARY',
          payload: {
            url: message.linkUrl,
            title: message.linkText,
            summary: '',
            points: [],
            loading: true,
          },
        })
        // Fetch and summarize
        fetchAndSummarize(message.linkUrl, dispatch)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [dispatch])

  // Show link summary panel
  if (view === 'linkSummary' && linkSummary) {
    return (
      <motion.div
        className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <LinkSummaryPanel linkSummary={linkSummary} />
      </motion.div>
    )
  }

  // Show settings panel
  if (view === 'settings') {
    return (
      <motion.div
        className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <SettingsPanel />
      </motion.div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--bg-primary)]">
      {/* Header - Minimal style (只在 sidebar 关闭时显示切换按钮) */}
      {!sidebarOpen && (
        <header className="flex items-center px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Open sidebar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Status indicator */}
          {isResponding && (
            <div className="flex items-center gap-1.5 ml-auto text-xs text-[var(--text-muted)]">
              <span className="w-1.5 h-1.5 bg-[var(--accent-success)] rounded-full animate-pulse" />
              <span>Thinking...</span>
            </div>
          )}
        </header>
      )}

      {/* Main chat/agent area - Cursor style centered layout */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <div className="chat-area">
          {mode === 'chat' ? (
            // Chat Mode
            <>
              <div className="flex-1 overflow-hidden">
                {messages.length === 0 ? (
                  <ChatWelcome />
                ) : (
                  <MessageList />
                )}
              </div>
              <Composer />
            </>
          ) : (
            // Agent Mode
            <>
              <div className="flex-1 overflow-hidden">
                {messages.length === 0 ? (
                  <AgentWelcome />
                ) : (
                  <MessageList />
                )}
              </div>
              
              {/* Action Plan Panel */}
              <AnimatePresence>
                {agent.isAgentMode && agent.actionPlan.length > 0 && (
                  <ActionPlan
                    actionSpace={agent.actionSpace}
                    actionPlan={agent.actionPlan}
                    currentActionIndex={agent.currentActionIndex}
                    isExecuting={agent.isExecuting}
                    onConfirmAction={confirmAction}
                    onSkipAction={skipAction}
                    onCancelPlan={cancelPlan}
                    onHighlight={highlightAction}
                  />
                )}
              </AnimatePresence>
              
              <Composer />
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function ChatWelcome() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Logo */}
      <motion.div
        className="w-14 h-14 bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-2xl flex items-center justify-center text-xl font-bold mb-5 shadow-lg"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        M
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        How can I help you?
      </h2>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-sm">
        Ask anything. Type <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs">@</kbd> to reference tabs, bookmarks, or history.
      </p>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        <QuickPrompt icon="🔍" label="Search the web" prompt="/search " />
        <QuickPrompt icon="📄" label="Read current page" prompt="Read this page and summarize it" />
        <QuickPrompt icon="💡" label="Explain this" prompt="Explain what this page is about" />
      </div>
    </motion.div>
  )
}

function QuickPrompt({ icon, label, prompt }: { icon: string; label: string; prompt: string }) {
  const { addMessage } = useChatContext()
  
  return (
    <button
      onClick={() => {
        // This could be improved to actually set the input
        addMessage({ role: 'user', content: prompt })
      }}
      className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function AgentWelcome() {
  const { extractActionSpace, addMessage, createActionPlan } = useChatContext()
  const [extracting, setExtracting] = useState(false)

  const handleExtract = async () => {
    if (extracting) return
    setExtracting(true)
    
    addMessage({
      role: 'system',
      content: '🤖 Analyzing page for interactive elements...',
    })

    try {
      const actionSpace = await extractActionSpace()
      
      if (actionSpace) {
        const totalActions = actionSpace.meta.totalActions
        addMessage({
          role: 'system',
          content: `✅ Found ${totalActions} interactive elements`,
        })

        // Create demo plan with first 5 actions
        const demoActions = actionSpace.globalActions.slice(0, 5)
        if (demoActions.length > 0) {
          createActionPlan(demoActions)
          addMessage({
            role: 'system',
            content: `📋 Created action plan with ${demoActions.length} operations. Review below to confirm.`,
          })
        }
      } else {
        addMessage({
          role: 'system',
          content: '❌ Could not extract page elements. Make sure the page is fully loaded.',
        })
      }
    } catch (e) {
      addMessage({
        role: 'system',
        content: `❌ Error: ${(e as Error).message}`,
      })
    } finally {
      setExtracting(false)
    }
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Icon */}
      <motion.div
        className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl mb-5 shadow-lg"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        🤖
      </motion.div>

      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        Agent Mode
      </h2>

      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm">
        Analyze the current page and create an action plan for automated interactions.
      </p>

      <button
        onClick={handleExtract}
        disabled={extracting}
        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md"
      >
        {extracting ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Scan Page
          </>
        )}
      </button>

      <div className="mt-8 text-xs text-[var(--text-muted)] max-w-xs">
        <p className="font-medium text-[var(--text-secondary)] mb-2">Agent capabilities:</p>
        <ul className="space-y-1.5 text-left">
          <li className="flex items-center gap-2">
            <span className="text-[var(--accent-success)]">•</span>
            <span>Detect clickable elements & forms</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[var(--accent-success)]">•</span>
            <span>Execute actions with confirmation</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[var(--accent-success)]">•</span>
            <span>Visual highlighting before action</span>
          </li>
        </ul>
      </div>
    </motion.div>
  )
}

function AppContent() {
  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <MainContent />
    </div>
  )
}

// Helper function to fetch and summarize link content
async function fetchAndSummarize(url: string, dispatch: any) {
  try {
    // Fetch page content
    const response = await chrome.runtime.sendMessage({
      action: 'fetchLinkContent',
      url,
    })

    if (!response.success) {
      throw new Error(response.error || '获取页面内容失败')
    }

    const pageContent = response.data

    // Summarize content
    const summaryResponse = await chrome.runtime.sendMessage({
      action: 'summarizeContentWithPoints',
      title: pageContent.title,
      url: pageContent.url,
      content: pageContent.content,
    })

    if (!summaryResponse.success) {
      throw new Error(summaryResponse.error || '生成总结失败')
    }

    const result = summaryResponse.result

    // Update state with summary
    dispatch({
      type: 'UPDATE_LINK_SUMMARY',
      payload: {
        title: pageContent.title,
        summary: result.summary,
        points: result.points || [],
        loading: false,
      },
    })
  } catch (error) {
    console.error('[App] Failed to fetch and summarize:', error)
    dispatch({
      type: 'UPDATE_LINK_SUMMARY',
      payload: {
        loading: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
    })
  }
}

export default function App() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  )
}
