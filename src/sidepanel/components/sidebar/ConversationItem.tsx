/**
 * ConversationItem Component
 * Single conversation item in the sidebar
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Conversation, AppMode } from '../../context/ChatContext'

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

function getModeIcon(mode: AppMode): string {
  return mode === 'agent' ? '🤖' : '💬'
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  
  // If today, show time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  
  // Otherwise show date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ConversationItem({ conversation, isActive, onSelect, onDelete }: ConversationItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`
        group relative flex items-center gap-2 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
        ${isActive 
          ? 'bg-[var(--bg-active)] text-[var(--text-primary)]' 
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
        }
      `}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Mode Icon */}
      <span className="text-sm flex-shrink-0">{getModeIcon(conversation.mode)}</span>
      
      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {conversation.title || 'New Conversation'}
        </div>
        <div className="text-xs text-[var(--text-muted)] truncate">
          {conversation.messages.length} messages
        </div>
      </div>

      {/* Time / Actions */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {isHovered ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 rounded hover:bg-[var(--accent-danger)] hover:text-white text-[var(--text-muted)] transition-colors"
            title="Delete conversation"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">
            {formatTime(conversation.updatedAt)}
          </span>
        )}
      </div>

      {/* Active Indicator */}
      {isActive && (
        <motion.div
          layoutId="activeConversation"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-[var(--accent-primary)] rounded-r"
        />
      )}
    </motion.div>
  )
}
