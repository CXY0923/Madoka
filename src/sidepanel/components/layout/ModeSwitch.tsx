/**
 * ModeSwitch Component
 * Toggle between Chat and Agent modes
 */

import { motion } from 'framer-motion'
import { useChatContext, type AppMode } from '../../context/ChatContext'

export function ModeSwitch() {
  const { mode, setMode } = useChatContext()

  return (
    <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-1 gap-1">
      <ModeButton
        mode="chat"
        label="Chat"
        icon={<ChatIcon />}
        isActive={mode === 'chat'}
        onClick={() => setMode('chat')}
      />
      <ModeButton
        mode="agent"
        label="Agent"
        icon={<AgentIcon />}
        isActive={mode === 'agent'}
        onClick={() => setMode('agent')}
      />
    </div>
  )
}

interface ModeButtonProps {
  mode: AppMode
  label: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
}

function ModeButton({ label, icon, isActive, onClick }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
        ${isActive 
          ? 'text-[var(--text-primary)]' 
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
        }
      `}
    >
      {isActive && (
        <motion.div
          layoutId="modeIndicator"
          className="absolute inset-0 bg-[var(--bg-primary)] rounded-md shadow-theme-sm"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10">{label}</span>
    </button>
  )
}

function ChatIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function AgentIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

/**
 * Compact mode indicator for header
 */
export function ModeIndicator() {
  const { mode } = useChatContext()

  return (
    <div className={`
      flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      ${mode === 'agent' 
        ? 'bg-[var(--accent-primary)] bg-opacity-10 text-[var(--accent-primary)]' 
        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
      }
    `}>
      {mode === 'agent' ? <AgentIcon /> : <ChatIcon />}
      <span className="capitalize">{mode}</span>
    </div>
  )
}
