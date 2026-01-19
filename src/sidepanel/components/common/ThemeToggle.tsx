/**
 * ThemeToggle Component
 * Toggle button for dark/light theme
 */

import { motion } from 'framer-motion'
import { useChatContext } from '../../context/ChatContext'

export function ThemeToggle() {
  const { state, setTheme } = useChatContext()
  const isDark = state.theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 180 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        {isDark ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </motion.div>
    </button>
  )
}

/**
 * ThemeToggleSwitch - Alternative switch-style toggle
 */
export function ThemeToggleSwitch() {
  const { state, setTheme } = useChatContext()
  const isDark = state.theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        relative w-10 h-5 rounded-full transition-colors
        ${isDark ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]'}
      `}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
        initial={false}
        animate={{ left: isDark ? '22px' : '2px' }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      />
    </button>
  )
}
