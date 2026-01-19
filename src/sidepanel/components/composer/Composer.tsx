/**
 * Composer Component
 * Cursor 风格的输入区域，支持 @ 引用（多选模式）
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatContext } from '../../context/ChatContext'
import { useChat } from '../../hooks/useChat'
import { ContextPicker } from './ContextPicker'
import { AttachedContextBar } from './AttachedContextBar'
import type { AnyContextRef } from '../../../shared/context-types'

export function Composer() {
  const {
    mode,
    attachedContext,
    addContextRef,
    removeContextRef,
    clearContextRefs,
    resolveContextRef,
  } = useChatContext()
  
  const { sendMessage, isResponding, searchStatus } = useChat()
  
  const [input, setInput] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [atPosition, setAtPosition] = useState<number | null>(null)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭 picker
  useEffect(() => {
    if (!pickerOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // 如果点击在 picker 或 composer 内部，不关闭
      if (pickerRef.current?.contains(target) || composerRef.current?.contains(target)) {
        return
      }
      // 点击外部，关闭 picker
      setPickerOpen(false)
      setPickerQuery('')
      setAtPosition(null)
    }

    // 延迟添加监听，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [pickerOpen])

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // 处理 @ 触发
  const handleInputChange = useCallback((value: string) => {
    setInput(value)
    
    // 检测 @ 触发
    const cursorPos = textareaRef.current?.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    
    // 查找最近的 @
    const atIndex = textBeforeCursor.lastIndexOf('@')
    
    if (atIndex !== -1) {
      // 检查 @ 前是否是空格或开头
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
      if (charBefore === ' ' || charBefore === '\n' || atIndex === 0) {
        // 提取 @ 后的查询文本
        const queryAfterAt = textBeforeCursor.slice(atIndex + 1)
        // 确保查询中没有空格（否则认为 @ 引用结束）
        if (!queryAfterAt.includes(' ')) {
          setPickerOpen(true)
          setPickerQuery(queryAfterAt)
          setAtPosition(atIndex)
          return
        }
      }
    }
    
    // 没有有效的 @ 触发
    if (pickerOpen) {
      setPickerOpen(false)
      setPickerQuery('')
      setAtPosition(null)
    }
  }, [pickerOpen])

  // 选择上下文引用（多选模式：不关闭 picker）
  const handleSelectContext = useCallback((ref: AnyContextRef) => {
    // 检查是否已添加
    const isAlreadyAdded = attachedContext.refs.some(r => r.id === ref.id)
    
    if (isAlreadyAdded) {
      // 如果已添加，则移除
      removeContextRef(ref.id)
    } else {
      // 添加到附加上下文
      addContextRef(ref)
      // 开始解析内容
      resolveContextRef(ref)
    }
    
    // 多选模式：保持 picker 打开，只清除 @ 查询文本
    if (atPosition !== null) {
      const cursorPos = textareaRef.current?.selectionStart || 0
      const newInput = input.slice(0, atPosition) + input.slice(cursorPos)
      setInput(newInput)
      setPickerQuery('')
      setAtPosition(null)
    }
    
    // 保持聚焦（不关闭 picker）
    textareaRef.current?.focus()
  }, [addContextRef, removeContextRef, resolveContextRef, atPosition, input, attachedContext.refs])

  // 关闭 picker
  const handleClosePicker = useCallback(() => {
    setPickerOpen(false)
    setPickerQuery('')
    setAtPosition(null)
    textareaRef.current?.focus()
  }, [])

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || isResponding) return
    
    // 构建消息内容，包含上下文
    let messageContent = input.trim()
    
    // 如果有附加上下文，添加到消息中
    if (attachedContext.refs.length > 0) {
      const contextParts: string[] = []
      
      for (const ref of attachedContext.refs) {
        const content = attachedContext.resolvedContent[ref.id]
        if (content) {
          contextParts.push(`--- Context from: ${ref.title} (${ref.url}) ---\n${content}\n`)
        } else {
          contextParts.push(`--- Reference: ${ref.title} (${ref.url}) ---\n[Content not loaded]\n`)
        }
      }
      
      if (contextParts.length > 0) {
        messageContent = `${contextParts.join('\n')}\n--- User Query ---\n${messageContent}`
      }
    }
    
    // 发送消息
    sendMessage(messageContent)
    
    // 清空输入和上下文
    setInput('')
    clearContextRefs()
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, isResponding, attachedContext, sendMessage, clearContextRefs])

  // 键盘处理
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 如果 picker 打开，让 picker 处理键盘事件
    if (pickerOpen) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        return // picker 会处理
      }
    }
    
    // Enter 发送（非 Shift）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    
    // Escape 清空
    if (e.key === 'Escape' && !pickerOpen) {
      if (input) {
        setInput('')
      } else if (attachedContext.refs.length > 0) {
        clearContextRefs()
      }
    }
  }, [pickerOpen, handleSend, input, attachedContext.refs.length, clearContextRefs])

  return (
    <div className="composer-wrapper" ref={composerRef}>
      {/* 搜索状态 */}
      <AnimatePresence>
        {searchStatus && (
          <motion.div
            className="composer-status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="composer-status-spinner" />
            <span>{searchStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`composer ${pickerOpen ? 'picker-open' : ''}`}>
        {/* Context Picker 弹出菜单 */}
        <ContextPicker
          ref={pickerRef}
          isOpen={pickerOpen}
          query={pickerQuery}
          selectedIds={attachedContext.refs.map(r => r.id)}
          onSelect={handleSelectContext}
          onClose={handleClosePicker}
        />

        {/* 已附加的上下文 */}
        <AttachedContextBar
          refs={attachedContext.refs}
          resolvingIds={attachedContext.resolvingIds}
          onRemove={removeContextRef}
        />

        {/* 输入区域 */}
        <div className="composer-input-area">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder={
              mode === 'agent' 
                ? 'Describe what you want to do...'
                : 'Ask anything... Type @ to add context'
            }
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isResponding}
            rows={1}
          />
          
          <button
            className="composer-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isResponding}
            aria-label="Send message"
          >
            {isResponding ? (
              <span className="composer-send-spinner" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>

        {/* 底部提示 */}
        <div className="composer-footer">
          <div className="composer-hints">
            <span><kbd>@</kbd> to mention</span>
            <span><kbd>Enter</kbd> to send</span>
            <span><kbd>Shift+Enter</kbd> new line</span>
          </div>
          
          {attachedContext.refs.length > 0 && (
            <button
              className="composer-clear-btn"
              onClick={clearContextRefs}
            >
              Clear all ({attachedContext.refs.length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
