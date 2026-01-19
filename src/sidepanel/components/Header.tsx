/**
 * Header Component
 * Top bar with status and controls (legacy - now integrated in App.tsx)
 */

import { motion } from 'framer-motion'
import { useChatContext } from '../context/ChatContext'
import { useSettings } from '../hooks/useSettings'
import { variants, pulseAnimation } from '../styles/animations'

export function Header() {
  const { setView, clearMessages, toggleSidebar, state } = useChatContext()
  const { config, toggleEngine } = useSettings()

  return (
    <motion.header
      className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]"
      variants={variants.header}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      {/* Logo and status */}
      <div className="flex items-center gap-2">
        {!state.sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 -ml-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        
        <motion.div
          className="w-8 h-8 bg-[var(--accent-primary)] text-white rounded-lg flex items-center justify-center text-xs font-bold"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          M
        </motion.div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Madoka</span>
          <motion.div
            className="flex items-center gap-1 text-xs text-[var(--text-muted)]"
            {...pulseAnimation}
          >
            <div className="w-1.5 h-1.5 bg-[var(--accent-success)] rounded-full" />
            <span>Ready</span>
          </motion.div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Search engine toggle */}
        <motion.button
          className="px-2 py-1 text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-hover)] transition-colors"
          onClick={toggleEngine}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {config.searchEngine === 'bing' ? 'Bing' : 'Google'}
        </motion.button>

        {/* Clear button */}
        <motion.button
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          onClick={clearMessages}
          title="Clear conversation"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
          </svg>
        </motion.button>

        {/* Settings button */}
        <motion.button
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          onClick={() => setView('settings')}
          title="Settings"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </motion.button>
      </div>
    </motion.header>
  )
}
