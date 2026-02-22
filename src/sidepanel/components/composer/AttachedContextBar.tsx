/**
 * AttachedContextBar Component
 * 显示已附加的上下文引用（类似 Cursor 的文件标签）
 */

import { motion, AnimatePresence } from 'framer-motion'
import type { AnyContextRef, TabRef } from '../../../shared/context-types'

interface AttachedContextBarProps {
  refs: AnyContextRef[]
  resolvingIds: string[]
  onRemove: (id: string) => void
}

export function AttachedContextBar({ refs, resolvingIds, onRemove }: AttachedContextBarProps) {
  if (refs.length === 0) return null

  return (
    <div className="attached-context-bar">
      <AnimatePresence mode="popLayout">
        {refs.map((ref) => (
          <ContextChip
            key={ref.id}
            ref_={ref}
            isResolving={resolvingIds.includes(ref.id)}
            onRemove={() => onRemove(ref.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ContextChip({
  ref_,
  isResolving,
  onRemove,
}: {
  ref_: AnyContextRef
  isResolving: boolean
  onRemove: () => void
}) {
  const getIcon = () => {
    if (ref_.favicon) {
      return (
        <img
          src={ref_.favicon}
          alt=""
          className="context-chip-favicon"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )
    }

    switch (ref_.type) {
      case 'tab':
        return <span className="context-chip-icon-emoji">🌐</span>
      case 'bookmark':
        return <span className="context-chip-icon-emoji">🔖</span>
      case 'history':
        return <span className="context-chip-icon-emoji">🕐</span>
      case 'page':
        return <span className="context-chip-icon-emoji">📄</span>
      default:
        return <span className="context-chip-icon-emoji">📎</span>
    }
  }

  const getLabel = () => {
    // 优先使用短标题
    const title = ref_.title
    if (title.length <= 25) return title

    // 对于 Tab，显示 domain + 截断标题
    if (ref_.type === 'tab') {
      const tab = ref_ as TabRef
      if (tab.active) {
        return `${title.slice(0, 20)}...`
      }
    }

    // 默认截断
    return `${title.slice(0, 22)}...`
  }

  const getTypeLabel = () => {
    switch (ref_.type) {
      case 'tab': return 'Tab'
      case 'bookmark': return 'Bookmark'
      case 'history': return 'History'
      case 'page': return 'Page'
      default: return ''
    }
  }

  return (
    <motion.div
      className={`context-chip ${isResolving ? 'resolving' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      title={`${ref_.title}\n${ref_.url}`}
    >
      <span className="context-chip-icon">
        {getIcon()}
      </span>
      
      <span className="context-chip-type">{getTypeLabel()}</span>
      
      <span className="context-chip-label">{getLabel()}</span>
      
      {isResolving ? (
        <span className="context-chip-spinner" />
      ) : (
        <button
          className="context-chip-remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="Remove"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </motion.div>
  )
}
