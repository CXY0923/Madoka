/**
 * Sidebar Component
 * Collapsible sidebar with conversation list
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useChatContext } from '../../context/ChatContext'
import { ConversationList } from '../sidebar/ConversationList'
import { ThemeToggle } from '../common/ThemeToggle'

export function Sidebar() {
  const { state, toggleSidebar, setView, createNewConversation } = useChatContext()
  const { sidebarOpen } = state

  return (
    <AnimatePresence mode="wait">
      {sidebarOpen && (
        <motion.aside
          className="flex flex-col h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-primary)]"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 260, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[var(--accent-primary)] text-white rounded-lg flex items-center justify-center text-xs font-bold">
                M
              </div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">Madoka</span>
            </div>
            
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* New Conversation Button */}
          <div className="px-3 py-2">
            <button
              onClick={() => createNewConversation()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Conversation
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto hide-scrollbar show-scrollbar-on-hover">
            <ConversationList />
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[var(--border-primary)]">
            <button
              onClick={() => setView('settings')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

/**
 * Sidebar Toggle Button - for when sidebar is closed
 */
export function SidebarToggle() {
  const { state, toggleSidebar } = useChatContext()

  if (state.sidebarOpen) return null

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={toggleSidebar}
      className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] shadow-theme transition-colors"
      title="Open sidebar"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </motion.button>
  )
}
