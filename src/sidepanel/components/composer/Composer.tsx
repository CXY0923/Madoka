/**
 * Composer Component
 * Cursor 风格的输入区域 - 统一卡片容器设计
 * 包含：文本输入区、底部工具栏（模式切换 + 功能图标）
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatContext, type AppMode } from '../../context/ChatContext'
import { useChat } from '../../hooks/useChat'
import { usePromptTemplates } from '../../hooks/usePromptTemplates'
import { ContextPicker } from './ContextPicker'
import { AttachedContextBar } from './AttachedContextBar'
import { PromptTemplateManager } from './PromptTemplateManager'
import { sendToBackground } from '../../../shared/messaging'
import type { AnyContextRef } from '../../../shared/context-types'

export function Composer() {
  const {
    mode,
    setMode,
    attachedContext,
    addContextRef,
    removeContextRef,
    clearContextRefs,
    resolveContextRef,
  } = useChatContext()
  
  const { sendMessage, isResponding, searchStatus } = useChat()
  
  // 提示词模板管理
  const {
    templates,
    activeTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    setDefaultTemplate,
    duplicateTemplate,
  } = usePromptTemplates()
  
  const [input, setInput] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [atPosition, setAtPosition] = useState<number | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [modeSwitcherOpen, setModeSwitcherOpen] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false)
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const modeSwitcherRef = useRef<HTMLDivElement>(null)
  const templateSelectorRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭 picker
  useEffect(() => {
    if (!pickerOpen && !modeSwitcherOpen && !templateSelectorOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      
      // Context picker
      if (pickerOpen) {
        if (pickerRef.current?.contains(target) || composerRef.current?.contains(target)) {
          return
        }
        setPickerOpen(false)
        setPickerQuery('')
        setAtPosition(null)
      }
      
      // Mode switcher
      if (modeSwitcherOpen) {
        if (modeSwitcherRef.current?.contains(target)) {
          return
        }
        setModeSwitcherOpen(false)
      }
      
      // Template selector
      if (templateSelectorOpen) {
        if (templateSelectorRef.current?.contains(target)) {
          return
        }
        setTemplateSelectorOpen(false)
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [pickerOpen, modeSwitcherOpen, templateSelectorOpen])

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
    
    const cursorPos = textareaRef.current?.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    
    const atIndex = textBeforeCursor.lastIndexOf('@')
    
    if (atIndex !== -1) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' '
      if (charBefore === ' ' || charBefore === '\n' || atIndex === 0) {
        const queryAfterAt = textBeforeCursor.slice(atIndex + 1)
        if (!queryAfterAt.includes(' ')) {
          setPickerOpen(true)
          setPickerQuery(queryAfterAt)
          setAtPosition(atIndex)
          return
        }
      }
    }
    
    if (pickerOpen) {
      setPickerOpen(false)
      setPickerQuery('')
      setAtPosition(null)
    }
  }, [pickerOpen])

  // 选择上下文引用
  const handleSelectContext = useCallback((ref: AnyContextRef) => {
    const isAlreadyAdded = attachedContext.refs.some(r => r.id === ref.id)
    
    if (isAlreadyAdded) {
      removeContextRef(ref.id)
    } else {
      addContextRef(ref)
      resolveContextRef(ref)
    }
    
    if (atPosition !== null) {
      const cursorPos = textareaRef.current?.selectionStart || 0
      const newInput = input.slice(0, atPosition) + input.slice(cursorPos)
      setInput(newInput)
      setPickerQuery('')
      setAtPosition(null)
    }
    
    textareaRef.current?.focus()
  }, [addContextRef, removeContextRef, resolveContextRef, atPosition, input, attachedContext.refs])

  // 关闭 picker
  const handleClosePicker = useCallback(() => {
    setPickerOpen(false)
    setPickerQuery('')
    setAtPosition(null)
    textareaRef.current?.focus()
  }, [])

  // 打开 @ picker（通过工具栏按钮）
  const handleOpenContextPicker = useCallback(() => {
    setPickerOpen(true)
    setPickerQuery('')
    setAtPosition(input.length)
    textareaRef.current?.focus()
  }, [input.length])

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || isResponding) return
    
    let messageContent = input.trim()
    
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
    
    sendMessage(messageContent)
    
    setInput('')
    clearContextRefs()
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [input, isResponding, attachedContext, sendMessage, clearContextRefs])

  // 键盘处理
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        return
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    
    if (e.key === 'Escape' && !pickerOpen) {
      if (input) {
        setInput('')
      } else if (attachedContext.refs.length > 0) {
        clearContextRefs()
      }
    }
  }, [pickerOpen, handleSend, input, attachedContext.refs.length, clearContextRefs])

  // 切换模式
  const handleModeChange = useCallback((newMode: AppMode) => {
    setMode(newMode)
    setModeSwitcherOpen(false)
    textareaRef.current?.focus()
  }, [setMode])

  // 优化提示词
  const handleOptimizePrompt = useCallback(async () => {
    if (!input.trim() || isOptimizing || isResponding) return
    
    setIsOptimizing(true)
    
    try {
      const response = await sendToBackground<{ success: boolean; data?: string; error?: string }>({
        action: 'optimizePrompt',
        input: input.trim(),
        systemPrompt: activeTemplate.content, // 使用当前选中的模板
      })
      
      if (response.success && response.data) {
        setInput(response.data)
        // 触发高度调整
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
          }
        }, 0)
      } else {
        console.error('[Composer] Failed to optimize prompt:', response.error)
      }
    } catch (e) {
      console.error('[Composer] Optimize prompt error:', e)
    } finally {
      setIsOptimizing(false)
      textareaRef.current?.focus()
    }
  }, [input, isOptimizing, isResponding, activeTemplate.content])

  // 选择模板
  const handleSelectTemplate = useCallback(async (templateId: string) => {
    await setDefaultTemplate(templateId)
    setTemplateSelectorOpen(false)
  }, [setDefaultTemplate])

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

      <div className={`composer-card ${isFocused ? 'focused' : ''} ${pickerOpen ? 'picker-open' : ''}`}>
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
        <div className="composer-input-wrapper">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder="Plan, @ for context, / for commands"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isResponding}
            rows={1}
          />
        </div>

        {/* 底部工具栏 */}
        <div className="composer-toolbar">
          {/* 左侧：模式切换器 */}
          <div className="composer-toolbar-left">
            <div className="composer-mode-switcher" ref={modeSwitcherRef}>
              <button
                className="composer-mode-btn"
                onClick={() => setModeSwitcherOpen(!modeSwitcherOpen)}
                type="button"
              >
                <ModeIcon mode={mode} />
                <span className="composer-mode-label">
                  {mode === 'agent' ? 'Agent' : 'Chat'}
                </span>
                <ChevronIcon isOpen={modeSwitcherOpen} />
              </button>

              {/* 模式切换下拉菜单 */}
              <AnimatePresence>
                {modeSwitcherOpen && (
                  <motion.div
                    className="composer-mode-dropdown"
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      className={`composer-mode-option ${mode === 'agent' ? 'active' : ''}`}
                      onClick={() => handleModeChange('agent')}
                    >
                      <ModeIcon mode="agent" />
                      <div className="composer-mode-option-content">
                        <span className="composer-mode-option-title">Agent</span>
                        <span className="composer-mode-option-desc">Autonomous browsing mode</span>
                      </div>
                      {mode === 'agent' && <CheckIcon />}
                    </button>
                    <button
                      className={`composer-mode-option ${mode === 'chat' ? 'active' : ''}`}
                      onClick={() => handleModeChange('chat')}
                    >
                      <ModeIcon mode="chat" />
                      <div className="composer-mode-option-content">
                        <span className="composer-mode-option-title">Chat</span>
                        <span className="composer-mode-option-desc">Standard conversation</span>
                      </div>
                      {mode === 'chat' && <CheckIcon />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 右侧：功能图标 */}
          <div className="composer-toolbar-right">
            {/* @ Context 按钮 */}
            <button
              className="composer-tool-btn"
              onClick={handleOpenContextPicker}
              title="Add context (@)"
              type="button"
            >
              <AtIcon />
            </button>

            {/* 网络搜索按钮 */}
            <button
              className="composer-tool-btn"
              onClick={() => {
                setInput(input + '/search ')
                textareaRef.current?.focus()
              }}
              title="Web search"
              type="button"
            >
              <GlobeIcon />
            </button>

            {/* 模板选择器 + 优化按钮 */}
            <div className="template-selector" ref={templateSelectorRef}>
              <button
                className="template-selector-btn"
                onClick={() => setTemplateSelectorOpen(!templateSelectorOpen)}
                title={`当前模板: ${activeTemplate.name}`}
                type="button"
              >
                <span>{activeTemplate.name}</span>
                <ChevronIcon isOpen={templateSelectorOpen} />
              </button>
              
              {/* 模板快速选择下拉 */}
              <AnimatePresence>
                {templateSelectorOpen && (
                  <motion.div
                    className="template-selector-dropdown"
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="template-selector-header">
                      <span className="template-selector-title">Prompt Templates</span>
                      <button
                        className="template-selector-manage-btn"
                        onClick={() => {
                          setTemplateSelectorOpen(false)
                          setTemplateManagerOpen(true)
                        }}
                      >
                        Manage
                      </button>
                    </div>
                    <div className="template-selector-list">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          className={`template-selector-item ${template.id === activeTemplate.id ? 'active' : ''}`}
                          onClick={() => handleSelectTemplate(template.id)}
                        >
                          {template.id === activeTemplate.id ? (
                            <svg className="template-selector-item-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="template-selector-item-check" />
                          )}
                          <span className="template-selector-item-name">{template.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 优化提示词按钮 */}
            <button
              className={`composer-tool-btn ${isOptimizing ? 'optimizing' : ''}`}
              onClick={handleOptimizePrompt}
              disabled={!input.trim() || isOptimizing || isResponding}
              title="优化提示词"
              type="button"
            >
              {isOptimizing ? (
                <span className="composer-tool-spinner" />
              ) : (
                <SparklesIcon />
              )}
            </button>

            {/* 发送按钮 */}
            <button
              className="composer-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || isResponding}
              aria-label="Send message"
              type="button"
            >
              {isResponding ? (
                <span className="composer-send-spinner" />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* 模板管理面板 */}
      <PromptTemplateManager
        isOpen={templateManagerOpen}
        templates={templates}
        activeTemplateId={activeTemplate.id}
        onClose={() => setTemplateManagerOpen(false)}
        onSelect={handleSelectTemplate}
        onAdd={async (name, content) => {
          await addTemplate(name, content)
        }}
        onUpdate={async (id, updates) => {
          await updateTemplate(id, updates)
        }}
        onDelete={async (id) => {
          await deleteTemplate(id)
        }}
        onDuplicate={async (id) => {
          await duplicateTemplate(id)
        }}
      />
    </div>
  )
}

// ============ Icon Components ============

function ModeIcon({ mode }: { mode: AppMode }) {
  if (mode === 'agent') {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg 
      className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function AtIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={1.5} 
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" 
      />
    </svg>
  )
}
