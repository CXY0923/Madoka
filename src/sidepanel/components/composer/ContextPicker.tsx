/**
 * ContextPicker Component
 * Cursor 风格的 @ 引用选择器（导航式 UI）
 */

import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChatContext } from '../../context/ChatContext'
import type {
  AnyContextRef,
  TabRef,
  PageRef,
  PickerCategory,
} from '../../../shared/context-types'

interface ContextPickerProps {
  isOpen: boolean
  query: string
  selectedIds: string[]
  onSelect: (ref: AnyContextRef) => void
  onClose: () => void
}

interface PickerSection {
  category: PickerCategory
  label: string
  icon: string
  items: AnyContextRef[]
}

export const ContextPicker = forwardRef<HTMLDivElement, ContextPickerProps>(
  function ContextPicker({ isOpen, query, selectedIds, onSelect, onClose }, forwardedRef) {
  const { fetchTabs, fetchBookmarks, fetchHistory, fetchCurrentPage } = useChatContext()
  
  const [sections, setSections] = useState<PickerSection[]>([])
  const [currentPage, setCurrentPage] = useState<PageRef | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [internalQuery, setInternalQuery] = useState('')
  const [currentView, setCurrentView] = useState<'main' | PickerCategory>('main')
  
  const internalRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // 合并 ref
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    if (typeof forwardedRef === 'function') {
      forwardedRef(node)
    } else if (forwardedRef) {
      (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }, [forwardedRef])

  // 获取当前分类
  const currentSection = sections.find(s => s.category === currentView)
  
  // 主视图总项数 = currentPage(如果有) + sections数量
  const mainViewItemCount = (currentPage ? 1 : 0) + sections.length
  
  // 获取当前视图的列表项数
  const currentItemCount = currentView === 'main' 
    ? mainViewItemCount
    : (currentSection?.items.length || 0)

  // 进入分类视图
  const enterCategory = useCallback((category: PickerCategory) => {
    setCurrentView(category)
    setSelectedIndex(0)
    setInternalQuery('')
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  // 返回主视图
  const goBack = useCallback(() => {
    setCurrentView('main')
    setSelectedIndex(0)
    setInternalQuery('')
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  // 加载数据
  const loadData = useCallback(async (searchQuery: string) => {
    setLoading(true)
    
    try {
      // 如果在子视图中搜索，只加载该分类的数据
      if (currentView !== 'main' && searchQuery) {
        let items: AnyContextRef[] = []
        
        switch (currentView) {
          case 'tabs':
            items = await fetchTabs(searchQuery)
            break
          case 'bookmarks':
            items = await fetchBookmarks(searchQuery)
            break
          case 'history':
            items = await fetchHistory(searchQuery, 50)
            break
        }
        
        setSections(prev => prev.map(s => 
          s.category === currentView ? { ...s, items } : s
        ))
        setSelectedIndex(0)
      } else {
        // 主视图或无搜索时，加载所有分类
        const [tabs, bookmarks, history, page] = await Promise.all([
          fetchTabs(searchQuery),
          fetchBookmarks(searchQuery),
          fetchHistory(searchQuery, 50),
          searchQuery ? Promise.resolve(null) : fetchCurrentPage(),
        ])

        // 单独存储 currentPage（不作为分类）
        setCurrentPage(page)

        const newSections: PickerSection[] = []

        if (tabs.length > 0) {
          newSections.push({
            category: 'tabs',
            label: 'Open Tabs',
            icon: '🌐',
            items: tabs,
          })
        }

        if (bookmarks.length > 0) {
          newSections.push({
            category: 'bookmarks',
            label: 'Bookmarks',
            icon: '🔖',
            items: bookmarks,
          })
        }

        if (history.length > 0) {
          newSections.push({
            category: 'history',
            label: 'History',
            icon: '🕐',
            items: history,
          })
        }

        setSections(newSections)
        setSelectedIndex(0)
      }
    } catch (e) {
      console.error('[ContextPicker] Failed to load data:', e)
    } finally {
      setLoading(false)
    }
  }, [currentView, fetchTabs, fetchBookmarks, fetchHistory, fetchCurrentPage])

  // 同步外部 query
  useEffect(() => {
    if (query) {
      setInternalQuery(query)
    }
  }, [query])

  // 搜索 debounce
  useEffect(() => {
    if (!isOpen) return
    
    const timer = setTimeout(() => {
      loadData(internalQuery)
    }, 150)

    return () => clearTimeout(timer)
  }, [isOpen, internalQuery, loadData])

  // 打开时初始化
  useEffect(() => {
    if (isOpen) {
      setCurrentView('main')
      setSelectedIndex(0)
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
    if (!isOpen) {
      setInternalQuery('')
      setCurrentView('main')
    }
  }, [isOpen])

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // 允许在搜索框中输入
      if (e.target === searchInputRef.current && 
          !['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Backspace'].includes(e.key)) {
        return
      }

      // Backspace 在搜索框为空时返回
      if (e.key === 'Backspace' && e.target === searchInputRef.current) {
        if (!internalQuery && currentView !== 'main') {
          e.preventDefault()
          goBack()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, currentItemCount - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (currentView === 'main') {
            // 主视图：index 0 是 currentPage（如果有），之后是分类
            if (currentPage && selectedIndex === 0) {
              // 选择当前页面
              onSelect(currentPage)
            } else {
              // 进入分类（需要减去 currentPage 的偏移）
              const sectionIndex = currentPage ? selectedIndex - 1 : selectedIndex
              const section = sections[sectionIndex]
              if (section) {
                enterCategory(section.category)
              }
            }
          } else {
            // 子视图：选择项目
            const item = currentSection?.items[selectedIndex]
            if (item) {
              onSelect(item)
            }
          }
          break
        case 'Escape':
          e.preventDefault()
          if (currentView !== 'main') {
            goBack()
          } else {
            onClose()
          }
          break
        case 'ArrowLeft':
          if (currentView !== 'main' && e.target !== searchInputRef.current) {
            e.preventDefault()
            goBack()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, currentItemCount, currentView, sections, currentSection, currentPage, internalQuery, enterCategory, goBack, onSelect, onClose])

  // 滚动到选中项
  useEffect(() => {
    if (!internalRef.current) return
    const selectedEl = internalRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        ref={setRefs}
        className="context-picker"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
      >
        {/* 子视图头部（返回按钮） */}
        <AnimatePresence mode="wait">
          {currentView !== 'main' && currentSection && (
            <motion.div
              className="context-picker-nav-header"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.12 }}
            >
              <button className="context-picker-back-btn" onClick={goBack}>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="context-picker-nav-icon">{currentSection.icon}</span>
              <span className="context-picker-nav-title">{currentSection.label}</span>
              <span className="context-picker-nav-count">{currentSection.items.length}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 搜索框 */}
        <div className="context-picker-search">
          <svg className="context-picker-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="context-picker-search-input"
            placeholder={
              currentView === 'main' 
                ? 'Search all contexts...' 
                : `Search ${currentSection?.label.toLowerCase()}...`
            }
            value={internalQuery}
            onChange={(e) => setInternalQuery(e.target.value)}
          />
          {internalQuery && (
            <button
              className="context-picker-search-clear"
              onClick={() => setInternalQuery('')}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 视图容器 - 允许动画重叠 */}
        <div className="context-picker-views">
          {/* 加载状态 */}
          {loading && currentItemCount === 0 && (
            <div className="context-picker-loading">
              <span className="context-picker-spinner" />
              <span>Loading...</span>
            </div>
          )}

          {/* 空状态 */}
          {!loading && currentItemCount === 0 && (
            <div className="context-picker-empty">
              <span>{internalQuery ? 'No results found' : 'No context available'}</span>
            </div>
          )}

          {/* 主视图和子视图使用同一个 AnimatePresence，允许同时动画 */}
          <AnimatePresence initial={false}>
            {currentView === 'main' && (currentPage || sections.length > 0) && (
              <motion.div
                key="main-view"
                className="context-picker-view context-picker-categories"
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {/* 当前页面（直接显示，不作为分类） */}
                {currentPage && (
                  <div
                    data-index={0}
                    className={`context-picker-item context-picker-current-page ${selectedIndex === 0 ? 'selected' : ''} ${selectedIds.includes(currentPage.id) ? 'added' : ''}`}
                    onClick={() => onSelect(currentPage)}
                    onMouseEnter={() => setSelectedIndex(0)}
                  >
                    <div className={`context-picker-item-checkbox ${selectedIds.includes(currentPage.id) ? 'checked' : ''}`}>
                      {selectedIds.includes(currentPage.id) && (
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="context-picker-item-title">{currentPage.title}</span>
                    <span className="context-picker-current-badge">Current</span>
                  </div>
                )}

                {/* 分类列表 */}
                {sections.map((section, index) => {
                  const actualIndex = currentPage ? index + 1 : index
                  return (
                    <div
                      key={section.category}
                      data-index={actualIndex}
                      className={`context-picker-category-item ${actualIndex === selectedIndex ? 'selected' : ''}`}
                      onClick={() => enterCategory(section.category)}
                      onMouseEnter={() => setSelectedIndex(actualIndex)}
                    >
                      <span className="context-picker-category-icon">{section.icon}</span>
                      <span className="context-picker-category-label">{section.label}</span>
                      <span className="context-picker-category-count">{section.items.length}</span>
                      <span className="context-picker-category-arrow">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>
                    </div>
                  )
                })}
              </motion.div>
            )}

            {currentView !== 'main' && currentSection && (
              <motion.div
                key="sub-view"
                className="context-picker-view context-picker-list"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {currentSection.items.map((item, index) => {
                  const isSelected = index === selectedIndex
                  const isAdded = selectedIds.includes(item.id)
                  
                  return (
                    <ContextPickerItem
                      key={item.id}
                      item={item}
                      isSelected={isSelected}
                      isAdded={isAdded}
                      dataIndex={index}
                      onClick={() => onSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    />
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 底部提示 */}
        <div className="context-picker-footer">
          <div className="context-picker-footer-hints">
            <span><kbd>↑↓</kbd> nav</span>
            {currentView === 'main' ? (
              <span><kbd>↵</kbd> enter</span>
            ) : (
              <>
                <span><kbd>↵</kbd> add</span>
                <span><kbd>←</kbd> back</span>
              </>
            )}
            <span><kbd>esc</kbd> {currentView === 'main' ? 'close' : 'back'}</span>
          </div>
          {selectedIds.length > 0 && (
            <span className="context-picker-footer-count">
              {selectedIds.length} selected
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
})

// 单个项目组件
function ContextPickerItem({
  item,
  isSelected,
  isAdded,
  dataIndex,
  onClick,
  onMouseEnter,
}: {
  item: AnyContextRef
  isSelected: boolean
  isAdded: boolean
  dataIndex: number
  onClick: () => void
  onMouseEnter: () => void
}) {
  return (
    <div
      data-index={dataIndex}
      className={`context-picker-item ${isSelected ? 'selected' : ''} ${isAdded ? 'added' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className={`context-picker-item-checkbox ${isAdded ? 'checked' : ''}`}>
        {isAdded && (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      
      <span className="context-picker-item-title">{item.title}</span>
      
      {item.type === 'tab' && (item as TabRef).active && (
        <span className="context-picker-item-badge">Active</span>
      )}
    </div>
  )
}
