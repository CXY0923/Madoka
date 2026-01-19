/**
 * ActionPlan Component
 * Displays Action Space and pending action plan
 */

import { motion, AnimatePresence } from 'framer-motion'
import type { Action, ActionSpace, ActionPlanItem, ActionStatus, DangerLevel } from '../../shared/action-types'
import { variants } from '../styles/animations'

interface ActionPlanProps {
  actionSpace: ActionSpace | null
  actionPlan: ActionPlanItem[]
  currentActionIndex: number
  isExecuting: boolean
  onConfirmAction: (actionId: string) => void
  onSkipAction: (actionId: string) => void
  onCancelPlan: () => void
  onHighlight: (actionId: string, highlight: boolean) => void
}

/**
 * Get danger level styles
 */
function getDangerStyles(level: DangerLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case 'danger':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-500',
        border: 'border-red-500/30',
      }
    case 'warning':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-500',
        border: 'border-amber-500/30',
      }
    default:
      return {
        bg: 'bg-[var(--bg-secondary)]',
        text: 'text-[var(--text-primary)]',
        border: 'border-[var(--border-primary)]',
      }
  }
}

/**
 * Get status styles
 */
function getStatusStyles(status: ActionStatus): { icon: string; bg: string } {
  switch (status) {
    case 'executing':
      return { icon: '⏳', bg: 'bg-amber-500/20' }
    case 'success':
      return { icon: '✅', bg: 'bg-green-500/20' }
    case 'failed':
      return { icon: '❌', bg: 'bg-red-500/20' }
    case 'skipped':
      return { icon: '⏭️', bg: 'bg-[var(--bg-tertiary)]' }
    default:
      return { icon: '⏸️', bg: 'bg-[var(--accent-primary)]/10' }
  }
}

/**
 * Get action type icon
 */
function getActionTypeIcon(type: string): string {
  switch (type) {
    case 'click': return '👆'
    case 'input': return '⌨️'
    case 'select': return '📋'
    case 'toggle': return '🔘'
    case 'navigate': return '🔗'
    case 'submit': return '📤'
    default: return '⚡'
  }
}

/**
 * Single Action item
 */
function ActionItem({
  item,
  index,
  isCurrent,
  isExecuting,
  onConfirm,
  onSkip,
  onMouseEnter,
  onMouseLeave,
}: {
  item: ActionPlanItem
  index: number
  isCurrent: boolean
  isExecuting: boolean
  onConfirm: () => void
  onSkip: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const { action, status } = item
  const dangerStyles = getDangerStyles(action.dangerLevel)
  const statusStyles = getStatusStyles(status)
  const isPending = status === 'pending'
  const canAct = isCurrent && isPending && !isExecuting

  return (
    <motion.div
      className={`
        relative p-3 rounded-xl border transition-all duration-200
        ${dangerStyles.border} ${dangerStyles.bg}
        ${isCurrent ? 'ring-2 ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--bg-primary)]' : ''}
        ${isPending ? 'hover:shadow-theme-sm cursor-pointer' : 'opacity-75'}
      `}
      variants={variants.actionPlanItem}
      initial="initial"
      animate="animate"
      layout
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Index and status */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${statusStyles.bg}`}>
          {status === 'pending' ? index + 1 : statusStyles.icon}
        </span>

        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
          {getActionTypeIcon(action.type)} {action.type}
        </span>

        {action.dangerLevel !== 'safe' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${dangerStyles.text} ${dangerStyles.bg} border ${dangerStyles.border}`}>
            {action.dangerLevel === 'danger' ? '⚠️ Danger' : '⚡ Sensitive'}
          </span>
        )}
      </div>

      {/* Action content */}
      <div className="mb-2">
        <div className={`font-medium ${dangerStyles.text}`}>{action.label}</div>

        {action.context && (
          <div className="text-xs text-[var(--text-muted)] mt-1">
            📍 {action.context.rowLabel || action.context.rowKey || 'Context'}
          </div>
        )}

        <div className="text-xs text-[var(--text-muted)] mt-1 font-mono truncate">{action.selector}</div>
      </div>

      {/* Action buttons */}
      {canAct && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onConfirm}
            className={`
              flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
              ${action.dangerLevel === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : action.dangerLevel === 'warning'
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'bg-[var(--accent-primary)] text-white hover:opacity-90'
              }
            `}
          >
            {action.dangerLevel === 'danger' ? 'Confirm ⚠️' : 'Confirm ✓'}
          </button>
          <button
            onClick={onSkip}
            className="py-2 px-3 rounded-lg text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-all"
          >
            Skip
          </button>
        </div>
      )}

      {/* Executing overlay */}
      {status === 'executing' && (
        <div className="absolute inset-0 bg-amber-500/10 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
          <div className="flex items-center gap-2 text-amber-500">
            <span className="animate-spin">⏳</span>
            <span className="text-sm font-medium">Executing...</span>
          </div>
        </div>
      )}

      {/* Result */}
      {item.result && (
        <div className={`
          mt-2 p-2 rounded-lg text-xs
          ${item.result.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}
        `}>
          {item.result.success ? (
            <>
              ✅ Success
              {item.result.domChanged && <span className="ml-2">| DOM changed</span>}
              {item.result.urlChanged && <span className="ml-2">| Navigated</span>}
            </>
          ) : (
            <>❌ Failed: {item.result.error}</>
          )}
        </div>
      )}
    </motion.div>
  )
}

/**
 * ActionPlan main component
 */
export function ActionPlan({
  actionSpace,
  actionPlan,
  currentActionIndex,
  isExecuting,
  onConfirmAction,
  onSkipAction,
  onCancelPlan,
  onHighlight,
}: ActionPlanProps) {
  if (!actionSpace && actionPlan.length === 0) {
    return null
  }

  return (
    <motion.div
      className="flex flex-col gap-3 p-4 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="font-medium text-[var(--text-primary)]">Action Plan</span>
          <span className="text-xs text-[var(--text-muted)]">
            ({currentActionIndex + 1}/{actionPlan.length})
          </span>
        </div>

        <button
          onClick={onCancelPlan}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-danger)] transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Meta info */}
      {actionSpace && (
        <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-2">
          📄 {actionSpace.meta.title.slice(0, 40)}
          {actionSpace.meta.title.length > 40 && '...'}
          <span className="ml-2">| {actionSpace.meta.totalActions} interactive elements</span>
        </div>
      )}

      {/* Action list */}
      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto hide-scrollbar">
        <AnimatePresence>
          {actionPlan.map((item, index) => (
            <ActionItem
              key={item.action.actionId}
              item={item}
              index={index}
              isCurrent={index === currentActionIndex}
              isExecuting={isExecuting}
              onConfirm={() => onConfirmAction(item.action.actionId)}
              onSkip={() => onSkipAction(item.action.actionId)}
              onMouseEnter={() => onHighlight(item.action.actionId, true)}
              onMouseLeave={() => onHighlight(item.action.actionId, false)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Completion state */}
      {currentActionIndex >= actionPlan.length && actionPlan.length > 0 && (
        <div className="text-center py-4 text-[var(--accent-success)] font-medium">
          🎉 All actions completed
        </div>
      )}
    </motion.div>
  )
}

/**
 * ActionSpacePreview component
 * Shows Action Space overview
 */
export function ActionSpacePreview({
  actionSpace,
  onSelectAction,
  onHighlight,
}: {
  actionSpace: ActionSpace
  onSelectAction: (action: Action) => void
  onHighlight: (actionId: string, highlight: boolean) => void
}) {
  const allActions = [
    ...actionSpace.globalActions,
    ...actionSpace.contextualActions.flatMap((g) => g.actions),
  ]

  return (
    <motion.div
      className="flex flex-col gap-3 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="text-sm font-medium text-[var(--text-primary)]">
        🎯 Found {allActions.length} interactive elements
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto hide-scrollbar">
        {allActions.slice(0, 20).map((action) => {
          const dangerStyles = getDangerStyles(action.dangerLevel)
          return (
            <button
              key={action.actionId}
              className={`
                p-2 text-left rounded-lg border text-xs transition-all
                ${dangerStyles.border} ${dangerStyles.bg}
                hover:shadow-theme-sm
              `}
              onClick={() => onSelectAction(action)}
              onMouseEnter={() => onHighlight(action.actionId, true)}
              onMouseLeave={() => onHighlight(action.actionId, false)}
            >
              <div className="font-medium truncate">
                {getActionTypeIcon(action.type)} {action.label}
              </div>
              <div className="text-[var(--text-muted)] truncate mt-0.5">{action.tagName}</div>
            </button>
          )
        })}
      </div>

      {allActions.length > 20 && (
        <div className="text-xs text-[var(--text-muted)] text-center">
          +{allActions.length - 20} more
        </div>
      )}
    </motion.div>
  )
}
