/**
 * Welcome Component
 * Welcome screen for Chat mode
 */

import { motion } from 'framer-motion'
import { variants, logoAnimation } from '../styles/animations'

export function Welcome() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full text-center px-6"
      variants={variants.fade}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Logo */}
      <motion.div
        className="w-16 h-16 bg-[var(--accent-primary)] text-white rounded-2xl flex items-center justify-center text-2xl font-bold mb-4"
        {...logoAnimation}
      >
        M
      </motion.div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        Welcome to Madoka
      </h2>

      {/* Description */}
      <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-xs">
        Your intelligent browsing assistant. Ask questions, get answers with context from the web.
      </p>

      {/* Features */}
      <div className="bg-[var(--bg-tertiary)] rounded-xl px-4 py-3 text-xs text-[var(--text-muted)] max-w-xs">
        <p className="font-medium text-[var(--text-secondary)] mb-2">Features:</p>
        <ul className="space-y-1.5 text-left">
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent-primary)]">•</span>
            <span>Smart search - AI decides when to search</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent-primary)]">•</span>
            <span>Page context - Automatically reads current page</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[var(--accent-primary)]">•</span>
            <span>Agent mode - Automate browser actions</span>
          </li>
        </ul>
      </div>

      {/* Hint */}
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Type a message to start chatting
      </p>
    </motion.div>
  )
}
