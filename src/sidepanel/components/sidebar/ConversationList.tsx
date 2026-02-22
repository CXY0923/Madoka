/**
 * ConversationList Component
 * List of all conversations with selection
 */

import { AnimatePresence } from 'framer-motion'
import { useChatContext, type Conversation } from '../../context/ChatContext'
import { ConversationItem } from './ConversationItem'

export function ConversationList() {
  const { state, switchConversation, deleteConversation } = useChatContext()
  const { conversations, activeConversationId } = state

  // Group conversations by date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayTime = yesterday.getTime()
  
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastWeekTime = lastWeek.getTime()

  const groupedConversations = {
    today: [] as Conversation[],
    yesterday: [] as Conversation[],
    lastWeek: [] as Conversation[],
    older: [] as Conversation[],
  }

  conversations.forEach(conv => {
    if (conv.updatedAt >= todayTime) {
      groupedConversations.today.push(conv)
    } else if (conv.updatedAt >= yesterdayTime) {
      groupedConversations.yesterday.push(conv)
    } else if (conv.updatedAt >= lastWeekTime) {
      groupedConversations.lastWeek.push(conv)
    } else {
      groupedConversations.older.push(conv)
    }
  })

  const renderGroup = (title: string, convs: Conversation[]) => {
    if (convs.length === 0) return null

    return (
      <div key={title} className="mb-4">
        <div className="px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {title}
        </div>
        <AnimatePresence>
          {convs.map(conv => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              onSelect={() => switchConversation(conv.id)}
              onDelete={() => deleteConversation(conv.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="py-2">
      {renderGroup('Today', groupedConversations.today)}
      {renderGroup('Yesterday', groupedConversations.yesterday)}
      {renderGroup('Previous 7 Days', groupedConversations.lastWeek)}
      {renderGroup('Older', groupedConversations.older)}
      
      {conversations.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          No conversations yet
        </div>
      )}
    </div>
  )
}
