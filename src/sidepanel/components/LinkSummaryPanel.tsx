/**
 * Link Summary Panel
 * 显示链接总结的侧边栏面板
 */

import { useChatContext, type LinkSummaryState } from '../context/ChatContext'

interface LinkSummaryPanelProps {
  linkSummary: LinkSummaryState
}

export function LinkSummaryPanel({ linkSummary }: LinkSummaryPanelProps) {
  const { dispatch } = useChatContext()

  const handleBack = () => {
    dispatch({ type: 'CLEAR_LINK_SUMMARY' })
  }

  const handleViewSource = async (point: LinkSummaryState['points'][0], index: number) => {
    console.log('[LinkSummaryPanel] ========== View Source Button Clicked ==========')
    console.log('[LinkSummaryPanel] Point index:', index)
    console.log('[LinkSummaryPanel] Point data:', {
      summary: point.summary,
      verbatimQuote: point.verbatimQuote,
      selectors: point.selectors,
      contextBefore: point.contextBefore,
      contextAfter: point.contextAfter,
    })
    console.log('[LinkSummaryPanel] Link URL:', linkSummary.url)

    try {
      console.log('[LinkSummaryPanel] Sending message to background...')
      const response = await chrome.runtime.sendMessage({
        action: 'viewSource',
        url: linkSummary.url,
        point: point,
      })
      console.log('[LinkSummaryPanel] Background response:', response)
    } catch (e) {
      console.error('[LinkSummaryPanel] ✗ Failed to view source:', e)
      alert('跳转失败，请重试: ' + (e as Error).message)
    }
  }

  if (linkSummary.loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-[var(--border-primary)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
        <p className="mt-4 text-[var(--text-muted)]">正在生成总结...</p>
      </div>
    )
  }

  if (linkSummary.error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-[var(--text-error)]">{linkSummary.error}</p>
        <button
          onClick={handleBack}
          className="mt-4 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-md hover:opacity-90 transition-opacity"
        >
          返回
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="p-1.5 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="返回"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-sm font-medium text-[var(--text-primary)]">📝 链接总结</h2>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* URL */}
        <div className="mb-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">链接</div>
          <div className="text-sm text-[var(--text-primary)] break-all">{linkSummary.url}</div>
        </div>

        {/* Overall Summary */}
        {linkSummary.summary && (
          <div className="mb-6 p-4 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--accent-secondary)]/10 rounded-lg border-l-4 border-[var(--accent-primary)]">
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">📋 总体总结</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{linkSummary.summary}</p>
          </div>
        )}

        {/* Points List */}
        {linkSummary.points.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">📌 关键要点</h3>
            {linkSummary.points.map((point, index) => (
              <div
                key={index}
                className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] hover:border-[var(--accent-primary)]/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-[var(--accent-primary)] text-white rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-2">
                      {point.summary}
                    </p>
                    {point.verbatimQuote && (
                      <div className="p-2 bg-[var(--bg-primary)] rounded border-l-2 border-[var(--border-secondary)]">
                        <p className="text-xs text-[var(--text-muted)] italic line-clamp-3">
                          "{point.verbatimQuote}"
                        </p>
                      </div>
                    )}
                    <button
                      onClick={() => handleViewSource(point, index)}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-primary)] text-white text-xs rounded-md hover:opacity-90 transition-opacity"
                    >
                      <span>📍</span>
                      <span>查看原文</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {linkSummary.points.length === 0 && !linkSummary.loading && (
          <div className="text-center py-8 text-[var(--text-muted)]">
            暂无详细要点
          </div>
        )}
      </div>
    </div>
  )
}
