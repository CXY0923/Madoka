/**
 * PromptTemplateManager Component
 * 全屏系统指令管理界面 - Google AI Studio 风格
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PromptTemplate } from '../../../shared/prompt-templates'

interface PromptTemplateManagerProps {
  isOpen: boolean
  templates: PromptTemplate[]
  activeTemplateId: string
  onClose: () => void
  onSelect: (id: string) => void
  onAdd: (name: string, content: string) => Promise<void>
  onUpdate: (id: string, updates: { name?: string; content?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
}

export function PromptTemplateManager({
  isOpen,
  templates,
  activeTemplateId,
  onClose,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onDuplicate,
}: PromptTemplateManagerProps) {
  // 当前选中编辑的模板
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(activeTemplateId)
  const [localName, setLocalName] = useState('')
  const [localContent, setLocalContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 获取当前选中的模板
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0]

  // 同步选中模板数据到本地状态
  useEffect(() => {
    if (selectedTemplate) {
      setLocalName(selectedTemplate.name)
      setLocalContent(selectedTemplate.content)
      setSaveStatus('saved')
    }
  }, [selectedTemplate?.id])

  // 打开时同步激活模板
  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId(activeTemplateId)
    }
  }, [isOpen, activeTemplateId])

  // 点击外部关闭下拉框
  useEffect(() => {
    if (!dropdownOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // 自动保存（防抖 500ms）
  const triggerAutoSave = useCallback(async (name: string, content: string) => {
    if (!selectedTemplate || selectedTemplate.isBuiltIn) return
    
    setSaveStatus('saving')
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onUpdate(selectedTemplate.id, { name, content })
        setSaveStatus('saved')
      } catch (e) {
        console.error('[PromptTemplateManager] Auto-save failed:', e)
        setSaveStatus('unsaved')
      }
    }, 500)
  }, [selectedTemplate, onUpdate])

  // 清理计时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // 处理名称变更
  const handleNameChange = useCallback((value: string) => {
    setLocalName(value)
    setSaveStatus('unsaved')
    triggerAutoSave(value, localContent)
  }, [localContent, triggerAutoSave])

  // 处理内容变更
  const handleContentChange = useCallback((value: string) => {
    setLocalContent(value)
    setSaveStatus('unsaved')
    triggerAutoSave(localName, value)
  }, [localName, triggerAutoSave])

  // 切换模板
  const handleSelectTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId)
    onSelect(templateId)
    setDropdownOpen(false)
  }, [onSelect])

  // 删除模板
  const handleDelete = useCallback(async () => {
    if (!selectedTemplate || selectedTemplate.isBuiltIn) return
    
    if (!confirm(`确定删除模板 "${selectedTemplate.name}" 吗？`)) {
      return
    }
    
    try {
      await onDelete(selectedTemplate.id)
      // 删除后选中第一个模板
      if (templates.length > 1) {
        const nextTemplate = templates.find(t => t.id !== selectedTemplate.id)
        if (nextTemplate) {
          setSelectedTemplateId(nextTemplate.id)
          onSelect(nextTemplate.id)
        }
      }
    } catch (e) {
      console.error('[PromptTemplateManager] Delete failed:', e)
    }
  }, [selectedTemplate, templates, onDelete, onSelect])

  // 新建模板
  const handleCreateNew = useCallback(async () => {
    try {
      await onAdd('New Template', '# Role\nYou are a helpful assistant.\n\n# Task\nDescribe your task here.')
      // 新模板会被添加到列表末尾，选中它
      const newTemplateId = templates[templates.length - 1]?.id
      if (newTemplateId) {
        setSelectedTemplateId(newTemplateId)
      }
    } catch (e) {
      console.error('[PromptTemplateManager] Create failed:', e)
    }
    setDropdownOpen(false)
  }, [onAdd, templates])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="system-instructions-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="system-instructions-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, delay: 0.05 }}
        >
          {/* Header */}
          <header className="si-header">
            <h1 className="si-title">System instructions</h1>
            <div className="si-header-right">
              <span className={`si-save-status ${saveStatus}`}>
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'saving' && 'Saving...'}
                {saveStatus === 'unsaved' && 'Unsaved'}
              </span>
              <button 
                className="si-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>
          </header>

          {/* Main Content */}
          <div className="si-content">
            {/* Template Selector Dropdown */}
            <div className="si-field">
              <div className="si-dropdown" ref={dropdownRef}>
                <button
                  className="si-dropdown-trigger"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <span className="si-dropdown-value">{selectedTemplate?.name || 'Select template'}</span>
                  <ChevronDownIcon isOpen={dropdownOpen} />
                </button>
                
                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      className="si-dropdown-menu"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          className={`si-dropdown-item ${template.id === selectedTemplateId ? 'active' : ''}`}
                          onClick={() => handleSelectTemplate(template.id)}
                        >
                          <span className="si-dropdown-item-name">{template.name}</span>
                          <span className="si-dropdown-item-badge">
                            {template.isBuiltIn ? 'Built-in' : 'Custom'}
                          </span>
                          {template.id === selectedTemplateId && <CheckIcon />}
                        </button>
                      ))}
                      <div className="si-dropdown-divider" />
                      <button
                        className="si-dropdown-item si-dropdown-item-new"
                        onClick={handleCreateNew}
                      >
                        <span>+ New Template</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Template Name Input */}
            <div className="si-field si-field-row">
              <input
                type="text"
                className="si-name-input"
                value={localName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Template name"
                disabled={selectedTemplate?.isBuiltIn}
              />
              {!selectedTemplate?.isBuiltIn && (
                <button
                  className="si-delete-btn"
                  onClick={handleDelete}
                  title="Delete template"
                >
                  <TrashIcon />
                </button>
              )}
            </div>

            {/* System Prompt Textarea */}
            <div className="si-field si-field-flex">
              <textarea
                className="si-textarea"
                value={localContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Enter your system instructions here..."
                disabled={selectedTemplate?.isBuiltIn}
                spellCheck={false}
              />
            </div>

            {/* Built-in Template Notice */}
            {selectedTemplate?.isBuiltIn && (
              <div className="si-builtin-notice">
                <span>Built-in templates cannot be edited. </span>
                <button
                  className="si-duplicate-link"
                  onClick={() => {
                    onDuplicate(selectedTemplate.id)
                    setDropdownOpen(false)
                  }}
                >
                  Duplicate to create a custom version
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="si-footer">
            <span className="si-footer-text">Instructions are saved in local storage.</span>
            <span className="si-footer-dot" />
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============ Icon Components ============

function XIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg 
      className={`si-dropdown-icon ${isOpen ? 'open' : ''}`}
      width="16" 
      height="16" 
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
    <svg className="si-dropdown-item-check" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
