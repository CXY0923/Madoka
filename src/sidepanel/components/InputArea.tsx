/**
 * InputArea Component
 * Message input with quick actions
 */

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '../hooks/useChat'
import { usePageReader } from '../hooks/usePageReader'
import { useChatContext } from '../context/ChatContext'
import { variants } from '../styles/animations'

export function InputArea() {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, isResponding, searchStatus } = useChat()
  const { readPage, reading } = usePageReader()
  const { pageContent, mode } = useChatContext()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const handleSend = () => {
    if (!input.trim() || isResponding) return
    sendMessage(input)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
      {/* Search/Status indicator */}
      <AnimatePresence>
        {searchStatus && (
          <motion.div
            className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] flex items-center gap-2"
            variants={variants.fade}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <span className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            <span>{searchStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick actions (only in chat mode) */}
      <AnimatePresence>
        {!isResponding && mode === 'chat' && (
          <motion.div
            className="flex gap-2 px-4 py-2 border-b border-[var(--border-primary)]"
            variants={variants.shortcuts}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <QuickAction
              icon={<SearchIcon />}
              label="Search"
              onClick={() => {
                setInput('/search ')
                textareaRef.current?.focus()
              }}
            />
            <QuickAction
              icon={<GitHubIcon />}
              label="找项目"
              onClick={() => {
                setInput('/github ')
                textareaRef.current?.focus()
              }}
            />
            <QuickAction
              icon={<PageIcon />}
              label="Read Page"
              onClick={readPage}
              disabled={reading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attached page indicator */}
      {pageContent && (
        <div className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border-b border-[var(--border-primary)] flex items-center gap-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span className="truncate flex-1">{pageContent.title}</span>
          <button
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => useChatContext().dispatch({ type: 'SET_PAGE_CONTENT', payload: null })}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={textareaRef}
          className="flex-1 resize-none bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all disabled:opacity-50"
          placeholder={pageContent ? 'Ask about this page...' : 'Type a message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isResponding}
        />
        <motion.button
          className="p-2.5 bg-[var(--accent-primary)] text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={handleSend}
          disabled={!input.trim() || isResponding}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}

// Quick action button
function QuickAction({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-full hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {icon}
      {label}
    </motion.button>
  )
}

// Icons
function SearchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  )
}

function PageIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
