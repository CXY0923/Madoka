/**
 * Message Component
 * Single message with Markdown rendering and search results
 */

import { motion } from 'framer-motion'
import { marked } from 'marked'
import type { Message as MessageType } from '../../shared/types'
import { variants } from '../styles/animations'

interface MessageProps {
  message: MessageType
}

export function Message({ message }: MessageProps) {
  const { role, content, searchResults, isStreaming } = message

  const isUser = role === 'user'
  const isSystem = role === 'system'

  // Render Markdown content
  const renderContent = () => {
    if (!content) {
      return isStreaming ? (
        <span className="inline-block w-2 h-4 bg-current animate-pulse" />
      ) : null
    }

    if (isUser) {
      return <p className="whitespace-pre-wrap">{content}</p>
    }

    // AI and system messages use Markdown
    const html = marked.parse(content, { async: false }) as string
    return (
      <div
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <motion.div
      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
      variants={variants.message}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      {/* Search results sources */}
      {searchResults && searchResults.length > 0 && (
        <div className="w-full max-w-[95%] bg-[var(--bg-tertiary)] rounded-xl p-3 text-xs">
          <div className="text-[var(--text-muted)] mb-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>Sources</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {searchResults.slice(0, 3).map((result, index) => (
              <a
                key={index}
                href={result.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-primary)] hover:text-[var(--accent-primary)] hover:underline truncate block transition-colors"
              >
                {index + 1}. {result.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Message content */}
      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-2.5 text-sm
          ${isUser 
            ? 'bg-[var(--msg-user-bg)] text-[var(--msg-user-text)] rounded-br-md' 
            : isSystem
              ? 'bg-[var(--msg-system-bg)] text-[var(--msg-system-text)] rounded-lg'
              : 'bg-[var(--msg-assistant-bg)] text-[var(--msg-assistant-text)] border border-[var(--msg-assistant-border)] rounded-bl-md shadow-theme-sm'
          }
          ${isStreaming ? 'min-h-[2rem]' : ''}
        `}
      >
        {renderContent()}

        {/* Streaming cursor */}
        {isStreaming && content && (
          <motion.span
            className="inline-block w-0.5 h-4 bg-current ml-0.5"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  )
}
